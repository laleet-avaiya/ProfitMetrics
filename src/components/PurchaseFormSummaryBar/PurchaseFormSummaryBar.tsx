import { formatMoney } from '../../utils/profit';

interface PurchaseFormSummaryBarProps {
  subtotal: number;
  taxAmount: number;
  total: number;
  lineCount: number;
  currency: string;
  className?: string;
}

export function PurchaseFormSummaryBar({
  subtotal,
  taxAmount,
  total,
  lineCount,
  currency,
  className = '',
}: PurchaseFormSummaryBarProps) {
  return (
    <div className={`sticky top-0 z-20 lg:static ${className}`.trim()}>
      <div className="rounded-lg border border-indigo-200/70 dark:border-indigo-800/40 bg-white dark:bg-gray-800 text-sm overflow-hidden">
        <div className="flex flex-wrap items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-700">
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Subtotal
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(subtotal, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Tax
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(taxAmount, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[33%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total
            </p>
            <p className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatMoney(total, currency)}
            </p>
          </div>
        </div>
        <p className="px-3 py-1 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30">
          {lineCount} line{lineCount === 1 ? '' : 's'} with products
        </p>
      </div>
    </div>
  );
}
