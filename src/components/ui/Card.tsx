import type { ReactNode } from 'react';
import { cardClass, cardPaddingClass, sectionDescriptionClass, sectionTitleClass } from '../../constants/ui';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`${cardClass} ${padding ? cardPaddingClass : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className={sectionTitleClass}>{title}</h2>
        {description ? <p className={sectionDescriptionClass}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  valueClassName?: string;
}

export function StatCard({ label, value, subtext, valueClassName = '' }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white ${valueClassName}`}>
        {value}
      </p>
      {subtext ? <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtext}</p> : null}
    </Card>
  );
}
