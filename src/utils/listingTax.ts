import type {
  LineTaxSettings,
  ProductPlatformListing,
  SaleLineEconomics,
  TaxMode,
  TaxType,
} from '../types';
import { PlatformFeeKind, TaxMode as TaxModeEnum, TaxType as TaxTypeEnum } from '../types';

export interface ResolvedLineTax extends LineTaxSettings {
  taxType: TaxType;
  platformFeeKind: PlatformFeeKind;
}

export function taxPercentLabel(taxType: TaxType): string {
  if (taxType === TaxTypeEnum.GST) return 'GST %';
  if (taxType === TaxTypeEnum.VAT) return 'VAT %';
  if (taxType === TaxTypeEnum.SALES_TAX) return 'Sales tax %';
  return 'Tax %';
}

/** Yes = inclusive; No = exclusive (pass-through counts as No). */
export function isAmountTaxInclusive(mode: TaxMode | undefined): boolean {
  return mode === TaxModeEnum.INCLUSIVE;
}

export function taxModeFromAmountIncludesTax(includes: boolean): TaxMode {
  return includes ? TaxModeEnum.INCLUSIVE : TaxModeEnum.EXCLUSIVE;
}

export function amountIncludesTaxLabel(mode: TaxMode | undefined): string {
  return isAmountTaxInclusive(mode) ? 'Yes' : 'No';
}

export function inferPlatformFeeKind(
  listing: Pick<ProductPlatformListing, 'platformFeeKind' | 'platformFee' | 'platformFeePercent'>
): PlatformFeeKind {
  if (listing.platformFeeKind === PlatformFeeKind.PERCENT) return PlatformFeeKind.PERCENT;
  if (listing.platformFeeKind === PlatformFeeKind.FIXED) return PlatformFeeKind.FIXED;
  if ((listing.platformFeePercent ?? 0) > 0) return PlatformFeeKind.PERCENT;
  return PlatformFeeKind.FIXED;
}

/**
 * When purchase-side tax % is unset but selling tax is tracked, assume the same
 * rate and mode on purchase. Otherwise inclusive purchase prices (e.g. 118 with
 * 18% GST) are treated as ex-tax COGS and input GST is effectively counted
 * twice — once in the PO payment and again as embedded cost on the sale.
 */
export function defaultPurchaseTaxFromSelling(
  taxType: TaxType,
  sellingTaxPercentage: number,
  sellingTaxMode: TaxMode,
  purchaseTaxPercentage?: number,
  purchaseTaxMode?: TaxMode
): { purchaseTaxPercentage: number; purchaseTaxMode: TaxMode } {
  if (taxType === TaxTypeEnum.NONE || sellingTaxPercentage <= 0) {
    return {
      purchaseTaxPercentage: purchaseTaxPercentage ?? 0,
      purchaseTaxMode: purchaseTaxMode ?? TaxModeEnum.INCLUSIVE,
    };
  }
  if ((purchaseTaxPercentage ?? 0) > 0) {
    return {
      purchaseTaxPercentage: purchaseTaxPercentage!,
      purchaseTaxMode: purchaseTaxMode ?? TaxModeEnum.INCLUSIVE,
    };
  }
  if (purchaseTaxMode === TaxModeEnum.EXCLUSIVE) {
    return {
      purchaseTaxPercentage: 0,
      purchaseTaxMode: TaxModeEnum.EXCLUSIVE,
    };
  }
  return {
    purchaseTaxPercentage: sellingTaxPercentage,
    purchaseTaxMode: purchaseTaxMode ?? sellingTaxMode,
  };
}

/** Resolve listing tax fields with legacy fallbacks. */
export function resolveListingTax(listing: ProductPlatformListing): ResolvedLineTax {
  const sellingTaxPercentage = listing.sellingTaxPercentage ?? listing.taxPercentage ?? 0;
  const sellingTaxMode = listing.sellingTaxMode ?? listing.taxMode ?? TaxModeEnum.INCLUSIVE;
  const taxType = listing.taxType ?? TaxTypeEnum.NONE;
  const purchaseTax = defaultPurchaseTaxFromSelling(
    taxType,
    sellingTaxPercentage,
    sellingTaxMode,
    listing.purchaseTaxPercentage,
    listing.purchaseTaxMode
  );

  return {
    taxType,
    platformFeeKind: inferPlatformFeeKind(listing),
    purchaseTaxPercentage: purchaseTax.purchaseTaxPercentage,
    purchaseTaxMode: purchaseTax.purchaseTaxMode,
    sellingTaxPercentage,
    sellingTaxMode,
    deliveryTaxPercentage: listing.deliveryTaxPercentage ?? 0,
    deliveryTaxMode: listing.deliveryTaxMode ?? TaxModeEnum.INCLUSIVE,
    platformFeeTaxPercentage: listing.platformFeeTaxPercentage ?? 0,
    platformFeeTaxMode: listing.platformFeeTaxMode ?? TaxModeEnum.INCLUSIVE,
  };
}

/** Sync legacy selling tax fields before persisting. */
export function normalizeListingTax(listing: ProductPlatformListing): ProductPlatformListing {
  const resolved = resolveListingTax(listing);
  const platformFeeKind = resolved.platformFeeKind;

  return {
    ...listing,
    platformFeeKind,
    purchaseTaxPercentage: resolved.purchaseTaxPercentage,
    purchaseTaxMode: resolved.purchaseTaxMode,
    sellingTaxPercentage: resolved.sellingTaxPercentage,
    sellingTaxMode: resolved.sellingTaxMode,
    deliveryTaxPercentage: resolved.deliveryTaxPercentage,
    deliveryTaxMode: resolved.deliveryTaxMode,
    platformFeeTaxPercentage: resolved.platformFeeTaxPercentage,
    platformFeeTaxMode: resolved.platformFeeTaxMode,
    taxPercentage: resolved.sellingTaxPercentage,
    taxMode: resolved.sellingTaxMode,
    platformFee:
      platformFeeKind === PlatformFeeKind.FIXED ? listing.platformFee || undefined : undefined,
    platformFeePercent:
      platformFeeKind === PlatformFeeKind.PERCENT ? listing.platformFeePercent || undefined : undefined,
  };
}

export function lineTaxFromEconomics(economics: SaleLineEconomics): ResolvedLineTax {
  return resolveListingTax({
    id: '',
    platform: '',
    purchasePrice: economics.purchasePrice,
    sellingPrice: economics.sellingPrice,
    shippingCost: economics.shippingCost,
    platformFee: economics.platformFee,
    platformFeePercent: economics.platformFeePercent,
    platformFeeKind: economics.platformFeeKind,
    taxType: economics.taxType,
    taxPercentage: economics.taxPercentage,
    taxMode: economics.taxMode,
    purchaseTaxPercentage: economics.purchaseTaxPercentage,
    purchaseTaxMode: economics.purchaseTaxMode,
    sellingTaxPercentage: economics.sellingTaxPercentage,
    sellingTaxMode: economics.sellingTaxMode,
    deliveryTaxPercentage: economics.deliveryTaxPercentage,
    deliveryTaxMode: economics.deliveryTaxMode,
    platformFeeTaxPercentage: economics.platformFeeTaxPercentage,
    platformFeeTaxMode: economics.platformFeeTaxMode,
  });
}

export const taxModeOptions = [
  { value: TaxModeEnum.INCLUSIVE, label: 'Inclusive' },
  { value: TaxModeEnum.EXCLUSIVE, label: 'Exclusive' },
];

export const platformFeeKindOptions = [
  { value: PlatformFeeKind.FIXED, label: 'Fixed amount' },
  { value: PlatformFeeKind.PERCENT, label: 'Percentage' },
];
