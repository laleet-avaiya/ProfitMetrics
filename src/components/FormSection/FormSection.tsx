import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface FormSectionProps {
  icon: LucideIcon;
  iconTone?: 'indigo' | 'emerald' | 'amber' | 'violet';
  title: string;
  description?: string;
  step?: number;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

const iconToneClasses = {
  indigo:
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 ring-1 ring-indigo-200/60 dark:ring-indigo-800/60',
  emerald:
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60',
  amber:
    'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-800/60',
  violet:
    'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400 ring-1 ring-violet-200/60 dark:ring-violet-800/60',
};

export function FormSection({
  icon: Icon,
  iconTone = 'indigo',
  title,
  description,
  step,
  children,
  className = '',
  headerAction,
}: FormSectionProps) {
  return (
    <section
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-3.5 border-b border-gray-100 dark:border-gray-700/80 bg-gradient-to-r from-gray-50/90 to-white dark:from-gray-900/50 dark:to-gray-800 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${iconToneClasses[iconTone]}`}
          >
            <Icon className="w-4 h-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            {step != null ? (
              <p className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">
                Step {step}
              </p>
            ) : null}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            {description ? (
              <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {headerAction ? (
          <div className="w-full sm:w-auto sm:shrink-0 [&>button]:w-full sm:[&>button]:w-auto">
            {headerAction}
          </div>
        ) : null}
      </div>
      <div className="p-3 sm:p-4 lg:p-5">{children}</div>
    </section>
  );
}
