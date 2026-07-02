import type { OrgRole } from './org';
import type { SoftDeletable } from './softDelete';

export interface OrgMember extends SoftDeletable {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  displayName?: string;
  role: OrgRole;
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}
