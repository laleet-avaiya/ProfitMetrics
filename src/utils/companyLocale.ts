import type { Company } from '../types';
import { TaxType } from '../types';
import {
  BusinessCountry,
  getCountryProfile,
  type CountryProfile,
} from '../constants/countries';

export function companyCountry(company: Company | null | undefined): BusinessCountry {
  return company?.country === BusinessCountry.INDIA ? BusinessCountry.INDIA : BusinessCountry.UAE;
}

export function companyProfile(company: Company | null | undefined): CountryProfile {
  return getCountryProfile(companyCountry(company));
}

export function companyTaxIdLabel(company: Company | null | undefined): string {
  return companyProfile(company).taxIdLabel;
}

/** Short label for invoices and print layouts (TRN vs GSTIN). */
export function companyTaxIdPrintLabel(company: Company | null | undefined): string {
  return companyCountry(company) === BusinessCountry.INDIA ? 'GSTIN' : 'TRN';
}

export function companyTaxName(company: Company | null | undefined): string {
  const taxType = company?.defaultTaxType ?? companyProfile(company).defaultTaxType;
  if (taxType === TaxType.GST) return 'GST';
  if (taxType === TaxType.VAT) return 'VAT';
  if (taxType === TaxType.SALES_TAX) return 'Sales tax';
  return 'Tax';
}

/** Column / total heading, e.g. "VAT 5%" or "GST 18%". */
export function companyTaxColumnLabel(company: Company | null | undefined): string {
  const pct = company?.defaultTaxPercentage ?? companyProfile(company).defaultTaxPercentage;
  const name = companyTaxName(company);
  return pct ? `${name} ${pct}%` : name;
}
