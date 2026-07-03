export const InvoicePrintFormat = {
  STANDARD: 'standard',
  PROFESSIONAL: 'professional',
} as const;

export type InvoicePrintFormat = (typeof InvoicePrintFormat)[keyof typeof InvoicePrintFormat];

export const INVOICE_PRINT_FORMAT_OPTIONS = [
  { value: InvoicePrintFormat.STANDARD, label: 'Standard' },
  { value: InvoicePrintFormat.PROFESSIONAL, label: 'Professional (grid)' },
] as const;

const STORAGE_KEY = 'invoicePrintFormat';

export function getStoredInvoicePrintFormat(): InvoicePrintFormat {
  if (typeof window === 'undefined') return InvoicePrintFormat.PROFESSIONAL;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === InvoicePrintFormat.STANDARD) return InvoicePrintFormat.STANDARD;
  if (stored === InvoicePrintFormat.PROFESSIONAL) return InvoicePrintFormat.PROFESSIONAL;
  return InvoicePrintFormat.PROFESSIONAL;
}

export function storeInvoicePrintFormat(format: InvoicePrintFormat): void {
  localStorage.setItem(STORAGE_KEY, format);
}
