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
 * - OFFLINE: If user has a Firebase session but profile fetch failed due to
 *   network error, allow access to cached dashboard (don't redirect to onboarding).
 */
export const ProtectedRoute: React.FC<GuardProps> = ({ allowedRoles }) => {
  const { user, profile, role, loading } = useAuth();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

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

  // Signed in but no synced backend profile yet (e.g. /auth/me returned 401 on
  // a refresh/deeplink) → complete registration. `role` can be a provisional
  // token-claim value here, so the profile is the authoritative signal.
  // OFFLINE EXCEPTION: If we're offline and have a cached profile/role, allow access.
  const isOffline = !isOnline;
  // A token claim alone is not enough to prove that this user completed
  // onboarding. Require the locally persisted backend profile as well.
  const hasCachedAccess = isOffline && Boolean(profile && role);
  if (!profile || !role) {
    if (hasCachedAccess) {
      console.log("[ProtectedRoute] Offline: allowing access with cached profile/role");
      return <Outlet />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  // Role mismatch → bounce to the caller's own home area.
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  return <Outlet />;
};
