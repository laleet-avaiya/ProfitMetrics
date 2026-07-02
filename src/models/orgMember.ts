import type { OrgRole } from './org';

export interface OrgMember {
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
