import { firestoreService } from '../services/firestore';
import type { Invoice, Product, ProductStock, PurchaseOrder, Sale } from '../types';
import { InvoiceStatus, PurchaseOrderStatus } from '../types';
import { shouldApplyInvoiceStock } from './invoiceHelpers';
import { effectiveStockDeductions } from './saleStock';
import { nowUtc } from './firestoreDates';
import { stockKey } from './variantHelpers';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isActiveRecord<T extends { deleted?: boolean }>(record: T): boolean {
  return record.deleted !== true;
}

interface KeyMeta {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  productName: string;
}

function addToMap(map: Map<string, number>, key: string, qty: number): void {
  if (!key || qty <= 0) return;
  map.set(key, (map.get(key) ?? 0) + qty);
}

function recordMeta(meta: Map<string, KeyMeta>, info: KeyMeta): void {
  const key = stockKey(info.productId, info.variantId);
  if (!key) return;
  const existing = meta.get(key);
  if (!existing) {
    meta.set(key, info);
  } else {
    // Prefer a filled-in name/label if the earlier source lacked one.
    if (!existing.variantLabel && info.variantLabel) existing.variantLabel = info.variantLabel;
    if ((!existing.productName || existing.productName === 'Unknown product') && info.productName) {
      existing.productName = info.productName;
    }
  }
}

function receiptsByProduct(purchases: PurchaseOrder[], meta: Map<string, KeyMeta>): Map<string, number> {
  const map = new Map<string, number>();
  for (const purchase of purchases) {
    if (!isActiveRecord(purchase) || purchase.status === PurchaseOrderStatus.CANCELLED) continue;
    for (const line of purchase.lines) {
      const key = stockKey(line.productId, line.variantId);
      addToMap(map, key, line.quantityReceived);
      recordMeta(meta, {
        productId: line.productId,
        variantId: line.variantId,
        variantLabel: line.variantLabel,
        productName: line.productName,
      });
    }
  }
  return map;
}

function marketplaceOutboundByProduct(sales: Sale[], meta: Map<string, KeyMeta>): Map<string, number> {
  const map = new Map<string, number>();
  for (const sale of sales) {
    if (!isActiveRecord(sale)) continue;
    for (const [key, info] of effectiveStockDeductions(sale)) {
      addToMap(map, key, info.qty);
      recordMeta(meta, {
        productId: info.productId,
        variantId: info.variantId,
        variantLabel: info.variantLabel,
        productName: info.productName,
      });
    }
  }
  return map;
}

function invoiceOutboundByProduct(invoices: Invoice[], meta: Map<string, KeyMeta>): Map<string, number> {
  const map = new Map<string, number>();
  for (const invoice of invoices) {
    if (
      !isActiveRecord(invoice) ||
      invoice.status === InvoiceStatus.VOID ||
      invoice.status === InvoiceStatus.DRAFT
    ) {
      continue;
    }
    for (const line of invoice.lines) {
      const key = stockKey(line.productId, line.variantId);
      addToMap(map, key, line.quantity);
      recordMeta(meta, {
        productId: line.productId,
        variantId: line.variantId,
        variantLabel: line.variantLabel,
        productName: line.productName,
      });
    }
  }
  return map;
}

export interface StockReconciliationRow {
  /** Stock key: productId, or productId + variantId */
  key: string;
  productId: string;
  variantId?: string;
  variantLabel?: string;
  productName: string;
  receivedQty: number;
  marketplaceSoldQty: number;
  offlineSoldQty: number;
  soldQty: number;
  expectedOnHand: number;
  recordedOnHand: number;
  difference: number;
  oversoldBy: number;
}

export interface StockReconciliationSummary {
  rows: StockReconciliationRow[];
  outOfSyncCount: number;
  pendingInvoiceCount: number;
  pendingSaleCount: number;
  oversoldCount: number;
}

export function countPendingStockApplications(
  sales: Sale[],
  invoices: Invoice[]
): { pendingSaleCount: number; pendingInvoiceCount: number } {
  let pendingSaleCount = 0;
  for (const sale of sales) {
    if (!isActiveRecord(sale) || sale.stockApplied) continue;
    if (effectiveStockDeductions(sale).size > 0) pendingSaleCount += 1;
  }

  let pendingInvoiceCount = 0;
  for (const invoice of invoices) {
    if (!isActiveRecord(invoice) || invoice.stockApplied) continue;
    if (shouldApplyInvoiceStock(invoice)) pendingInvoiceCount += 1;
  }

  return { pendingSaleCount, pendingInvoiceCount };
}

export function computeStockReconciliation(input: {
  products: Product[];
  stock: ProductStock[];
  purchases: PurchaseOrder[];
  sales: Sale[];
  invoices: Invoice[];
}): StockReconciliationSummary {
  const meta = new Map<string, KeyMeta>();

  // Seed metadata from the product catalog: one key per variant, or the
  // product id itself for single-SKU products.
  for (const product of input.products) {
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        recordMeta(meta, {
          productId: product.id,
          variantId: variant.id,
          variantLabel: variant.label,
          productName: product.name,
        });
      }
    } else {
      recordMeta(meta, { productId: product.id, productName: product.name });
    }
  }

  const stockByKey = new Map(input.stock.map((s) => [stockKey(s.productId, s.variantId), s]));
  for (const s of input.stock) {
    recordMeta(meta, {
      productId: s.productId,
      variantId: s.variantId,
      variantLabel: s.variantLabel,
      productName: s.productName,
    });
  }

  const received = receiptsByProduct(input.purchases, meta);
  const marketplaceSold = marketplaceOutboundByProduct(input.sales, meta);
  const offlineSold = invoiceOutboundByProduct(input.invoices, meta);

  const keys = new Set<string>([
    ...meta.keys(),
    ...received.keys(),
    ...marketplaceSold.keys(),
    ...offlineSold.keys(),
    ...stockByKey.keys(),
  ]);

  const rows: StockReconciliationRow[] = [];

  for (const key of keys) {
    const receivedQty = received.get(key) ?? 0;
    const marketplaceSoldQty = marketplaceSold.get(key) ?? 0;
    const offlineSoldQty = offlineSold.get(key) ?? 0;
    const soldQty = marketplaceSoldQty + offlineSoldQty;
    const expectedOnHand = receivedQty - soldQty;
    const recordedOnHand = stockByKey.get(key)?.quantityOnHand ?? 0;
    const difference = recordedOnHand - expectedOnHand;
    const oversoldBy = Math.max(0, soldQty - receivedQty);
    const info = meta.get(key);

    if (receivedQty === 0 && soldQty === 0 && recordedOnHand === 0 && !info) {
      continue;
    }

    rows.push({
      key,
      productId: info?.productId ?? stockByKey.get(key)?.productId ?? key,
      variantId: info?.variantId ?? stockByKey.get(key)?.variantId,
      variantLabel: info?.variantLabel ?? stockByKey.get(key)?.variantLabel,
      productName: info?.productName ?? stockByKey.get(key)?.productName ?? 'Unknown product',
      receivedQty,
      marketplaceSoldQty,
      offlineSoldQty,
      soldQty,
      expectedOnHand,
      recordedOnHand,
      difference,
      oversoldBy,
    });
  }

  const rowLabel = (row: StockReconciliationRow) =>
    row.variantLabel ? `${row.productName} ${row.variantLabel}` : row.productName;

  rows.sort(
    (a, b) =>
      Math.abs(b.difference) - Math.abs(a.difference) || rowLabel(a).localeCompare(rowLabel(b))
  );

  const { pendingInvoiceCount, pendingSaleCount } = countPendingStockApplications(
    input.sales,
    input.invoices
  );

  return {
    rows,
    outOfSyncCount: rows.filter((row) => row.difference !== 0).length,
    pendingInvoiceCount,
    pendingSaleCount,
    oversoldCount: rows.filter((row) => row.oversoldBy > 0).length,
  };
}

export interface ApplyStockReconciliationResult {
  updatedProducts: number;
  markedSales: number;
  markedInvoices: number;
  failedSaleMarks: number;
  failedInvoiceMarks: number;
  oversoldProducts: string[];
}

async function markHistoricalStockFlags(
  companyId: string,
  sales: Sale[],
  invoices: Invoice[],
  userId: string,
  now: Date
): Promise<{ markedSales: number; markedInvoices: number; failedSaleMarks: number; failedInvoiceMarks: number }> {
  let markedSales = 0;
  let failedSaleMarks = 0;
  let markedInvoices = 0;
  let failedInvoiceMarks = 0;

  const saleTargets = sales.filter(
    (sale) => isActiveRecord(sale) && !sale.stockApplied && effectiveStockDeductions(sale).size > 0
  );
  const invoiceTargets = invoices.filter(
    (invoice) => isActiveRecord(invoice) && !invoice.stockApplied && shouldApplyInvoiceStock(invoice)
  );

  const saleResults = await Promise.allSettled(
    saleTargets.map((sale) =>
      firestoreService.sales.update(
        companyId,
        sale.id,
        { stockApplied: true, updatedAt: now },
        userId
      )
    )
  );
  for (const result of saleResults) {
    if (result.status === 'fulfilled') markedSales += 1;
    else failedSaleMarks += 1;
  }

  const invoiceResults = await Promise.allSettled(
    invoiceTargets.map((invoice) =>
      firestoreService.invoices.update(
        companyId,
        invoice.id,
        { stockApplied: true, updatedAt: now },
        userId
      )
    )
  );
  for (const result of invoiceResults) {
    if (result.status === 'fulfilled') markedInvoices += 1;
    else failedInvoiceMarks += 1;
  }

  return { markedSales, markedInvoices, failedSaleMarks, failedInvoiceMarks };
}

/** Reset on-hand stock to purchase receipts minus recorded sales/invoices. */
export async function applyStockReconciliation(
  companyId: string,
  summary: StockReconciliationSummary,
  sales: Sale[],
  invoices: Invoice[],
  userId: string
): Promise<ApplyStockReconciliationResult> {
  const now = nowUtc();
  let updatedProducts = 0;
  const oversoldProducts: string[] = [];

  for (const row of summary.rows) {
    const targetQty = Math.max(0, row.expectedOnHand);
    if (row.oversoldBy > 0) {
      oversoldProducts.push(row.variantLabel ? `${row.productName} (${row.variantLabel})` : row.productName);
    }

    const label = row.variantLabel ? `${row.productName} (${row.variantLabel})` : row.productName;
    const existing = await firestoreService.stock.getByProductId(companyId, row.key);

    if (existing) {
      if (existing.quantityOnHand === targetQty) continue;
      try {
        await firestoreService.stock.update(
          companyId,
          row.key,
          {
            companyId,
            quantityOnHand: targetQty,
            totalValue: roundMoney(targetQty * existing.avgPurchasePrice),
            productName: row.productName,
            variantId: row.variantId || undefined,
            variantLabel: row.variantLabel || undefined,
            updatedAt: now,
          },
          userId
        );
        updatedProducts += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Could not update stock for ${label}: ${reason}`);
      }
    } else if (targetQty > 0) {
      try {
        await firestoreService.stock.create(
          companyId,
          {
            id: row.key,
            companyId,
            productId: row.productId,
            variantId: row.variantId || undefined,
            variantLabel: row.variantLabel || undefined,
            productName: row.productName,
            quantityOnHand: targetQty,
            avgPurchasePrice: 0,
            avgSellingPrice: 0,
            totalValue: 0,
            createdAt: now,
            updatedAt: now,
          },
          userId
        );
        updatedProducts += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Could not create stock for ${label}: ${reason}`);
      }
    }
  }

  const marks = await markHistoricalStockFlags(companyId, sales, invoices, userId, now);

  return {
    updatedProducts,
    markedSales: marks.markedSales,
    markedInvoices: marks.markedInvoices,
    failedSaleMarks: marks.failedSaleMarks,
    failedInvoiceMarks: marks.failedInvoiceMarks,
    oversoldProducts,
  };
}
