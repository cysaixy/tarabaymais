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
import { clearReadNotifications } from "../lib/notificationReadTracking";
import { ApiError } from "../lib/api";

const PROFILE_CACHE_PREFIX = "tarabaymais.auth-profile.";

interface CachedProfile {
  uid: string;
  profile: DbUserProfile;
}

/**
 * The Firebase session is persisted by Firebase itself. The backend profile is
 * not, so keep the small non-sensitive profile locally as well. It is always
 * scoped to the Firebase UID that created it; a different user of a shared
 * device can never receive the previous user's cached profile.
 */
const profileCacheKey = (uid: string): string => `${PROFILE_CACHE_PREFIX}${uid}`;

const readCachedProfile = (uid: string): DbUserProfile | null => {
  try {
    const raw = localStorage.getItem(profileCacheKey(uid));
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedProfile;
    if (cached.uid !== uid || !cached.profile?.id || !cached.profile?.role) {
      localStorage.removeItem(profileCacheKey(uid));
      return null;
    }
    return cached.profile;
  } catch {
    localStorage.removeItem(profileCacheKey(uid));
    return null;
  }
};

const cacheProfile = (uid: string, profile: DbUserProfile): void => {
  try {
    localStorage.setItem(profileCacheKey(uid), JSON.stringify({ uid, profile }));
  } catch (err) {
    // Storage can be unavailable in privacy-restricted browsers. The online
    // session still works; only offline reload support is unavailable.
    console.warn("[AuthProvider] Could not cache profile for offline use:", err);
  }
};

const clearCachedProfile = (uid: string | null | undefined): void => {
  if (!uid) return;
  try {
    localStorage.removeItem(profileCacheKey(uid));
  } catch (err) {
    console.warn("[AuthProvider] Could not clear cached profile:", err);
  }
};

/**
 * Determines if an error is a network/offline error.
 * Covers Firebase errors, Axios/ApiError, fetch TypeErrors, and common messages.
 */
const isNetworkError = (err: unknown): boolean => {
  if (!err) return false;

  // Axios/ApiError with network flag
  if (err instanceof ApiError && err.isNetworkError) return true;

  // Firebase Auth errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("internet") ||
      msg.includes("offline") ||
      msg.includes("connection") ||
      msg.includes("fetch") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("timeout") ||
      msg.includes("unreachable") ||
      msg.includes("auth/network-request-failed") ||
      msg.includes("auth/user-token-expired") ||
      msg.includes("auth/id-token-expired")
    ) return true;
  }

  // Fetch TypeError (network failure)
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return true;
  }

  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const initialCheckDone = useRef(false);

  /**
   * Resolves the backend profile for the signed-in Firebase user and syncs
   * role/profile state. Falls back to the token claim role if the profile has
   * not been synced yet (first-time user mid-registration).
   *
   * On network errors, preserves existing profile/role instead of clearing them.
   */
  const resolveSession = useCallback(
    async (currentUser: User): Promise<DbUserProfile | null> => {
      // Hydrate before making a network request. This lets a returning farmer
      // open a cached screen while offline, including after a page refresh.
      const cachedProfile = readCachedProfile(currentUser.uid);
      if (cachedProfile) {
        setProfile(cachedProfile);
        setRole(cachedProfile.role);
      }

      // Try to get role from token claim. It is only a fallback while the
      // profile is being resolved; the profile remains authoritative.
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        if (!cachedProfile) setRole(toUserRole(tokenResult.claims.role));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log("[AuthProvider] getIdTokenResult failed:", msg);
        // If offline, tokenRole stays null - that's fine, we'll use cached role
      }
      // Try to fetch fresh profile from backend
      try {
        const dbProfile = await getMe();
        console.log("[AuthProvider] Got fresh profile from backend");
        cacheProfile(currentUser.uid, dbProfile);
        setProfile(dbProfile);
        setRole(dbProfile.role);
        return dbProfile;
      } catch (err: unknown) {
        // Network error (offline) -> preserve existing profile/role, don't clear
        if (isNetworkError(err)) {
          console.log("[AuthProvider] Offline: using cached profile/role");
          return cachedProfile;
        }

        // Auth error (401, 403, token expired, etc.) -> clear profile, needs re-sync
        const msg = err instanceof Error ? err.message : String(err);
        console.log("[AuthProvider] Auth error: clearing profile", msg);
        clearCachedProfile(currentUser.uid);
        setProfile(null);
        setRole(null);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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

      // Wrap in try/catch but NEVER clear profile on network errors
      try {
        await resolveSession(currentUser);
      } catch (err) {
        console.error("[AuthProvider] resolveSession unexpected error:", err);
        // Only clear profile on non-network errors
        if (!isNetworkError(err)) {
          console.log("[AuthProvider] Non-network error, clearing profile");
          setProfile(null);
          setRole(null);
        } else {
          console.log("[AuthProvider] Network error caught in outer handler, preserving profile");
        }
      }

      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Revalidate the persisted session when connectivity returns. getIdToken()
  // then uses Firebase's normal refresh flow and the profile cache is updated
  // from the server without interrupting the farmer's current screen.
  useEffect(() => {
    const revalidateWhenOnline = () => {
      const currentUser = auth.currentUser;
      if (currentUser) void resolveSession(currentUser);
    };

    window.addEventListener("online", revalidateWhenOnline);
    return () => window.removeEventListener("online", revalidateWhenOnline);
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
    const uid = auth.currentUser?.uid;
    try {
      await logOut();
    } catch {
      // Ignore sign-out failures (e.g. already signed out / offline).
    } finally {
      // Clear PWA caches (api-cache, ai-cache) so next user doesn't see stale data
      if (typeof caches !== "undefined") {
        try {
          await caches.delete("api-cache");
          await caches.delete("ai-cache");
          console.log("[AuthProvider] PWA caches cleared on logout");
        } catch (cacheErr) {
          console.warn("[AuthProvider] Failed to clear PWA caches:", cacheErr);
        }
      }

      // Clear the cached active-farm context so the next session (e.g. a
      // different farmer on a shared device) does not inherit stale farm data.
      clearFarmContext();
      // Clear read-notification IDs for this user so the badge resets cleanly.
      if (uid) clearReadNotifications(uid);
      clearCachedProfile(uid);
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
