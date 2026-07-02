import type { CompanyRole } from '../constants/roles';
import type { ModulePermissionMap } from '../constants/permissions';

export interface CompanyRoleDefinition {
  id: string;
  companyId: string;
  role: CompanyRole;
  permissions: ModulePermissionMap;
  updatedAt: Date;
}
