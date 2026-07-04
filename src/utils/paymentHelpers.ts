import type { Customer, Invoice, Payment, Sale } from '../types';
import { PaymentKind, PaymentMode } from '../types';
import { paymentKindLabel as paymentKindLabelFromConstants } from '../constants/paymentKinds';
import { derivePaymentStatus } from './purchaseHelpers';
import { deriveInvoiceStatusFromPayment } from './invoiceHelpers';
import { getSaleCustomerName } from './customerHelpers';
import { createListingId } from './productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from './firestoreDates';
import { firestoreService } from '../services/firestore';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PaymentFormState {
  paymentDate: string;
  amount: string;
  kind: PaymentKind;
  paymentMode: PaymentMode;
  invoiceId: string;
  saleId: string;
  customerId: string;
  platform: string;
  reference: string;
  notes: string;
}

export function emptyPaymentForm(kind: PaymentKind = PaymentKind.DIRECT): PaymentFormState {
  return {
    paymentDate: utcToLocalDateInput(new Date()),
    amount: '',
    kind,
    paymentMode: PaymentMode.CASH,
    invoiceId: '',
    saleId: '',
    customerId: '',
    platform: '',
    reference: '',
    notes: '',
  };
}

export function paymentToForm(payment: Payment): PaymentFormState {
  return {
    paymentDate: utcToLocalDateInput(payment.paymentDate),
    amount: String(payment.amount),
    kind: payment.kind,
    paymentMode: payment.paymentMode ?? PaymentMode.CASH,
    invoiceId: payment.invoiceId ?? '',
    saleId: payment.saleId ?? '',
    customerId: payment.customerId ?? '',
    platform: payment.platform ?? '',
    reference: payment.reference ?? '',
    notes: payment.notes ?? '',
  };
}

function saleReference(sale?: Sale | null): string | undefined {
  if (!sale) return undefined;
  return sale.orderNumber ?? sale.orderId ?? undefined;
}

export function buildPaymentFromForm(
  form: PaymentFormState,
  companyId: string,
  invoice?: Invoice | null,
  customer?: Customer | null,
  existing?: Payment,
  sale?: Sale | null
): Payment {
  const now = nowUtc();
  const amount = roundMoney(Math.max(0, parseFloat(form.amount) || 0));

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    paymentDate: localDateInputToUtc(form.paymentDate),
    amount,
    kind: form.kind,
    paymentMode: form.paymentMode,
    invoiceId:
      form.kind === PaymentKind.INVOICE
        ? (invoice?.id ?? (form.invoiceId || undefined))
        : undefined,
    invoiceNumber: form.kind === PaymentKind.INVOICE ? invoice?.invoiceNumber : undefined,
    saleId:
      form.kind === PaymentKind.SALE ? (sale?.id ?? (form.saleId || undefined)) : undefined,
    saleOrderNumber: form.kind === PaymentKind.SALE ? saleReference(sale) : undefined,
    customerId:
      (customer?.id ?? invoice?.customerId ?? sale?.customerId ?? form.customerId) || undefined,
    customerName:
      customer?.name ?? invoice?.customerName ?? (sale ? getSaleCustomerName(sale) : undefined),
    platform:
      form.kind === PaymentKind.MARKETPLACE_PAYOUT
        ? form.platform.trim() || undefined
        : undefined,
    reference: form.reference.trim() || undefined,
    notes: form.notes.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Recompute invoice paid totals from all linked payments. */
export async function syncInvoicePaymentRollup(
  companyId: string,
  invoiceId: string,
  userId: string
): Promise<Invoice | null> {
  const invoice = await firestoreService.invoices.get(companyId, invoiceId);
  if (!invoice || invoice.deleted) return null;

  const allPayments = await firestoreService.payments.getAll(companyId);
  const linked = allPayments.filter(
    (p) => !p.deleted && p.invoiceId === invoiceId && p.kind === PaymentKind.INVOICE
  );

  const totalPaid = roundMoney(linked.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(Math.max(0, invoice.total - totalPaid));
  const paymentStatus = derivePaymentStatus(invoice.total, totalPaid);
  const status = deriveInvoiceStatusFromPayment(paymentStatus, invoice.status);

  const updated: Partial<Invoice> = {
    totalPaid,
    balanceDue,
    paymentStatus,
    status,
    updatedAt: nowUtc(),
  };

  await firestoreService.invoices.update(companyId, invoiceId, updated, userId);
  return { ...invoice, ...updated };
}

/** Recompute a sale's paid totals from all linked payments. */
export async function syncSalePaymentRollup(
  companyId: string,
  saleId: string,
  userId: string
): Promise<Sale | null> {
  const sale = await firestoreService.sales.get(companyId, saleId);
  if (!sale || sale.deleted) return null;

  const allPayments = await firestoreService.payments.getAll(companyId);
  const linked = allPayments.filter(
    (p) => !p.deleted && p.saleId === saleId && p.kind === PaymentKind.SALE
  );

  const total = sale.total ?? sale.grossRevenue;
  const totalPaid = roundMoney(linked.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(Math.max(0, total - totalPaid));
  const paymentStatus = derivePaymentStatus(total, totalPaid);

  const updated: Partial<Sale> = {
    total,
    totalPaid,
    balanceDue,
    paymentStatus,
    updatedAt: nowUtc(),
  };

  await firestoreService.sales.update(companyId, saleId, updated, userId);
  return { ...sale, ...updated };
}

export function getPaymentDisplaySource(payment: Payment): string {
  if (payment.kind === PaymentKind.INVOICE && payment.invoiceNumber) {
    return `Invoice ${payment.invoiceNumber}`;
  }
  if (payment.kind === PaymentKind.SALE && payment.saleOrderNumber) {
    return `Order ${payment.saleOrderNumber}`;
  }
  if (payment.kind === PaymentKind.MARKETPLACE_PAYOUT && payment.platform) {
    return payment.platform;
  }
  if (payment.customerName) return payment.customerName;
  return paymentKindLabelFromConstants(payment.kind);
}

export { paymentKindLabelFromConstants as paymentKindLabel };
