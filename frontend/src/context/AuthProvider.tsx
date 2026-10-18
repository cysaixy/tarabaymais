import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  AuthContext,
  toUserRole,
  type DbUserProfile,
  type UserRole,
} from "./authContext";
import { getMe, logOut } from "../services/auth.service";
import { clearFarmContext } from "../hooks/useFarmContext";
import { clearReadNotifications } from "../components/NotificationBell";

/**
 * Reads the role from the Firebase ID token's custom claim. The backend sets
 * this claim for technicians/officers; farmers (and brand-new users) fall back
 * to FARMER. The backend profile (`/auth/me`) remains the ultimate source of
 * truth and overrides this once loaded.
 */
const readRoleFromToken = async (currentUser: User): Promise<UserRole> => {
  const tokenResult = await currentUser.getIdTokenResult();
  return toUserRole(tokenResult.claims.role);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Tracks whether the very first Firebase session check has resolved.
  // After that point we never blank the whole app again — guards handle
  // per-route access while re-resolution happens silently in the background.
  const initialCheckDone = useRef(false);

  /**
   * Resolves the backend profile for the signed-in Firebase user and syncs
   * role/profile state. Falls back to the token claim role if the profile has
   * not been synced yet (first-time user mid-registration).
   */
  const resolveSession = useCallback(
    async (currentUser: User): Promise<DbUserProfile | null> => {
      // Provisional role from the token claim so guards have something while
      // the network request is in flight.
      setRole(await readRoleFromToken(currentUser));

      try {
        const dbProfile = await getMe();
        setProfile(dbProfile);
        setRole(dbProfile.role);
        return dbProfile;
      } catch {
        // 401 => token valid but no DB profile yet. Keep the Firebase session
        // (so registration can call /auth/sync) but clear the stale profile.
        setProfile(null);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    // Session persistence: Firebase restores the session on refresh and fires
    // this callback with the current user. We then re-verify by fetching the
    // backend profile and restoring the role before rendering guarded views.
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Only show the full-screen loading gate on the very first check.
      // Subsequent firings (e.g. right after login navigates to the dashboard)
      // resolve silently so the app never goes blank mid-session.
      const isFirstCheck = !initialCheckDone.current;
      if (isFirstCheck) setLoading(true);

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setRole(null);
        if (isFirstCheck) {
          initialCheckDone.current = true;
          setLoading(false);
        }
        return;
      }

      setUser(currentUser);
      await resolveSession(currentUser);

      if (isFirstCheck) {
        initialCheckDone.current = true;
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [resolveSession]);

  const refreshProfile = useCallback(async (): Promise<DbUserProfile | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    // Force a token refresh so any freshly-set custom claims (role) are picked
    // up, then re-resolve the backend profile.
    await currentUser.getIdToken(true);
    return resolveSession(currentUser);
  }, [resolveSession]);

  const logout = useCallback(async () => {
    try {
      await logOut();
    } catch {
      // Ignore sign-out failures (e.g. already signed out / offline).
    } finally {
      // Clear the cached active-farm context so the next session (e.g. a
      // different farmer on a shared device) does not inherit stale farm data.
      clearFarmContext();
      // Clear read-notification IDs for this user so the badge resets cleanly.
      const uid = auth.currentUser?.uid;
      if (uid) clearReadNotifications(uid);
      // Reset the initial-check flag so the next login cycle works correctly.
      initialCheckDone.current = false;
      setUser(null);
      setProfile(null);
      setRole(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, role, loading, logout, refreshProfile }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
