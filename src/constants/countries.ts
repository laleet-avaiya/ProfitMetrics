import { TaxMode, TaxType } from '../types';

export const BusinessCountry = {
  UAE: 'AE',
  INDIA: 'IN',
} as const;

export type BusinessCountry = (typeof BusinessCountry)[keyof typeof BusinessCountry];

export interface CountryProfile {
  code: BusinessCountry;
  label: string;
  flag: string;
  currency: string;
  currencyLabel: string;
  timezone: string;
  defaultTaxType: (typeof TaxType)[keyof typeof TaxType];
  defaultTaxMode: (typeof TaxMode)[keyof typeof TaxMode];
  defaultTaxPercentage: number;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdMaxLength: number;
  phonePlaceholder: string;
}

export const COUNTRY_PROFILES: Record<BusinessCountry, CountryProfile> = {
  [BusinessCountry.UAE]: {
    code: BusinessCountry.UAE,
    label: 'United Arab Emirates',
    flag: '🇦🇪',
    currency: 'AED',
    currencyLabel: 'UAE Dirham (AED)',
    timezone: 'Asia/Dubai',
    defaultTaxType: TaxType.VAT,
    defaultTaxMode: TaxMode.INCLUSIVE,
    defaultTaxPercentage: 5,
    taxIdLabel: 'TRN (Tax Registration Number)',
    taxIdPlaceholder: '15-digit TRN',
    taxIdMaxLength: 15,
    phonePlaceholder: '+971 XX XXX XXXX',
  },
  [BusinessCountry.INDIA]: {
    code: BusinessCountry.INDIA,
    label: 'India',
    flag: '🇮🇳',
    currency: 'INR',
    currencyLabel: 'Indian Rupee (INR)',
    timezone: 'Asia/Kolkata',
    defaultTaxType: TaxType.GST,
    defaultTaxMode: TaxMode.EXCLUSIVE,
    defaultTaxPercentage: 18,
    taxIdLabel: 'GSTIN',
    taxIdPlaceholder: '15-character GSTIN',
    taxIdMaxLength: 15,
    phonePlaceholder: '+91 XXXXX XXXXX',
  },
};

export const COUNTRY_OPTIONS = Object.values(COUNTRY_PROFILES).map((p) => ({
  value: p.code,
  label: `${p.flag} ${p.label}`,
}));

export function getCountryProfile(country: BusinessCountry | string | undefined): CountryProfile {
  if (country === BusinessCountry.INDIA) {
    return COUNTRY_PROFILES[BusinessCountry.INDIA];
  }
  return COUNTRY_PROFILES[BusinessCountry.UAE];
}

export function isBusinessCountry(value: string): value is BusinessCountry {
  return value === BusinessCountry.UAE || value === BusinessCountry.INDIA;
}

/** Defaults stored on the company document for new products & sales. */
export function countryDefaultsForCompany(country: BusinessCountry) {
  const profile = getCountryProfile(country);
  return {
    country: profile.code,
    currency: profile.currency,
    timezone: profile.timezone,
    defaultTaxType: profile.defaultTaxType,
    defaultTaxMode: profile.defaultTaxMode,
    defaultTaxPercentage: profile.defaultTaxPercentage,
  };
}
