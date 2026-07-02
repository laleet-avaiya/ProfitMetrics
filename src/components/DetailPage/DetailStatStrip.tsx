import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StatCardTone } from '../../constants/statCardTones';
import { StatCard } from '../ui/Card';

export interface DetailStatItem {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon?: LucideIcon;
  tone?: StatCardTone;
  valueClassName?: string;
}

function gridClass(count: number): string {
  if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
}

export function DetailStatStrip({ stats }: { stats: DetailStatItem[] }) {
  if (stats.length === 0) return null;

  return (
    <div className={`grid gap-3 ${gridClass(stats.length)}`}>
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          subtext={stat.subtext}
          icon={stat.icon}
          tone={stat.tone}
          valueClassName={stat.valueClassName}
        />
      ))}
    </div>
  );
}
