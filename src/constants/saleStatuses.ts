import { SaleStatus, type SaleStatus as SaleStatusType } from '../types';

export const SALE_STATUS_OPTIONS: { value: SaleStatusType; label: string }[] = [
  { value: SaleStatus.PENDING, label: 'Pending' },
  { value: SaleStatus.SHIPPED, label: 'Shipped' },
  { value: SaleStatus.DELIVERED, label: 'Delivered' },
  { value: SaleStatus.RETURNED, label: 'Returned' },
  { value: SaleStatus.CANCELLED, label: 'Cancelled' },
];

export function saleStatusLabel(status: SaleStatusType | undefined): string {
  return SALE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Delivered';
}

export function normalizeSaleStatus(status: SaleStatusType | undefined): SaleStatusType {
  if (status && SALE_STATUS_OPTIONS.some((o) => o.value === status)) {
    return status;
  }
  return SaleStatus.DELIVERED;
}

export function saleStatusBadgeClass(status: SaleStatusType | undefined): string {
  switch (normalizeSaleStatus(status)) {
    case SaleStatus.PENDING:
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
    case SaleStatus.SHIPPED:
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    case SaleStatus.DELIVERED:
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
    case SaleStatus.RETURNED:
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    case SaleStatus.CANCELLED:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}
