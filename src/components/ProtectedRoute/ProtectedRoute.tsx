import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasLegalConsent } from '../../utils/legalConsent';
import { LoadingView } from '../AppLoader/AppLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  /** When false, allow access without T&C acceptance (terms pages only). */
  requireLegalConsent?: boolean;
}

export function ProtectedRoute({ children, requireLegalConsent = true }: ProtectedRouteProps) {
  const { user, company, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
