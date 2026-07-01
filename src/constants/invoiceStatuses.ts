import { InvoiceStatus } from '../types';

export const INVOICE_STATUS_OPTIONS = [
  { value: InvoiceStatus.DRAFT, label: 'Draft' },
  { value: InvoiceStatus.SENT, label: 'Sent' },
  { value: InvoiceStatus.PARTIALLY_PAID, label: 'Partially paid' },
  { value: InvoiceStatus.PAID, label: 'Paid' },
  { value: InvoiceStatus.VOID, label: 'Void' },
] as const;

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function normalizeInvoiceStatus(status: InvoiceStatus | undefined): InvoiceStatus {
  if (status && INVOICE_STATUS_OPTIONS.some((o) => o.value === status)) return status;
  return InvoiceStatus.DRAFT;
}
