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

export function normalizeSalePaymentStatus(
  status: PurchasePaymentStatus | undefined
): PurchasePaymentStatus {
  if (status && PURCHASE_PAYMENT_STATUS_OPTIONS.some((o) => o.value === status)) {
    return status;
  }
  return PurchasePaymentStatus.UNPAID;
}

export function salePaymentStatusBadgeClass(status: PurchasePaymentStatus | undefined): string {
  switch (normalizeSalePaymentStatus(status)) {
    case PurchasePaymentStatus.PAID:
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
    case PurchasePaymentStatus.PARTIAL:
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
    default:
      return 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200';
  }
}
