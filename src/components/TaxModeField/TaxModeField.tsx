import type { TaxMode } from '../../types';
import { TaxMode as TaxModeEnum } from '../../types';
import { fieldHintClass, fieldLabelClass } from '../../constants/ui';
import { isAmountTaxInclusive } from '../../utils/listingTax';

const optionBaseClass =
  'flex-1 min-w-[3.5rem] px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900';

const optionSelectedClass =
  'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm';

const optionUnselectedClass =
  'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200';

export interface TaxModeFieldProps {
  label?: string;
  value: TaxMode;
  onChange: (mode: TaxMode) => void;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  inclusiveLabel?: string;
  exclusiveLabel?: string;
  ariaLabel?: string;
}

export function TaxModeField({
  label = 'Tax mode',
  value,
  onChange,
  disabled = false,
  helperText,
  className = '',
  inclusiveLabel = 'Inclusive',
  exclusiveLabel = 'Exclusive',
  ariaLabel = 'Tax mode',
}: TaxModeFieldProps) {
  const isInclusive = isAmountTaxInclusive(value);

  const selectMode = (inclusive: boolean) => {
    if (disabled) return;
    onChange(inclusive ? TaxModeEnum.INCLUSIVE : TaxModeEnum.EXCLUSIVE);
  };

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      {label ? <p className={fieldLabelClass}>{label}</p> : null}
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled}
        className={`flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-100/90 dark:bg-gray-800/80 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <button
          type="button"
          role="radio"
          aria-checked={isInclusive}
          disabled={disabled}
          onClick={() => selectMode(true)}
          className={`${optionBaseClass} ${isInclusive ? optionSelectedClass : optionUnselectedClass}`}
        >
          {inclusiveLabel}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isInclusive}
          disabled={disabled}
          onClick={() => selectMode(false)}
          className={`${optionBaseClass} ${!isInclusive ? optionSelectedClass : optionUnselectedClass}`}
        >
          {exclusiveLabel}
        </button>
      </div>
      {helperText ? <p className={fieldHintClass}>{helperText}</p> : null}
    </div>
  );
}
