import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  emptyStateActionClass,
  emptyStateDescriptionClass,
  emptyStateIconClass,
  emptyStateTitleClass,
  emptyStateWrapClass,
} from '../../constants/ui';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`${emptyStateWrapClass} ${className}`.trim()}>
      <Icon className={emptyStateIconClass} aria-hidden />
      <p className={emptyStateTitleClass}>{title}</p>
      <p className={emptyStateDescriptionClass}>{description}</p>
      {action ? <div className={emptyStateActionClass}>{action}</div> : null}
    </div>
  );
}
