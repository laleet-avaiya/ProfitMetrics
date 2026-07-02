import { type ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { AppModule, PermissionAction } from '../../constants/permissions';

interface ModuleRouteProps {
  module: (typeof AppModule)[keyof typeof AppModule];
  action?: (typeof PermissionAction)[keyof typeof PermissionAction];
  children: ReactNode;
}

export function ModuleRoute({ module, action = PermissionAction.VIEW, children }: ModuleRouteProps) {
  return (
    <ProtectedRoute module={module} action={action}>
      {children}
    </ProtectedRoute>
  );
}

export function ModuleWriteRoute({
  module,
  action,
  children,
}: {
  module: (typeof AppModule)[keyof typeof AppModule];
  action: 'create' | 'update';
  children: ReactNode;
}) {
  return (
    <ProtectedRoute module={module} action={action}>
      {children}
    </ProtectedRoute>
  );
}
