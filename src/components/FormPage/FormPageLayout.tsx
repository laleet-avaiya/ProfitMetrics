import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Standard form wrapper — consistent spacing and mobile bottom padding. */
export function FormPageBody({
  id,
  onSubmit,
  children,
  className = '',
}: {
  id: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className={`w-full space-y-3 pb-20 lg:pb-0 ${className}`.trim()}
    >
      {children}
    </form>
  );
}

/** Bordered content panel used for tab panels and simple single-page forms. */
export function FormPanel({
  children,
  className = '',
  role,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 min-h-[8rem] ${className}`.trim()}
      role={role}
    >
      {children}
    </div>
  );
}

/** Main column + optional sticky sidebar (desktop). Without sidebar, content stays full width. */
export function FormPageGrid({
  children,
  sidebar,
  compact,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  /** Narrower max width for simple forms */
  compact?: boolean;
}) {
  if (!sidebar) {
    return (
      <div className={compact ? 'max-w-3xl' : undefined}>{children}</div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] gap-3 lg:gap-4 lg:items-start">
      {children}
      <aside className="hidden lg:block lg:sticky lg:top-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
        {sidebar}
      </aside>
    </div>
  );
}

/** Optional strip above tabs / panel — totals, title, counts. */
export function FormSummaryStrip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

/** Subtle divider between field groups inside a single panel. */
export function FormFieldGroup({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {title ? (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p>
          {description ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function FormFieldGroupDivider() {
  return <hr className="my-4 border-gray-100 dark:border-gray-700/80" />;
}

export function FormReadyBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
      <p className="text-xs text-emerald-800 dark:text-emerald-300">{children}</p>
    </div>
  );
}

export function FormSidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="text-sm space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}

export function FormSidebarRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span
        className={`tabular-nums shrink-0 ${emphasize ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
