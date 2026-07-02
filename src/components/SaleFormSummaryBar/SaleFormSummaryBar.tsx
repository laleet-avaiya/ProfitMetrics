import type { LineEconomicsResult } from '../../utils/profit';
import { formatMoney, formatPercent } from '../../utils/profit';
import type { SalePreviewResult } from '../../utils/saleHelpers';

interface SaleFormSummaryBarProps {
  preview: LineEconomicsResult | SalePreviewResult;
  currency: string;
  itemCount: number;
  deliveryLabel: string;
  className?: string;
}

function profitTone(value: number): string {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
}

/** Compact order totals — sticky on mobile while filling the form. */
export function SaleFormSummaryBar({
  preview,
  currency,
  itemCount,
  deliveryLabel,
  className = '',
}: SaleFormSummaryBarProps) {
  const profitPositive = preview.profit >= 0;

  return (
    <div
      className={`sticky top-0 z-20 -mx-1 px-1 pb-2 pt-1 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm lg:static lg:mx-0 lg:px-0 lg:pb-0 lg:pt-0 lg:bg-transparent lg:backdrop-blur-none ${className}`.trim()}
    >
      <div
        className={`rounded-xl border shadow-sm overflow-hidden ${
          profitPositive
            ? 'border-emerald-200/80 dark:border-emerald-800/50 bg-white dark:bg-gray-800'
            : 'border-red-200/80 dark:border-red-800/50 bg-white dark:bg-gray-800'
        }`}
      >
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
          <div className="px-3 py-2.5 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Revenue
            </p>
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white truncate">
              {formatMoney(preview.grossRevenue, currency)}
            </p>
          </div>
          <div className="px-3 py-2.5 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Costs
            </p>
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white truncate">
              {formatMoney(preview.totalCosts, currency)}
            </p>
          </div>
          <div className="px-3 py-2.5 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Profit
            </p>
            <p className={`text-sm font-bold tabular-nums truncate ${profitTone(preview.profit)}`}>
              {formatMoney(preview.profit, currency)}
            </p>
            <p className={`text-[10px] tabular-nums ${profitTone(preview.profit)}`}>
              {formatPercent(preview.profitMarginPercent)}
            </p>
          </div>
        </div>
        <p className="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {preview.quantity} unit
          {preview.quantity === 1 ? '' : 's'} · {deliveryLabel}
        </p>
      </div>
    </div>
  );
}
