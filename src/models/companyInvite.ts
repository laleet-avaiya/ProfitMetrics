import type { CompanyRole } from '../constants/roles';
import type { SoftDeletable } from './softDelete';

export interface CompanyInvite extends SoftDeletable {
  id: string;
  companyId: string;
  email: string;
  role: CompanyRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}
