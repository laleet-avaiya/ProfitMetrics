import { CURRENT_LEGAL_VERSION } from '../constants/legalTerms';
import type { Organization } from '../models/org';

export function hasLegalConsent(org: Organization | null | undefined): boolean {
  if (!org?.termsAcceptedAt || !org.termsVersion) return false;
  return org.termsVersion === CURRENT_LEGAL_VERSION;
}
