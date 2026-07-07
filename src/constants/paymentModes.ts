import { PaymentMode } from '../types';

export const PAYMENT_MODE_OPTIONS = [
  { value: PaymentMode.CASH, label: 'Cash' },
  { value: PaymentMode.BANK_ACCOUNT, label: 'Bank account' },
] as const;

export const SALE_PAYMENT_MODE_OPTIONS = [
  { value: '', label: 'Select payment mode…' },
  ...PAYMENT_MODE_OPTIONS,
] as const;

export function paymentModeLabel(mode: PaymentMode | undefined): string {
  if (mode === PaymentMode.CASH) return 'Cash';
  if (mode === PaymentMode.BANK_ACCOUNT) return 'Bank account';
  return 'None';
}
