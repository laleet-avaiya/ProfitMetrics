import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { hasLegalConsent } from '../../utils/legalConsent';
import type { Permission } from '../../constants/roles';
import { LoadingView } from '../AppLoader/AppLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  requireLegalConsent?: boolean;
  requiredPermission?: Permission;
}

export function ProtectedRoute({
  children,
  requireLegalConsent = true,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, company, membership, loading } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();

  if (loading) {
    return <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!company || !membership) {
    if (location.pathname === '/no-company' || location.pathname === '/create-company') {
      return <>{children}</>;
    }
    return <Navigate to="/no-company" replace />;
  }

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  if (
    requireLegalConsent &&
    company &&
    !hasLegalConsent(company) &&
    location.pathname !== '/terms/accept'
  ) {
    return <Navigate to="/terms/accept" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
