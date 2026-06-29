import { PLATFORM_PRESETS, type PlatformPreset } from '../constants/platforms';
import type { Company, ProductPlatformListing } from '../types';
import { PlatformFeeKind, TaxMode, TaxType } from '../types';
import { normalizeListingTax } from './listingTax';

export function createListingId(): string {
  return crypto.randomUUID();
}

export function isPresetPlatform(platform: string): platform is PlatformPreset {
  return (PLATFORM_PRESETS as readonly string[]).includes(platform);
}

/** Split stored platform into preset select value + optional custom label. */
export function platformToFormValues(platform: string): {
  preset: PlatformPreset | '';
  customName: string;
} {
  if (!platform.trim()) {
    return { preset: '', customName: '' };
  }
  if (isPresetPlatform(platform)) {
    return { preset: platform, customName: '' };
  }
  return { preset: 'Custom', customName: platform };
}

export function formValuesToPlatform(preset: PlatformPreset | '', customName: string): string {
  if (!preset) return '';
  if (preset === 'Custom') {
    const trimmed = customName.trim();
    return trimmed || 'Custom';
  }
  return preset;
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
