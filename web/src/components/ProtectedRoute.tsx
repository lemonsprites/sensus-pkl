import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { FullScreenLoader } from "@/components/Loader";
import type { Role } from "@/lib/types";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/hierarki" replace />;

  return <Outlet />;
}
