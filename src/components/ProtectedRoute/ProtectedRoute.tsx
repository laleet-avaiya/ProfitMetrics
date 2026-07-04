import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { hasLegalConsent } from '../../utils/legalConsent';
import { getDefaultAppPath, type AppModule, type PermissionAction } from '../../constants/permissions';
import { LoadingView } from '../AppLoader/AppLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  requireLegalConsent?: boolean;
  requireCompany?: boolean;
  module?: AppModule;
  action?: PermissionAction;
}

const COMPANY_PICKER_PATHS = ['/companies', '/companies/new'];

export function ProtectedRoute({
  children,
  requireLegalConsent = true,
  requireCompany = true,
  module,
  action = 'view',
}: ProtectedRouteProps) {
  const { user, org, company, membership, rolePermissions, loading, companyContextLoading } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const defaultAppPath = getDefaultAppPath(membership?.role, rolePermissions);

  const isCompanyPickerRoute = COMPANY_PICKER_PATHS.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  if (loading && (!user || !isCompanyPickerRoute)) {
    return <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireCompany && (!company || !membership)) {
    if (isCompanyPickerRoute) {
      return <>{children}</>;
    }
    if (companyContextLoading) {
      return <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />;
    }
    return <Navigate to="/companies" replace />;
  }

  if (module && !can(module, action)) {
    if (location.pathname === defaultAppPath) {
      return <Navigate to="/companies" replace />;
    }
    return <Navigate to={defaultAppPath} replace />;
  }

  if (
    requireLegalConsent &&
    org &&
    !hasLegalConsent(org) &&
    location.pathname !== '/terms/accept'
  ) {
    return <Navigate to="/terms/accept" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
