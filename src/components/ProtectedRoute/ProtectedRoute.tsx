import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasLegalConsent } from '../../utils/legalConsent';

interface ProtectedRouteProps {
  children: ReactNode;
  /** When false, allow access without T&C acceptance (terms pages only). */
  requireLegalConsent?: boolean;
}

export function ProtectedRoute({ children, requireLegalConsent = true }: ProtectedRouteProps) {
  const { user, company, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
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
