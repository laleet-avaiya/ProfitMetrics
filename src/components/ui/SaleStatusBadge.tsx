import { normalizeSaleStatus, saleStatusBadgeClass, saleStatusLabel } from '../../constants/saleStatuses';
import type { SaleStatus } from '../../types';

interface SaleStatusBadgeProps {
  status: SaleStatus | undefined;
}

export function SaleStatusBadge({ status }: SaleStatusBadgeProps) {
  const normalized = normalizeSaleStatus(status);
  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${saleStatusBadgeClass(normalized)}`}
    >
      {saleStatusLabel(normalized)}
    </span>
  );
}
