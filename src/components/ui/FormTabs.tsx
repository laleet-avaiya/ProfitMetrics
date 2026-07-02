import type { LucideIcon } from 'lucide-react';

export interface FormTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface FormTabsProps {
  tabs: FormTabItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export function FormTabs({ tabs, active, onChange, ariaLabel, className = '' }: FormTabsProps) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 overflow-x-auto ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              selected
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/80 dark:ring-gray-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
            {tab.label}
            {tab.badge != null ? (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                  selected
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'bg-gray-200/80 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
