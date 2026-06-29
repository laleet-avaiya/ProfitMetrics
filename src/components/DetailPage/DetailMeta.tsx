import type { ReactNode } from 'react';

const chipToneClasses = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200 ring-1 ring-gray-200/80 dark:ring-gray-600/80',
  indigo:
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 ring-1 ring-indigo-200/80 dark:ring-indigo-800/60',
  emerald:
    'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-200/80 dark:ring-emerald-800/60',
  amber:
    'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-200/80 dark:ring-amber-800/60',
  rose: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-rose-200/80 dark:ring-rose-800/60',
};

interface DetailMetaRowProps {
  children: ReactNode;
  className?: string;
}

export function DetailMetaRow({ children, className = '' }: DetailMetaRowProps) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>{children}</div>;
}

interface DetailMetaChipProps {
  children: ReactNode;
  tone?: keyof typeof chipToneClasses;
  icon?: ReactNode;
}

export function DetailMetaChip({ children, tone = 'gray', icon }: DetailMetaChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${chipToneClasses[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

interface DetailNotesProps {
  label?: string;
  children: ReactNode;
}

export function DetailNotes({ label = 'Notes', children }: DetailNotesProps) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200/80 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}
