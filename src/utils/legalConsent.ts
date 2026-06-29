import { CURRENT_LEGAL_VERSION } from '../constants/legalTerms';
import type { Company } from '../types';

export function hasLegalConsent(company: Company | null | undefined): boolean {
  if (!company?.termsAcceptedAt || !company.termsVersion) return false;
  return company.termsVersion === CURRENT_LEGAL_VERSION;
}
