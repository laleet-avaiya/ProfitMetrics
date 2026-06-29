import type { TaxMode } from '../../types';
import { fieldHintClass, fieldLabelClass } from '../../constants/ui';
import { isAmountTaxInclusive, taxModeFromAmountIncludesTax } from '../../utils/listingTax';

interface AmountIncludesTaxFieldProps {
  value: TaxMode;
  onChange: (mode: TaxMode) => void;
  disabled?: boolean;
  helperText?: string;
  className?: string;
}

const optionBaseClass =
  'flex-1 min-w-[3.5rem] px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900';

const optionSelectedClass =
  'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm';

const optionUnselectedClass =
  'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200';

export function AmountIncludesTaxField({
  value,
  onChange,
  disabled = false,
  helperText,
  className = '',
}: AmountIncludesTaxFieldProps) {
  const includesTax = isAmountTaxInclusive(value);

  const setIncludes = (includes: boolean) => {
    if (disabled) return;
    onChange(taxModeFromAmountIncludesTax(includes));
  };

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      <p className={fieldLabelClass}>Amount includes TAX?</p>
      <div
        role="radiogroup"
        aria-label="Amount includes tax"
        aria-disabled={disabled}
        className={`flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-100/90 dark:bg-gray-800/80 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <button
          type="button"
          role="radio"
          aria-checked={includesTax}
          disabled={disabled}
          onClick={() => setIncludes(true)}
          className={`${optionBaseClass} ${
            includesTax ? optionSelectedClass : optionUnselectedClass
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!includesTax}
          disabled={disabled}
          onClick={() => setIncludes(false)}
          className={`${optionBaseClass} ${
            !includesTax ? optionSelectedClass : optionUnselectedClass
          }`}
        >
          No
        </button>
      </div>
      {helperText ? <p className={fieldHintClass}>{helperText}</p> : null}
    </div>
  );
}
