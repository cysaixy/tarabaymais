import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type UserRole } from "../context/authContext";

interface GuardProps {
  allowedRoles: UserRole[];
}

/**
 * Route guard that gates access by authentication state and role.
 * - While auth is resolving, shows a loading state.
 * - Unauthenticated users are sent to /login.
 * - Authenticated users whose role is not allowed are redirected to their
 *   own home area.
 */
export const ProtectedRoute: React.FC<GuardProps> = ({ allowedRoles }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
          <p className="text-xs tracking-wide">Validating permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    const fallback = role === "technician" ? "/technician" : "/farmer";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};
