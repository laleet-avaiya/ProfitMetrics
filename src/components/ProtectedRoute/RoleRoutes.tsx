import { type ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';

export function WriteRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requiredPermission="write">{children}</ProtectedRoute>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requiredPermission="manage_team">{children}</ProtectedRoute>;
}

export function CompanyAdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute requiredPermission="manage_company">{children}</ProtectedRoute>;
}
