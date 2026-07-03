import { firestoreService } from '../services/firestore';
import type { Invoice, Product, ProductStock, PurchaseOrder, Sale } from '../types';
import { InvoiceStatus, PurchaseOrderStatus } from '../types';
import { shouldApplyInvoiceStock } from './invoiceHelpers';
import { effectiveStockDeductions } from './saleStock';
import { nowUtc } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isActiveRecord<T extends { deleted?: boolean }>(record: T): boolean {
  return record.deleted !== true;
}

function addToMap(map: Map<string, number>, productId: string, qty: number): void {
  if (!productId || qty <= 0) return;
  map.set(productId, (map.get(productId) ?? 0) + qty);
}

function receiptsByProduct(purchases: PurchaseOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const purchase of purchases) {
    if (!isActiveRecord(purchase) || purchase.status === PurchaseOrderStatus.CANCELLED) continue;
    for (const line of purchase.lines) {
      addToMap(map, line.productId, line.quantityReceived);
    }
  }
  return map;
}

function marketplaceOutboundByProduct(sales: Sale[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const sale of sales) {
    if (!isActiveRecord(sale)) continue;
    for (const [productId, qty] of effectiveStockDeductions(sale)) {
      addToMap(map, productId, qty);
    }
  }
  return map;
}

function invoiceOutboundByProduct(invoices: Invoice[]): Map<string, number> {
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
      addToMap(map, line.productId, line.quantity);
    }
  }
  return map;
}

export interface StockReconciliationRow {
  productId: string;
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
  const productNames = new Map(input.products.map((p) => [p.id, p.name]));
  const stockByProduct = new Map(input.stock.map((s) => [s.productId, s]));
  const received = receiptsByProduct(input.purchases);
  const marketplaceSold = marketplaceOutboundByProduct(input.sales);
  const offlineSold = invoiceOutboundByProduct(input.invoices);

  const productIds = new Set<string>([
    ...productNames.keys(),
    ...received.keys(),
    ...marketplaceSold.keys(),
    ...offlineSold.keys(),
    ...stockByProduct.keys(),
  ]);

  const rows: StockReconciliationRow[] = [];

  for (const productId of productIds) {
    const receivedQty = received.get(productId) ?? 0;
    const marketplaceSoldQty = marketplaceSold.get(productId) ?? 0;
    const offlineSoldQty = offlineSold.get(productId) ?? 0;
    const soldQty = marketplaceSoldQty + offlineSoldQty;
    const expectedOnHand = receivedQty - soldQty;
    const recordedOnHand = stockByProduct.get(productId)?.quantityOnHand ?? 0;
    const difference = recordedOnHand - expectedOnHand;
    const oversoldBy = Math.max(0, soldQty - receivedQty);

    if (
      receivedQty === 0 &&
      soldQty === 0 &&
      recordedOnHand === 0 &&
      !productNames.has(productId)
    ) {
      continue;
    }

    rows.push({
      productId,
      productName:
        productNames.get(productId) ??
        stockByProduct.get(productId)?.productName ??
        'Unknown product',
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

  rows.sort(
    (a, b) =>
      Math.abs(b.difference) - Math.abs(a.difference) ||
      a.productName.localeCompare(b.productName)
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
      oversoldProducts.push(row.productName);
    }

    const existing = await firestoreService.stock.getByProductId(companyId, row.productId);

    if (existing) {
      if (existing.quantityOnHand === targetQty) continue;
      try {
        await firestoreService.stock.update(
          companyId,
          row.productId,
          {
            companyId,
            quantityOnHand: targetQty,
            totalValue: roundMoney(targetQty * existing.avgPurchasePrice),
            productName: row.productName,
            updatedAt: now,
          },
          userId
        );
        updatedProducts += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Could not update stock for ${row.productName}: ${reason}`);
      }
    } else if (targetQty > 0) {
      try {
        await firestoreService.stock.create(
          companyId,
          {
            id: row.productId,
            companyId,
            productId: row.productId,
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
        throw new Error(`Could not create stock for ${row.productName}: ${reason}`);
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
