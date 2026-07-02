import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  hasModulePermission,
  type AppModule,
  type PermissionAction,
} from '../constants/permissions';
import { CompanyRole } from '../constants/roles';

export function usePermissions() {
  const { membership, rolePermissions } = useAuth();
  const role = membership?.role;

  return useMemo(
    () => ({
      role,
      isAdmin: role === CompanyRole.ADMIN,
      can: (module: AppModule, action: PermissionAction) =>
        hasModulePermission(role, rolePermissions, module, action),
    }),
    [role, rolePermissions]
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
