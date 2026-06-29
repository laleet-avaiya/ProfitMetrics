import { type SelectHTMLAttributes } from 'react';
import {
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  selectControlClass,
} from '../../constants/ui';
import { SearchableSelect } from '../SearchableSelect/SearchableSelect';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({
  label,
  error,
  helperText,
  fullWidth = true,
  options,
  className = '',
  value,
  disabled,
  required,
  name,
  id,
  onChange,
}: SelectProps) {
  const stringValue = value != null ? String(value) : '';

  return (
    <div className={`${fullWidth ? 'w-full min-w-0' : 'w-auto shrink-0'} ${className}`.trim()}>
      {label && (
        <label className={fieldLabelClass} htmlFor={id}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <SearchableSelect
        id={id}
        name={name}
        options={options}
        value={stringValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        placeholder={options.find((o) => o.value === '')?.label ?? 'Select…'}
        controlClassName={`${selectControlClass} ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
      />
      {error && <p className={fieldErrorClass}>{error}</p>}
      {helperText && !error && <p className={fieldHintClass}>{helperText}</p>}
    </div>
  );
}
