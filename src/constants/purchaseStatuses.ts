import { PurchaseOrderStatus, PurchasePaymentStatus } from '../types';

export const PURCHASE_STATUS_OPTIONS = [
  { value: PurchaseOrderStatus.DRAFT, label: 'Draft' },
  { value: PurchaseOrderStatus.ORDERED, label: 'Ordered' },
  { value: PurchaseOrderStatus.PARTIALLY_RECEIVED, label: 'Partially received' },
  { value: PurchaseOrderStatus.RECEIVED, label: 'Received' },
  { value: PurchaseOrderStatus.CANCELLED, label: 'Cancelled' },
] as const;

export const PURCHASE_PAYMENT_STATUS_OPTIONS = [
  { value: PurchasePaymentStatus.UNPAID, label: 'Unpaid' },
  { value: PurchasePaymentStatus.PARTIAL, label: 'Partially paid' },
  { value: PurchasePaymentStatus.PAID, label: 'Paid' },
] as const;

export function purchaseStatusLabel(status: PurchaseOrderStatus): string {
  return PURCHASE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function purchasePaymentStatusLabel(status: PurchasePaymentStatus): string {
  return PURCHASE_PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function normalizePurchaseStatus(
  status: PurchaseOrderStatus | undefined
): PurchaseOrderStatus {
  if (status && PURCHASE_STATUS_OPTIONS.some((o) => o.value === status)) {
    return status;
  }
  return PurchaseOrderStatus.DRAFT;
}
