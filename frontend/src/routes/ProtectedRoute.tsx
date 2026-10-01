import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth, isMunicipalRole, type UserRole } from "../context/authContext";

interface GuardProps {
  allowedRoles: UserRole[];
}

/** Resolves the home route for a given role. */
const homeFor = (role: UserRole | null): string =>
  isMunicipalRole(role) ? "/officer/dashboard" : "/farmer";

/**
 * Route guard that gates access by authentication state and role.
 *
 * - While auth is resolving, shows a loading state.
 * - Unauthenticated users (no Firebase session) are sent to /login.
 * - Authenticated users with a valid Firebase session but no synced profile
 *   (role === null) are sent to /onboarding to finish registration.
 * - Authenticated users whose role is not permitted are redirected to their
 *   own home area (role-mismatch protection).
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

  // No Firebase session at all → login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Signed in but no backend profile yet → complete registration.
  if (!role) {
    return <Navigate to="/onboarding" replace />;
  }

  // Role mismatch → bounce to the caller's own home area.
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  return <Outlet />;
};
