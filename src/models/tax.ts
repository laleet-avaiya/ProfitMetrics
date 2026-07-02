export const TaxType = {
  NONE: 'none',
  VAT: 'vat',
  GST: 'gst',
  SALES_TAX: 'sales_tax',
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const TaxMode = {
  INCLUSIVE: 'inclusive',
  EXCLUSIVE: 'exclusive',
  PASS_THROUGH: 'pass_through',
} as const;

export type TaxMode = (typeof TaxMode)[keyof typeof TaxMode];

export const PlatformFeeKind = {
  FIXED: 'fixed',
  PERCENT: 'percent',
} as const;

export type PlatformFeeKind = (typeof PlatformFeeKind)[keyof typeof PlatformFeeKind];

export const DeliveryMode = {
  INDIVIDUAL: 'individual',
  GROUP: 'group',
} as const;

export type DeliveryMode = (typeof DeliveryMode)[keyof typeof DeliveryMode];

export interface LineTaxSettings {
  purchaseTaxPercentage: number;
  purchaseTaxMode: TaxMode;
  sellingTaxPercentage: number;
  sellingTaxMode: TaxMode;
  deliveryTaxPercentage: number;
  deliveryTaxMode: TaxMode;
  platformFeeTaxPercentage: number;
  platformFeeTaxMode: TaxMode;
}
