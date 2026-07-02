import type { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { AppModule, PermissionAction } from '../../constants/permissions';

interface PermissionGateProps {
  module: AppModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermissions();
  return can(module, action) ? children : fallback;
}
