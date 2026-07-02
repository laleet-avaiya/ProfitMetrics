import { Input } from '../Input/Input';
import { fieldLabelClass } from '../../constants/ui';
import { formatMoney } from '../../utils/profit';

interface PaymentAmountFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  pendingAmount: number;
  currency?: string;
  placeholder?: string;
  required?: boolean;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function PaymentAmountField({
  label = 'Amount',
  value,
  onChange,
  pendingAmount,
  currency = 'AED',
  placeholder,
  required,
}: PaymentAmountFieldProps) {
  const canFillPending = pendingAmount > 0;

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className={fieldLabelClass}>
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : null}
        </label>
        {canFillPending ? (
          <button
            type="button"
            onClick={() => onChange(String(roundMoney(pendingAmount)))}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 shrink-0"
          >
            Fill pending ({formatMoney(pendingAmount, currency)})
          </button>
        ) : null}
      </div>
      <Input
        label={undefined}
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (canFillPending ? String(roundMoney(pendingAmount)) : undefined)}
        required={required}
      />
    </div>
  );
}
