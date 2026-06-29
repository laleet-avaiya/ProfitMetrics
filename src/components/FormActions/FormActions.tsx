import type { ReactNode } from 'react';

interface FormActionsProps {
  children: ReactNode;
  layout?: 'stack' | 'end';
  className?: string;
}

const layoutClasses = {
  stack: 'flex flex-col gap-2',
  end: 'flex flex-col-reverse sm:flex-row sm:justify-end gap-2',
};

export function FormActions({ children, layout = 'stack', className = '' }: FormActionsProps) {
  return (
    <div className={`pt-4 ${layoutClasses[layout]} ${className}`.trim()}>{children}</div>
  );
}
