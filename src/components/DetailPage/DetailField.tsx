import type { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function DetailField({ label, value, className = '' }: DetailFieldProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-white break-words">{value ?? '—'}</dd>
    </div>
  );
}

interface DetailGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}

export function DetailGrid({ children, columns = 2 }: DetailGridProps) {
  const cols =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  return <dl className={`grid ${cols} gap-4`}>{children}</dl>;
}
