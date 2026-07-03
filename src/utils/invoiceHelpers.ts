import type { Customer, Invoice, InvoiceLine, Product, SaleStatus } from '../types';
import {
  InvoiceStatus,
  PurchasePaymentStatus,
  TaxMode,
  TaxType,
} from '../types';
import { normalizeSaleStatus } from '../constants/saleStatuses';
import { derivePaymentStatus } from './purchaseHelpers';
import { computeTaxAmount } from './profit';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from './firestoreDates';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface InvoiceLineFormState {
  id: string;
  productId: string;
  /** Free-text item name used when the line is a custom (non-catalog) entry */
  productName: string;
  /** HSN / SAC code snapshot — auto-filled from the product, editable */
  hsnCode: string;
  /** When true, the line is a free-text item with no linked catalog product */
  isCustom: boolean;
  quantity: string;
  unitPrice: string;
  purchasePrice: string;
  taxType: TaxType;
  taxPercentage: string;
  taxMode: TaxMode;
}

/** A line is ready to save when it has a catalog product or a custom name. */
export function isInvoiceLineFilled(line: InvoiceLineFormState): boolean {
  return line.isCustom ? line.productName.trim().length > 0 : Boolean(line.productId);
}

export interface InvoiceCustomerFormState {
  mode: 'existing' | 'new';
  customerId: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
}

export interface InvoiceFormState {
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  deliveryStatus: SaleStatus;
  trackingId: string;
  carrier: string;
  customer: InvoiceCustomerFormState;
  notes: string;
  lines: InvoiceLineFormState[];
}

export function emptyInvoiceLineForm(): InvoiceLineFormState {
  return {
    id: createListingId(),
    productId: '',
    productName: '',
    hsnCode: '',
    isCustom: false,
    quantity: '1',
    unitPrice: '',
    purchasePrice: '',
    taxType: TaxType.NONE,
    taxPercentage: '0',
    taxMode: TaxMode.INCLUSIVE,
  };
}

export function emptyInvoiceCustomerForm(): InvoiceCustomerFormState {
  return {
    mode: 'existing',
    customerId: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
  };
}

export function emptyInvoiceForm(): InvoiceFormState {
  return {
    invoiceDate: utcToLocalDateInput(new Date()),
    dueDate: '',
    status: InvoiceStatus.SENT,
    deliveryStatus: normalizeSaleStatus(undefined),
    trackingId: '',
    carrier: '',
    customer: emptyInvoiceCustomerForm(),
    notes: '',
    lines: [emptyInvoiceLineForm()],
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

export function computeInvoiceLineTotals(
  quantity: number,
  unitPrice: number,
  taxType: TaxType,
  taxPercentage: number,
  taxMode: TaxMode
): { lineSubtotal: number; taxAmount: number; lineTotal: number } {
  const lineSubtotal = roundMoney(Math.max(0, quantity) * Math.max(0, unitPrice));
  const tracksTax = taxType !== TaxType.NONE && taxPercentage > 0;
  const taxAmount = tracksTax ? computeTaxAmount(lineSubtotal, taxPercentage, taxMode) : 0;
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
  line: InvoiceLineFormState,
  productName: string,
  hsnCode?: string
): InvoiceLine {
  const quantity = Math.max(1, parseQty(line.quantity) || 1);
  const unitPrice = parsePrice(line.unitPrice);
  const purchasePrice = parsePrice(line.purchasePrice);
  const taxPercentage = Math.max(0, parseFloat(line.taxPercentage) || 0);
  const { lineSubtotal, taxAmount, lineTotal } = computeInvoiceLineTotals(
    quantity,
    unitPrice,
    line.taxType,
    taxPercentage,
    line.taxMode
  );
  const tracksTax = line.taxType !== TaxType.NONE && taxPercentage > 0;

  const resolvedHsn = (hsnCode ?? line.hsnCode ?? '').trim();

  return {
    id: line.id,
    productId: line.isCustom ? '' : line.productId,
    productName,
    hsnCode: resolvedHsn || undefined,
    quantity,
    unitPrice,
    purchasePrice,
    taxType: tracksTax ? line.taxType : undefined,
    taxPercentage: tracksTax ? taxPercentage : undefined,
    taxMode: tracksTax ? line.taxMode : undefined,
    taxAmount: tracksTax ? taxAmount : undefined,
    lineSubtotal,
    lineTotal,
  };
}

export function deriveInvoiceStatusFromPayment(
  paymentStatus: PurchasePaymentStatus,
  current: InvoiceStatus
): InvoiceStatus {
  if (current === InvoiceStatus.VOID || current === InvoiceStatus.DRAFT) return current;
  if (paymentStatus === PurchasePaymentStatus.PAID) return InvoiceStatus.PAID;
  if (paymentStatus === PurchasePaymentStatus.PARTIAL) return InvoiceStatus.PARTIALLY_PAID;
  return InvoiceStatus.SENT;
}

export function invoiceToForm(invoice: Invoice): InvoiceFormState {
  return {
    invoiceDate: utcToLocalDateInput(invoice.invoiceDate),
    dueDate: invoice.dueDate ? utcToLocalDateInput(invoice.dueDate) : '',
    status: invoice.status,
    deliveryStatus: normalizeSaleStatus(invoice.deliveryStatus),
    trackingId: invoice.trackingId ?? '',
    carrier: invoice.carrier ?? '',
    customer: {
      mode: 'existing',
      customerId: invoice.customerId ?? '',
      name: invoice.customerName ?? '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
    },
    notes: invoice.notes ?? '',
    lines: invoice.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.productName ?? '',
      hsnCode: l.hsnCode ?? '',
      isCustom: !l.productId,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      purchasePrice: String(l.purchasePrice),
      taxType: l.taxType ?? TaxType.NONE,
      taxPercentage: String(l.taxPercentage ?? 0),
      taxMode: l.taxMode ?? TaxMode.INCLUSIVE,
    })),
  };
}

export function buildInvoiceFromForm(
  form: InvoiceFormState,
  companyId: string,
  products: Product[],
  customer: Customer | undefined,
  invoiceNumber: string,
  existing?: Invoice
): Invoice {
  const now = nowUtc();
  const lines = form.lines
    .filter(isInvoiceLineFilled)
    .map((l) => {
      if (l.isCustom) return lineFromForm(l, l.productName.trim() || 'Custom item');
      const product = products.find((p) => p.id === l.productId);
      return lineFromForm(l, product?.name ?? 'Unknown product', product?.hsnCode ?? l.hsnCode);
    });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxAmount = roundMoney(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const total = roundMoney(subtotal + taxAmount);
  const totalCogs = roundMoney(
    lines.reduce((s, l) => s + l.purchasePrice * l.quantity, 0)
  );
  const profit = roundMoney(total - totalCogs);

  const totalPaid = existing?.totalPaid ?? 0;
  const balanceDue = roundMoney(Math.max(0, total - totalPaid));
  const paymentStatus = derivePaymentStatus(total, totalPaid);
  const status =
    form.status === InvoiceStatus.VOID
      ? InvoiceStatus.VOID
      : form.status === InvoiceStatus.DRAFT
        ? InvoiceStatus.DRAFT
        : deriveInvoiceStatusFromPayment(paymentStatus, form.status);

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    invoiceNumber,
    invoiceDate: localDateInputToUtc(form.invoiceDate),
    dueDate: form.dueDate.trim() ? localDateInputToUtc(form.dueDate) : undefined,
    customerId: customer?.id,
    customerName: customer?.name,
    status,
    paymentStatus,
    deliveryStatus: normalizeSaleStatus(form.deliveryStatus),
    trackingId: form.trackingId.trim() || undefined,
    carrier: form.carrier.trim() || undefined,
    lines,
    subtotal,
    taxAmount,
    total,
    totalPaid,
    balanceDue,
    totalCogs,
    profit,
    notes: form.notes.trim() || undefined,
    stockApplied: existing?.stockApplied,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function computeInvoicePreview(form: InvoiceFormState, products: Product[]) {
  const lines = form.lines
    .filter(isInvoiceLineFilled)
    .map((l) => {
      if (l.isCustom) return lineFromForm(l, l.productName.trim() || 'Custom item');
      const product = products.find((p) => p.id === l.productId);
      return lineFromForm(l, product?.name ?? '', product?.hsnCode ?? l.hsnCode);
    });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const taxAmount = roundMoney(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const total = roundMoney(subtotal + taxAmount);
  const totalCogs = roundMoney(lines.reduce((s, l) => s + l.purchasePrice * l.quantity, 0));
  const profit = roundMoney(total - totalCogs);

  return { lines, subtotal, taxAmount, total, totalCogs, profit, lineCount: lines.length };
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.deleted && p.status === 'active');
}

export function shouldApplyInvoiceStock(invoice: Invoice): boolean {
  return (
    invoice.status !== InvoiceStatus.VOID &&
    invoice.status !== InvoiceStatus.DRAFT &&
    !invoice.stockApplied
  );
}
