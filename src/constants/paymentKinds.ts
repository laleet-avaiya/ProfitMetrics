import { PaymentKind } from '../types';

export const PAYMENT_KIND_OPTIONS = [
  { value: PaymentKind.INVOICE, label: 'Invoice payment' },
  { value: PaymentKind.SALE, label: 'Sale payment' },
  { value: PaymentKind.DIRECT, label: 'Direct payment' },
  { value: PaymentKind.MARKETPLACE_PAYOUT, label: 'Marketplace payout' },
] as const;

export function paymentKindLabel(kind: PaymentKind): string {
  return PAYMENT_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}
