import { CalendarRange } from 'lucide-react';
import { Input } from '../Input/Input';
import { Card } from '../ui/Card';
import { FormTabs } from '../ui/FormTabs';
import type { ReportPreset } from '../../utils/reports';

const PRESET_TABS: { id: ReportPreset; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

interface ReportDateFiltersProps {
  preset: ReportPreset;
  onPresetChange: (preset: ReportPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  rangeLabel: string;
}

export function ReportDateFilters({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  rangeLabel,
}: ReportDateFiltersProps) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FormTabs
          tabs={PRESET_TABS.map((tab) => ({ ...tab, icon: tab.id === 'custom' ? CalendarRange : undefined }))}
          active={preset}
          onChange={(id) => onPresetChange(id as ReportPreset)}
          ariaLabel="Report date range"
          className="w-full sm:w-auto"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0 sm:text-right">
          {rangeLabel}
        </p>
      </div>

      {preset === 'custom' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md border-t border-gray-100 dark:border-gray-700/80 pt-3">
          <Input
            label="From"
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
          />
        </div>
      ) : null}
    </Card>
  );
}
