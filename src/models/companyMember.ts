import type { CompanyRole } from '../constants/roles';

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  displayName?: string;
  role: CompanyRole;
  status: 'active' | 'disabled';
  invitedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
