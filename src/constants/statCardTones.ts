export type StatCardTone = 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

export const statCardToneStyles: Record<
  StatCardTone,
  { card: string; icon: string }
> = {
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
