import { formatMoney } from '../../utils/profit';

interface InvoiceFormSummaryBarProps {
  subtotal: number;
  taxAmount: number;
  total: number;
  profit: number;
  lineCount: number;
  currency: string;
  className?: string;
}

function profitTone(value: number): string {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
}

export function InvoiceFormSummaryBar({
  subtotal,
  taxAmount,
  total,
  profit,
  lineCount,
  currency,
  className = '',
}: InvoiceFormSummaryBarProps) {
  const profitPositive = profit >= 0;

  return (
    <div className={`sticky top-0 z-20 lg:static ${className}`.trim()}>
      <div
        className={`rounded-lg border text-sm overflow-hidden ${
          profitPositive
            ? 'border-emerald-200/70 dark:border-emerald-800/40 bg-white dark:bg-gray-800'
            : 'border-red-200/70 dark:border-red-800/40 bg-white dark:bg-gray-800'
        }`}
      >
        <div className="flex flex-wrap items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-700">
          <div className="flex flex-1 min-w-[25%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Subtotal
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(subtotal, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[25%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Tax
            </p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-white">
              {formatMoney(taxAmount, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[25%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total
            </p>
            <p className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatMoney(total, currency)}
            </p>
          </div>
          <div className="flex flex-1 min-w-[25%] items-baseline justify-between gap-2 px-3 py-2 sm:block sm:min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Profit
            </p>
            <p className={`font-bold tabular-nums ${profitTone(profit)}`}>
              {formatMoney(profit, currency)}
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
