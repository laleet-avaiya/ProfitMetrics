import type { Customer, Invoice, Payment } from '../types';
import { PaymentKind } from '../types';
import { paymentKindLabel as paymentKindLabelFromConstants } from '../constants/paymentKinds';
import { derivePaymentStatus } from './purchaseHelpers';
import { deriveInvoiceStatusFromPayment } from './invoiceHelpers';
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
  invoiceId: string;
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
    invoiceId: '',
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
    invoiceId: payment.invoiceId ?? '',
    customerId: payment.customerId ?? '',
    platform: payment.platform ?? '',
    reference: payment.reference ?? '',
    notes: payment.notes ?? '',
  };
}

export function buildPaymentFromForm(
  form: PaymentFormState,
  companyId: string,
  invoice?: Invoice | null,
  customer?: Customer | null,
  existing?: Payment
): Payment {
  const now = nowUtc();
  const amount = roundMoney(Math.max(0, parseFloat(form.amount) || 0));

  return {
    id: existing?.id ?? createListingId(),
    companyId,
    paymentDate: localDateInputToUtc(form.paymentDate),
    amount,
    kind: form.kind,
    invoiceId:
      form.kind === PaymentKind.INVOICE
        ? (invoice?.id ?? (form.invoiceId || undefined))
        : undefined,
    invoiceNumber: invoice?.invoiceNumber,
    customerId: (customer?.id ?? invoice?.customerId ?? form.customerId) || undefined,
    customerName: customer?.name ?? invoice?.customerName,
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
  invoiceId: string
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

  await firestoreService.invoices.update(companyId, invoiceId, updated);
  return { ...invoice, ...updated };
}

export function getPaymentDisplaySource(payment: Payment): string {
  if (payment.kind === PaymentKind.INVOICE && payment.invoiceNumber) {
    return `Invoice ${payment.invoiceNumber}`;
  }
  if (payment.kind === PaymentKind.MARKETPLACE_PAYOUT && payment.platform) {
    return payment.platform;
  }
  if (payment.customerName) return payment.customerName;
  return paymentKindLabelFromConstants(payment.kind);
}

export { paymentKindLabelFromConstants as paymentKindLabel };
