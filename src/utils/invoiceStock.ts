import { firestoreService } from '../services/firestore';
import type { Invoice, Sale } from '../types';
import { InvoiceStatus } from '../types';
import { shouldApplyInvoiceStock } from './invoiceHelpers';
import { checkSaleStock } from './saleStock';
import { deductStock, restoreStock } from './stockHelpers';
import { nowUtc } from './firestoreDates';

function invoiceToStockSale(invoice: Invoice): Sale {
  const first = invoice.lines[0];
  return {
    id: invoice.id,
    companyId: invoice.companyId,
    orderId: invoice.invoiceNumber,
    orderDate: invoice.invoiceDate,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      variantId: line.variantId,
      variantLabel: line.variantLabel,
      quantity: line.quantity,
      economics: {
        purchasePrice: line.purchasePrice,
        sellingPrice: line.unitPrice,
        shippingCost: 0,
        taxType: line.taxType ?? 'none',
        taxPercentage: line.taxPercentage ?? 0,
        taxMode: line.taxMode ?? 'inclusive',
        taxAmount: line.taxAmount ?? 0,
      },
    })),
    productId: first?.productId ?? '',
    productName: first?.productName ?? 'Invoice',
    platform: 'Offline',
    quantity: invoice.lines.reduce((sum, line) => sum + line.quantity, 0),
    economics: {
      purchasePrice: first?.purchasePrice ?? 0,
      sellingPrice: first?.unitPrice ?? 0,
      shippingCost: 0,
      taxType: first?.taxType ?? 'none',
      taxPercentage: first?.taxPercentage ?? 0,
      taxMode: first?.taxMode ?? 'inclusive',
      taxAmount: first?.taxAmount ?? 0,
    },
    grossRevenue: invoice.total,
    totalCosts: invoice.totalCogs,
    platformFees: 0,
    profit: invoice.profit,
    profitMarginPercent: 0,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

/** Deduct stock for all lines on a sent/paid invoice. */
export async function applyInvoiceStock(
  companyId: string,
  invoice: Invoice,
  userId: string
): Promise<{ ok: true } | { ok: false; productName: string; available: number; needed: number }> {
  if (invoice.stockApplied || invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.DRAFT) {
    return { ok: true };
  }

  if (invoice.lines.length === 0) {
    return { ok: true };
  }

  const stockSale = invoiceToStockSale(invoice);
  const check = await checkSaleStock(companyId, stockSale);
  if (!check.ok) {
    return {
      ok: false,
      productName: check.productName ?? 'product',
      available: check.available,
      needed: check.needed,
    };
  }

  for (const line of invoice.lines) {
    if (!line.productId) continue;
    const result = await deductStock(companyId, line.productId, line.quantity, userId, line.variantId);
    if (!result.ok) {
      const label = line.variantLabel ? `${line.productName} (${line.variantLabel})` : line.productName;
      return { ok: false, productName: label, available: result.available, needed: line.quantity };
    }
  }

  await firestoreService.invoices.update(
    companyId,
    invoice.id,
    {
      stockApplied: true,
      updatedAt: nowUtc(),
    },
    userId
  );

  return { ok: true };
}

/** Restore stock when invoice is voided or edited, then re-apply if needed. */
export async function resyncInvoiceStock(
  companyId: string,
  previous: Invoice,
  updated: Invoice,
  userId: string
): Promise<{ ok: true } | { ok: false; productName: string; available: number; needed: number }> {
  if (previous.stockApplied) {
    await restoreInvoiceStock(companyId, previous, userId);
  }
  if (shouldApplyInvoiceStock(updated)) {
    return applyInvoiceStock(companyId, { ...updated, stockApplied: false }, userId);
  }
  return { ok: true };
}

/** Restore stock when invoice is voided. */
export async function restoreInvoiceStock(
  companyId: string,
  invoice: Invoice,
  userId: string
): Promise<void> {
  if (!invoice.stockApplied) return;

  for (const line of invoice.lines) {
    if (!line.productId) continue;
    await restoreStock(
      companyId,
      line.productId,
      line.productName,
      line.quantity,
      userId,
      line.variantId,
      line.variantLabel
    );
  }

  await firestoreService.invoices.update(
    companyId,
    invoice.id,
    {
      stockApplied: false,
      updatedAt: nowUtc(),
    },
    userId
  );
}

export function invoiceStockFailureMessage(
  result: { ok: false; productName: string; available: number; needed: number }
): string {
  return `Insufficient stock for ${result.productName}. Available: ${result.available}, needed: ${result.needed}`;
}
