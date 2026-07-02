import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { roleHasPermission, type Permission } from '../constants/roles';

export function usePermissions() {
  const { membership } = useAuth();
  const role = membership?.role;

  return useMemo(
    () => ({
      role,
      isAdmin: role === 'admin',
      canWrite: roleHasPermission(role, 'write'),
      can: (permission: Permission) => roleHasPermission(role, permission),
    }),
    [role]
  );
}
