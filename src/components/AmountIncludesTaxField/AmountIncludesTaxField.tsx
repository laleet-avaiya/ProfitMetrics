import type { TaxMode } from '../../types';
import { TaxModeField, type TaxModeFieldProps } from '../TaxModeField/TaxModeField';

type AmountIncludesTaxFieldProps = Omit<
  TaxModeFieldProps,
  'label' | 'inclusiveLabel' | 'exclusiveLabel' | 'ariaLabel'
>;

export function AmountIncludesTaxField(props: AmountIncludesTaxFieldProps) {
  return (
    <TaxModeField
      {...props}
      label="Amount includes TAX?"
      inclusiveLabel="Yes"
      exclusiveLabel="No"
      ariaLabel="Amount includes tax"
    />
  );
}

export type { TaxMode };
