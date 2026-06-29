import { Input } from '../Input/Input';
import { AmountIncludesTaxField } from '../AmountIncludesTaxField/AmountIncludesTaxField';
import { SectionHeading, SectionLinePreview } from '../SectionLinePreview/SectionLinePreview';
import type { TaxMode } from '../../types';

interface OutcomeChargeFieldsProps {
  title: string;
  description: string;
  amountLabel: string;
  amount: number;
  onAmountChange: (value: number) => void;
  taxPercentage: number;
  onTaxPercentageChange: (value: number) => void;
  taxMode: TaxMode;
  onTaxModeChange: (mode: TaxMode) => void;
  tracksTax: boolean;
  pctLabel: string;
  currency: string;
  previewBase: number;
  previewTax: number;
  perUnit?: boolean;
}

export function OutcomeChargeFields({
  title,
  description,
  amountLabel,
  amount,
  onAmountChange,
  taxPercentage,
  onTaxPercentageChange,
  taxMode,
  onTaxModeChange,
  tracksTax,
  pctLabel,
  currency,
  previewBase,
  previewTax,
  perUnit = false,
}: OutcomeChargeFieldsProps) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
      <SectionHeading title={title} description={description} />
      <div className="space-y-3">
        <Input
          label={amountLabel}
          type="number"
          min="0"
          step="0.01"
          value={amount || ''}
          onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={pctLabel}
            type="number"
            min="0"
            step="0.01"
            disabled={!tracksTax}
            value={taxPercentage || ''}
            onChange={(e) => onTaxPercentageChange(parseFloat(e.target.value) || 0)}
          />
          <AmountIncludesTaxField
            value={taxMode}
            disabled={!tracksTax}
            onChange={onTaxModeChange}
          />
        </div>
      </div>
      <SectionLinePreview
        amountLabel="Cost (ex-tax)"
        amount={previewBase}
        taxDirection="credit"
        taxAmount={previewTax}
        currency={currency}
        tracksTax={tracksTax}
        perUnit={perUnit}
      />
    </div>
  );
}
