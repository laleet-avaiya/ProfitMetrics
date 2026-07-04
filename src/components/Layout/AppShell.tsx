import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LoadingView } from "../AppLoader/AppLoader";
import { Layout } from "./Layout";

/** Keeps sidebar mounted across in-app navigation (avoids scroll reset / full remount). */
export function AppShell() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const fullBleed = pathname === "/ai-assistant";

  if (loading && !user) {
    return (
      <LoadingView message="Loading…" size="lg" className="min-h-screen gap-4" />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout fullBleed={fullBleed}>
      <Outlet />
    </Layout>
  );
}
