import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth, isMunicipalRole, type UserRole } from "../context/authContext";

interface GuardProps {
  allowedRoles: UserRole[];
}

/** Resolves the home route for a given role. */
const homeFor = (role: UserRole | null): string =>
  role === "TECHNICIAN"
    ? "/technician"
    : isMunicipalRole(role)
    ? "/officer/dashboard"
    : "/farmer";

/**
 * Route guard that gates access by authentication state and role.
 *
 * - While auth is resolving (first onAuthStateChanged not yet fired), shows a
 *   loading splash. This is the only blocking wait; it never requires a
 *   network call to succeed.
 * - Unauthenticated users (no Firebase session) are sent to /login.
 * - Authenticated users with a Firebase session AND a cached profile (offline
 *   or online) are granted access immediately. profile+role are set by
 *   AuthProvider regardless of network status.
 * - Authenticated users with no profile AND no cache (first login, incomplete
 *   onboarding, or cleared storage) are sent to /onboarding.
 * - Role mismatch → bounce to the caller's own home area.
 *
 * OFFLINE: AuthProvider hydrates profile+role from localStorage on startup
 * before any network call. So by the time this guard renders, profile and role
 * are already populated from cache if the farmer was previously logged in.
 * We do NOT rely on navigator.onLine here — it is unreliable in rural areas.
 */
export const ProtectedRoute: React.FC<GuardProps> = ({ allowedRoles }) => {
  const { user, profile, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
          <p className="text-xs tracking-wide">Kinukuha ang sesyon...</p>
        </div>
      </div>
    );
  }

  // No Firebase session at all → login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Signed in but no synced backend profile yet.
  //
  // profile is null in two cases:
  //   1. The user completed Firebase auth but never finished /auth/sync
  //      (incomplete onboarding). Send them to /onboarding.
  //   2. /auth/me returned a real auth error (401/403) while online.
  //      profile is cleared and the user needs to re-authenticate.
  //
  // If profile IS set (from cache or a fresh API call), we allow access.
  // We never send a cached user to /onboarding — AuthProvider is the
  // authority on whether we have a valid profile.
  if (!profile || !role) {
    return <Navigate to="/onboarding" replace />;
  }

  // Role mismatch → bounce to the caller's own home area.
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }

  return <Outlet />;
};
