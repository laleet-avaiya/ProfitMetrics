import {
  DEFAULT_MARKETPLACES,
  isConfiguredMarketplace,
} from '../constants/platforms';
import type { Company, ProductPlatformListing } from '../types';
import { PlatformFeeKind, TaxMode, TaxType } from '../types';
import { normalizeListingTax } from './listingTax';

export function createListingId(): string {
  return crypto.randomUUID();
}

/** @deprecated Use isConfiguredMarketplace(platform, marketplaces) */
export function isPresetPlatform(
  platform: string,
  marketplaces: readonly string[] = DEFAULT_MARKETPLACES
): boolean {
  return isConfiguredMarketplace(platform, marketplaces);
}

/** Map stored platform to select value (legacy names kept as-is). */
export function platformToFormValues(platform: string): { preset: string } {
  return { preset: platform.trim() };
}

export function formValuesToPlatform(preset: string): string {
  return preset.trim();
}

export function createEmptyListing(company: Company | null | undefined): ProductPlatformListing {
  const taxType = company?.defaultTaxType ?? TaxType.NONE;
  const sellingTaxPercentage = company?.defaultTaxPercentage ?? 0;
  const sellingTaxMode = company?.defaultTaxMode ?? TaxMode.INCLUSIVE;

  return normalizeListingTax({
    id: createListingId(),
    platform: '',
    purchasePrice: 0,
    sellingPrice: 0,
    shippingCost: 0,
    platformFeeKind: PlatformFeeKind.FIXED,
    taxType,
    taxPercentage: sellingTaxPercentage,
    taxMode: sellingTaxMode,
    purchaseTaxPercentage: sellingTaxPercentage,
    purchaseTaxMode: sellingTaxMode,
    sellingTaxPercentage,
    sellingTaxMode,
    deliveryTaxPercentage: sellingTaxPercentage,
    deliveryTaxMode: sellingTaxMode,
    platformFeeTaxPercentage: sellingTaxPercentage,
    platformFeeTaxMode: sellingTaxMode,
  });
}

export function normalizeListings(listings: ProductPlatformListing[]): ProductPlatformListing[] {
  if (listings.length === 0) return listings;
  return listings.map((listing) => {
    const normalized = normalizeListingTax(listing);
    const { isDefault: _removed, ...rest } = normalized as ProductPlatformListing & {
      isDefault?: boolean;
    };
    return rest;
  });
}
