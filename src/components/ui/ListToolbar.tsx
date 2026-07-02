import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../Input/Input';

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

/** Search + primary actions on the first row; filter controls on a separated second row. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  searchAriaLabel = 'Search',
  actions,
  filters,
}: ListToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            leftIcon={<Search className="w-4 h-4" />}
            aria-label={searchAriaLabel}
          />
        </div>
        {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
      </div>

      {filters ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700/80 pt-2">
          {filters}
        </div>
      ) : null}
    </div>
  );
}
