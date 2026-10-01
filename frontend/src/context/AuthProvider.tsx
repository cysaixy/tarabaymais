import React, { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  AuthContext,
  toUserRole,
  type DbUserProfile,
  type UserRole,
} from "./authContext";
import { getMe, logOut } from "../services/auth.service";

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
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      await resolveSession(currentUser);
      setLoading(false);
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
    setLoading(true);
    try {
      await logOut();
    } catch {
      // Ignore sign-out failures (e.g. already signed out / offline).
    } finally {
      setUser(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
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
