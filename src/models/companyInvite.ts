import type { CompanyRole } from '../constants/roles';

export interface CompanyInvite {
  id: string;
  companyId: string;
  email: string;
  role: CompanyRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}
