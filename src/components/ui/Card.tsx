import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { statCardToneStyles, type StatCardTone } from '../../constants/statCardTones';
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

export interface StatCardProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  valueClassName?: string;
  tone?: StatCardTone;
  icon?: LucideIcon;
  compact?: boolean;
}

export function StatCard({
  label,
  value,
  subtext,
  valueClassName = '',
  tone = 'slate',
  icon: Icon,
  compact = false,
}: StatCardProps) {
  const styles = statCardToneStyles[tone];

  return (
    <div className={`rounded-xl border ${compact ? 'p-3' : 'p-4'} ${styles.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={`font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {label}
        </p>
        {Icon ? (
          <div
            className={`flex shrink-0 items-center justify-center rounded-lg ${
              compact ? 'h-7 w-7' : 'h-8 w-8'
            } ${styles.icon}`}
          >
            <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden />
          </div>
        ) : null}
      </div>
      <p
        className={`mt-1.5 font-bold tabular-nums tracking-tight text-gray-900 dark:text-white ${
          compact ? 'text-sm' : 'text-xl'
        } ${valueClassName}`}
      >
        {value}
      </p>
      {subtext ? (
        <p
          className={`text-gray-500 dark:text-gray-400 mt-1 ${
            compact ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {subtext}
        </p>
      ) : null}
    </div>
  );
}
