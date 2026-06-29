import { Input } from '../Input/Input';
import { FilterSelect } from '../ui/FilterSelect';
import { Card } from '../ui/Card';
import { filterRowClass, sectionDescriptionClass, sectionTitleClass } from '../../constants/ui';
import type { ReportPreset } from '../../utils/reports';

const PRESET_OPTIONS: { value: ReportPreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
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
      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
        <div>
          <p className={sectionTitleClass}>Date range</p>
          <p className={sectionDescriptionClass}>{rangeLabel}</p>
        </div>
        <div className={filterRowClass}>
          <FilterSelect
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as ReportPreset)}
            aria-label="Report date preset"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          {preset === 'custom' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                label="From"
                type="date"
                value={customFrom}
                onChange={(e) => onCustomFromChange(e.target.value)}
                fullWidth={false}
              />
              <Input
                label="To"
                type="date"
                value={customTo}
                onChange={(e) => onCustomToChange(e.target.value)}
                fullWidth={false}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
