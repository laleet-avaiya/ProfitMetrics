import type { CompanyRole } from '../constants/roles';
import type { Auditable, SoftDeletable } from './softDelete';

export interface CompanyInvite extends Auditable, SoftDeletable {
  id: string;
  companyId: string;
  email: string;
  role: CompanyRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}
