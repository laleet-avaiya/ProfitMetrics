import type { CompanyRole } from '../constants/roles';
import type { Auditable, SoftDeletable } from './softDelete';

export interface CompanyMember extends Auditable, SoftDeletable {
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
