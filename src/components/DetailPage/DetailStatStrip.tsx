import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DetailStatItem {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon?: LucideIcon;
  tone?: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
  valueClassName?: string;
}

const toneStyles = {
  indigo: {
    card: 'border-indigo-200/70 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/30 dark:to-gray-800',
    icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
  },
  emerald: {
    card: 'border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-gray-800',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
  },
  amber: {
    card: 'border-amber-200/70 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/30 dark:to-gray-800',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
  },
  violet: {
    card: 'border-violet-200/70 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/90 to-white dark:from-violet-950/30 dark:to-gray-800',
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400',
  },
  rose: {
    card: 'border-rose-200/70 dark:border-rose-800/50 bg-gradient-to-br from-rose-50/90 to-white dark:from-rose-950/30 dark:to-gray-800',
    icon: 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400',
  },
  slate: {
    card: 'border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50/90 to-white dark:from-gray-900/40 dark:to-gray-800',
    icon: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
};

function gridClass(count: number): string {
  if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
}

export function DetailStatStrip({ stats }: { stats: DetailStatItem[] }) {
  if (stats.length === 0) return null;

  return (
    <div className={`grid gap-3 ${gridClass(stats.length)}`}>
      {stats.map((stat) => {
        const tone = stat.tone ?? 'slate';
        const styles = toneStyles[tone];
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className={`rounded-xl border p-4 ${styles.card}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {stat.label}
              </p>
              {Icon ? (
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
                  <Icon className="w-4 h-4" aria-hidden />
                </div>
              ) : null}
            </div>
            <p
              className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white ${stat.valueClassName ?? ''}`}
            >
              {stat.value}
            </p>
            {stat.subtext ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.subtext}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
