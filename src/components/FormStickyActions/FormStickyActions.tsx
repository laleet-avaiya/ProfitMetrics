import type { ReactNode } from 'react';

interface FormStickyActionsProps {
  children: ReactNode;
  className?: string;
}

export function FormStickyActions({ children, className = '' }: FormStickyActionsProps) {
  return (
    <div className={`sticky bottom-0 z-10 pt-2 ${className}`.trim()}>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg shadow-gray-200/40 dark:shadow-black/20 px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
