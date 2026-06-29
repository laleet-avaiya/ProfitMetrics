import type { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function DetailField({ label, value, className = '', valueClassName = '' }: DetailFieldProps) {
  const empty = value == null || value === '';
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-sm text-gray-900 dark:text-white break-words ${empty ? 'text-gray-400 dark:text-gray-500' : ''} ${valueClassName}`}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

interface DetailGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
}

export function DetailGrid({ children, columns = 2 }: DetailGridProps) {
  const cols =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : columns === 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2';

  return <dl className={`grid ${cols} gap-x-4 gap-y-5`}>{children}</dl>;
}

export const detailLinkClass =
  'font-medium text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2';
