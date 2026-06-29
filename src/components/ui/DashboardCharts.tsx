import { formatMoney } from '../../utils/profit';
import type { TrendRow } from '../../utils/reports';
import { emptyStateMessageClass } from '../../constants/ui';

interface NetProfitTrendChartProps {
  data: TrendRow[];
  currency: string;
}

function barColor(value: number): string {
  if (value > 0) return 'bg-emerald-500 dark:bg-emerald-400';
  if (value < 0) return 'bg-red-500 dark:bg-red-400';
  return 'bg-gray-300 dark:bg-gray-600';
}

export function NetProfitTrendChart({ data, currency }: NetProfitTrendChartProps) {
  if (data.length === 0) return null;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.netProfit)), 1);
  const showValues = data.length <= 14;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 sm:gap-1.5 h-36">
        {data.map((row) => {
          const heightPct = Math.max(4, (Math.abs(row.netProfit) / maxAbs) * 100);
          return (
            <div
              key={row.key}
              className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group"
              title={`${row.label}: ${formatMoney(row.netProfit, currency)}`}
            >
              {showValues && row.netProfit !== 0 && (
                <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-full">
                  {formatMoney(row.netProfit, currency)}
                </span>
              )}
              <div
                className={`w-full max-w-8 mx-auto rounded-t ${barColor(row.netProfit)} transition-all`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-1.5">
        {data.map((row) => (
          <p
            key={row.key}
            className="flex-1 min-w-0 text-[10px] sm:text-xs text-center text-gray-500 dark:text-gray-400 truncate"
          >
            {row.label}
          </p>
        ))}
      </div>
    </div>
  );
}

interface HorizontalBarListProps {
  items: { label: string; value: number; sublabel?: string }[];
  currency: string;
  valueFormatter?: (value: number) => string;
}

export function HorizontalBarList({
  items,
  currency,
  valueFormatter,
}: HorizontalBarListProps) {
  if (items.length === 0) {
    return <p className={emptyStateMessageClass}>No data for this period</p>;
  }

  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const format = valueFormatter ?? ((v: number) => formatMoney(v, currency));

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {item.label}
            </span>
            <span
              className={`text-sm tabular-nums shrink-0 ${
                item.value >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {format(item.value)}
            </span>
          </div>
          {item.sublabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.sublabel}</p>
          )}
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                item.value >= 0 ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.max(4, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
