import { firestoreService } from '../services/firestore';
import type { Invoice } from '../types';
import { InvoiceStatus } from '../types';
import { shouldApplyInvoiceStock } from './invoiceHelpers';
import { checkSaleStock } from './saleStock';
import { deductStock, restoreStock } from './stockHelpers';
import { nowUtc } from './firestoreDates';

/** Deduct stock for all lines on a sent/paid invoice. */
export async function applyInvoiceStock(
  companyId: string,
  invoice: Invoice,
  userId: string
): Promise<{ ok: true } | { ok: false; productName: string; available: number; needed: number }> {
  if (invoice.stockApplied || invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.DRAFT) {
    return { ok: true };
  }

  for (const line of invoice.lines) {
    const check = await checkSaleStock(companyId, {
      id: invoice.id,
      companyId,
      orderId: invoice.invoiceNumber,
      orderDate: invoice.invoiceDate,
      productId: line.productId,
      productName: line.productName,
      platform: 'Offline',
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
      grossRevenue: line.lineTotal,
      totalCosts: line.purchasePrice * line.quantity,
      platformFees: 0,
      profit: line.lineTotal - line.purchasePrice * line.quantity,
      profitMarginPercent: 0,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    });
    if (!check.ok) {
      return { ok: false, productName: line.productName, available: check.available, needed: check.needed };
    }
  }

  for (const line of invoice.lines) {
    const result = await deductStock(companyId, line.productId, line.quantity, userId);
    if (!result.ok) {
      return { ok: false, productName: line.productName, available: result.available, needed: line.quantity };
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
    await restoreStock(companyId, line.productId, line.productName, line.quantity, userId);
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
