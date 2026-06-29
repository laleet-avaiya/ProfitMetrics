import { useMemo, type ReactNode, type SelectHTMLAttributes } from 'react';
import { filterSelectControlClass, filterSelectWideControlClass } from '../../constants/ui';
import {
  optionsFromSelectChildren,
  SearchableSelect,
} from '../SearchableSelect/SearchableSelect';

interface FilterSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  className?: string;
  wide?: boolean;
  children: ReactNode;
}

/** Compact searchable select for toolbars and filters. */
export function FilterSelect({
  className = '',
  wide = false,
  children,
  value,
  disabled,
  required,
  name,
  id,
  onChange,
  'aria-label': ariaLabel,
}: FilterSelectProps) {
  const options = useMemo(() => optionsFromSelectChildren(children), [children]);
  const stringValue = value != null ? String(value) : '';

  return (
    <SearchableSelect
      id={id}
      name={name}
      options={options}
      value={stringValue}
      onChange={onChange}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      placeholder={options[0]?.label ?? 'Select…'}
      controlClassName={`${wide ? filterSelectWideControlClass : filterSelectControlClass} ${className}`.trim()}
    />
  );
}
