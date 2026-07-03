import type { Product, PurchaseOrder, PurchaseOrderLine, PurchasePayment, Vendor } from '../types';
import {
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  TaxMode,
  TaxType,
} from '../types';
import { computeTaxAmount } from './profit';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PurchaseLineFormState {
  id: string;
  productId: string;
  variantId: string;
  variantLabel: string;
  quantityOrdered: string;
  quantityReceived: string;
  purchasePrice: string;
  sellingPrice: string;
  taxType: TaxType;
  taxPercentage: string;
  taxMode: TaxMode;
}

export interface PurchaseFormState {
  purchaseDate: string;
  vendorId: string;
  reference: string;
  status: PurchaseOrderStatus;
  notes: string;
  lines: PurchaseLineFormState[];
}

export function emptyPurchaseLineForm(): PurchaseLineFormState {
  return {
    id: createListingId(),
    productId: '',
    variantId: '',
    variantLabel: '',
    quantityOrdered: '1',
    quantityReceived: '0',
    purchasePrice: '',
    sellingPrice: '',
    taxType: TaxType.NONE,
    taxPercentage: '0',
    taxMode: TaxMode.INCLUSIVE,
  };
}

export function emptyPurchaseForm(): PurchaseFormState {
  return {
    purchaseDate: utcToLocalDateInput(new Date()),
    vendorId: '',
    reference: '',
    status: PurchaseOrderStatus.ORDERED,
    notes: '',
    lines: [emptyPurchaseLineForm()],
  };
}

function parseQty(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parsePrice(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function computePurchaseLineTotals(
  quantityOrdered: number,
  purchasePrice: number,
  taxType: TaxType,
  taxPercentage: number,
  taxMode: TaxMode
): { lineSubtotal: number; taxAmount: number; lineTotal: number } {
  const lineSubtotal = roundMoney(Math.max(0, quantityOrdered) * Math.max(0, purchasePrice));
  const tracksTax = taxType !== TaxType.NONE && taxPercentage > 0;
  const taxAmount = tracksTax
    ? computeTaxAmount(lineSubtotal, taxPercentage, taxMode)
    : 0;
  const lineTotal =
    tracksTax && taxMode === TaxMode.EXCLUSIVE
      ? roundMoney(lineSubtotal + taxAmount)
      : lineSubtotal;
  return {
    lineSubtotal,
    taxAmount: roundMoney(taxAmount),
    lineTotal,
  };
}

function lineFromForm(
  line: PurchaseLineFormState,
  productName: string,
  existingLine?: PurchaseOrderLine
): PurchaseOrderLine {
  const quantityOrdered = Math.max(1, parseQty(line.quantityOrdered) || 1);
  const quantityReceived = existingLine
    ? Math.min(quantityOrdered, existingLine.quantityReceived)
    : Math.min(quantityOrdered, parseQty(line.quantityReceived));
  const purchasePrice = parsePrice(line.purchasePrice);
  const sellingPrice = parsePrice(line.sellingPrice);
  const taxPercentage = Math.max(0, parseFloat(line.taxPercentage) || 0);
  const { lineSubtotal, taxAmount, lineTotal } = computePurchaseLineTotals(
    quantityOrdered,
    purchasePrice,
    line.taxType,
    taxPercentage,
    line.taxMode
  );

  const tracksTax = line.taxType !== TaxType.NONE && taxPercentage > 0;

  return {
    id: line.id,
    productId: line.productId,
    productName,
    variantId: line.variantId || undefined,
    variantLabel: line.variantLabel || undefined,
    quantityOrdered,
    quantityReceived,
    purchasePrice,
    sellingPrice,
    taxType: tracksTax ? line.taxType : undefined,
    taxPercentage: tracksTax ? taxPercentage : undefined,
    taxMode: tracksTax ? line.taxMode : undefined,
    taxAmount: tracksTax ? taxAmount : undefined,
    lineSubtotal,
    lineTotal,
  };
}

export function derivePurchaseStatus(lines: PurchaseOrderLine[]): PurchaseOrderStatus {
  if (lines.length === 0) return PurchaseOrderStatus.DRAFT;
  const totalOrdered = lines.reduce((s, l) => s + l.quantityOrdered, 0);
  const totalReceived = lines.reduce((s, l) => s + l.quantityReceived, 0);
  if (totalReceived <= 0) return PurchaseOrderStatus.ORDERED;
  if (totalReceived >= totalOrdered) return PurchaseOrderStatus.RECEIVED;
  return PurchaseOrderStatus.PARTIALLY_RECEIVED;
}

/** True when goods were fully received — stock must not be applied again on this PO. */
export function isPurchaseReceiptLocked(purchase: PurchaseOrder): boolean {
  return (
    purchase.stockReceiptLocked === true ||
    purchase.status === PurchaseOrderStatus.RECEIVED
  );
}

export function hasPurchaseReceiptChanges(
  previous: PurchaseOrder,
  next: PurchaseOrder
): boolean {
  return next.lines.some((line) => {
    const prev = previous.lines.find((l) => l.id === line.id);
    return line.quantityReceived !== (prev?.quantityReceived ?? 0);
  });
}

export function derivePaymentStatus(
  total: number,
  totalPaid: number
): PurchasePaymentStatus {
  if (totalPaid <= 0) return PurchasePaymentStatus.UNPAID;
  if (totalPaid >= total) return PurchasePaymentStatus.PAID;
  return PurchasePaymentStatus.PARTIAL;
}

export interface PurchasePaymentTaxAllocation {
  taxType?: TaxType;
  taxPercentage?: number;
  taxMode?: TaxMode;
  taxAmount?: number;
}

function primaryTaxedLine(lines: PurchaseOrderLine[]): PurchaseOrderLine | undefined {
  return lines
    .filter((line) => line.taxType && line.taxType !== TaxType.NONE && (line.taxAmount ?? 0) > 0)
    .reduce<PurchaseOrderLine | undefined>(
      (best, line) =>
        !best || (line.taxAmount ?? 0) > (best.taxAmount ?? 0) ? line : best,
      undefined
    );
}

/** Tax metadata from PO lines — used when auto-generating payment expenses. */
export function getPurchaseTaxMeta(purchase: PurchaseOrder): PurchasePaymentTaxAllocation & {
  totalTax: number;
} {
  if (purchase.taxAmount <= 0) {
    return { totalTax: 0 };
  }

  const primary = primaryTaxedLine(purchase.lines);
  if (!primary) {
    return { totalTax: purchase.taxAmount };
  }

  return {
    taxType: primary.taxType,
    taxPercentage: primary.taxPercentage,
    taxMode: primary.taxMode,
    totalTax: purchase.taxAmount,
  };
}

/** Allocate PO input tax to a payment (proportional; last payment gets rounding remainder). */
export function allocatePurchasePaymentTax(
  purchase: PurchaseOrder,
  payments: PurchasePayment[],
  paymentIndex: number
): PurchasePaymentTaxAllocation {
  const meta = getPurchaseTaxMeta(purchase);
  if (meta.totalTax <= 0 || purchase.total <= 0) {
    return {};
  }

  const payment = payments[paymentIndex];
  if (!payment || payment.amount <= 0) {
    return {};
  }

  const isLast = paymentIndex === payments.length - 1;
  const totalPaid = roundMoney(payments.reduce((sum, item) => sum + item.amount, 0));

  let taxAmount: number;
  if (isLast && totalPaid >= purchase.total) {
    const priorTax = payments.slice(0, paymentIndex).reduce((sum, item) => {
      return sum + roundMoney(meta.totalTax * (item.amount / purchase.total));
    }, 0);
    taxAmount = roundMoney(Math.max(0, meta.totalTax - priorTax));
  } else {
    taxAmount = roundMoney(meta.totalTax * (payment.amount / purchase.total));
  }

  if (taxAmount <= 0) {
    return {};
  }

  return {
    taxType: meta.taxType,
    taxPercentage: meta.taxPercentage,
    taxMode: meta.taxMode,
    taxAmount,
  };
}

export function purchaseToForm(purchase: PurchaseOrder): PurchaseFormState {
  return {
    purchaseDate: utcToLocalDateInput(purchase.purchaseDate),
    vendorId: purchase.vendorId ?? '',
    reference: purchase.reference ?? '',
    status: purchase.status,
    notes: purchase.notes ?? '',
    lines: purchase.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId ?? '',
      variantLabel: l.variantLabel ?? '',
      quantityOrdered: String(l.quantityOrdered),
      quantityReceived: String(l.quantityReceived),
      purchasePrice: String(l.purchasePrice),
      sellingPrice: String(l.sellingPrice),
      taxType: l.taxType ?? TaxType.NONE,
      taxPercentage: String(l.taxPercentage ?? 0),
      taxMode: l.taxMode ?? TaxMode.INCLUSIVE,
    })),
  };
}

export function buildPurchaseFromForm(
  form: PurchaseFormState,
  companyId: string,
  products: Product[],
  vendors: Vendor[],
  poNumber: string,
  existing?: PurchaseOrder
): PurchaseOrder {
  const now = nowUtc();
  const selectedVendor = form.vendorId
    ? vendors.find((v) => v.id === form.vendorId)
    : undefined;

  const lines = form.lines
    .filter((l) => l.productId)
    .map((l) => {
      const product = products.find((p) => p.id === l.productId);
      const existingLine = existing?.lines.find((el) => el.id === l.id);
      return lineFromForm(l, product?.name ?? 'Unknown product', existingLine);
    });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxAmount = roundMoney(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const total = roundMoney(subtotal + taxAmount);

  const payments = existing?.payments ?? [];
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(Math.max(0, total - totalPaid));

  const status =
    form.status === PurchaseOrderStatus.CANCELLED
      ? PurchaseOrderStatus.CANCELLED
      : derivePurchaseStatus(lines);

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    poNumber,
    purchaseDate: localDateInputToUtc(form.purchaseDate),
    vendorId: selectedVendor?.id,
    vendorName: selectedVendor?.name,
    reference: form.reference.trim() || undefined,
    status,
    paymentStatus: derivePaymentStatus(total, totalPaid),
    lines,
    subtotal,
    taxAmount,
    total,
    totalPaid,
    balanceDue,
    payments,
    notes: form.notes.trim() || undefined,
    receivedAt:
      status === PurchaseOrderStatus.RECEIVED
        ? existing?.receivedAt ?? now
        : existing?.receivedAt,
    stockReceiptLocked:
      existing?.stockReceiptLocked ||
      status === PurchaseOrderStatus.RECEIVED ||
      undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.deleted && p.status === 'active');
}

export function computePurchasePreview(form: PurchaseFormState, products: Product[]) {
  const lines = form.lines
    .filter((l) => l.productId)
    .map((l) => {
      const product = products.find((p) => p.id === l.productId);
      return lineFromForm(l, product?.name ?? '');
    });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxAmount = roundMoney(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const total = roundMoney(subtotal + taxAmount);

  return { lines, subtotal, taxAmount, total, lineCount: lines.length };
}
