import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  hasModulePermission,
  type AppModule,
  type PermissionAction,
} from '../constants/permissions';
import { CompanyRole } from '../constants/roles';
import { OrgRole } from '../models/org';

export function usePermissions() {
  const { membership, rolePermissions, orgMembership } = useAuth();
  const role = membership?.role;
  const isOrgAdmin = orgMembership?.role === OrgRole.ADMIN;

  return useMemo(
    () => ({
      role,
      isAdmin: role === CompanyRole.ADMIN,
      isOrgAdmin,
      can: (module: AppModule, action: PermissionAction) => {
        if (isOrgAdmin && module === 'subscription') return true;
        return hasModulePermission(role, rolePermissions, module, action);
      },
    }),
    [role, rolePermissions, isOrgAdmin]
  );
}

export function useModuleAccess(module: AppModule) {
  const { can } = usePermissions();

  return useMemo(
    () => ({
      canView: can(module, 'view'),
      canCreate: can(module, 'create'),
      canUpdate: can(module, 'update'),
      canDelete: can(module, 'delete'),
    }),
    [can, module]
  );
}
