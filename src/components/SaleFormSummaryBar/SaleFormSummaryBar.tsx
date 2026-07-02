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
      className={`sticky top-0 z-20 lg:static ${className}`.trim()}
    >
      <div
        className={`rounded-lg border text-sm overflow-hidden ${
          profitPositive
            ? 'border-emerald-200/70 dark:border-emerald-800/40 bg-white dark:bg-gray-800'
            : 'border-red-200/70 dark:border-red-800/40 bg-white dark:bg-gray-800'
        }`}
      >
        <div className="flex flex-wrap items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-700">
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Revenue
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(preview.grossRevenue, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Costs
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(preview.totalCosts, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Profit
            </p>
            <div className="text-right sm:text-left">
              <p className={`font-bold tabular-nums ${profitTone(preview.profit)}`}>
                {formatMoney(preview.profit, currency)}
              </p>
              <p className={`text-[10px] tabular-nums ${profitTone(preview.profit)}`}>
                {formatPercent(preview.profitMarginPercent)}
              </p>
            </div>
          </div>
        </div>
        <p className="px-3 py-1 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {preview.quantity} unit
          {preview.quantity === 1 ? '' : 's'} · {deliveryLabel}
        </p>
      </div>
    </div>
  );
}
