import type { Company } from '../types';
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
