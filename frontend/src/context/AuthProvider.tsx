import React, { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  AuthContext,
  type DbUserProfile,
  type UserRole,
} from "./authContext";
import { getMe, logOut } from "../services/auth.service";
import { clearFarmContext } from "../hooks/useFarmContext";
import { clearReadNotifications } from "../lib/notificationReadTracking";
import { clearOfflineQueue } from "../services/sync.service";
import { ApiError } from "../lib/api";
import { LoadingState } from "../components/LoadingState";

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
 * Determines if an error is a transient network/offline error.
 *
 * Returns true only for errors caused by lack of internet connectivity, not
 * for real authentication rejections (disabled accounts, revoked tokens).
 *
 * Key distinction:
 *   - auth/network-request-failed → offline, no network to reach Firebase → true
 *   - auth/user-token-expired     → real server rejection (token revoked)   → false
 *   - auth/id-token-expired       → token expired; Firebase auto-refreshes on
 *                                    next online request via getIdToken()    → false
 *
 * Covers Firebase errors, Axios/ApiError, fetch TypeErrors, and common messages.
 */
const isNetworkError = (err: unknown): boolean => {
  if (!err) return false;

  // Axios/ApiError with network flag (status 0, no response from server)
  if (err instanceof ApiError && err.isNetworkError) return true;

  // Firebase Auth errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("internet") ||
      msg.includes("offline") ||
      msg.includes("connection") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("timeout") ||
      msg.includes("unreachable") ||
      // Firebase's specific network-layer error code
      msg.includes("auth/network-request-failed")
    ) return true;
  }

  // Fetch TypeError (network failure — browser couldn't reach the server)
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

      // NOTE: We intentionally do NOT call getIdTokenResult() here.
      // The profile cache (read above) is the authoritative source for role on
      // startup. getIdTokenResult() makes a network round-trip that:
      //   • Delays profile+role being set while offline.
      //   • Is redundant because role is already in the cached DbUserProfile.
      // getIdToken() in the API interceptor handles token refresh automatically.

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
    // Note: this is only called explicitly after registration — not on startup.
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
      // --- Clear all service-worker caches (api-cache, ai-cache, etc.) ---
      // Enumerate all named caches rather than hardcoding names so a future
      // cache added to vite.config is automatically covered.
      if (typeof caches !== "undefined") {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
          console.log("[AuthProvider] All SW caches cleared on logout", cacheNames);
        } catch (cacheErr) {
          console.warn("[AuthProvider] Failed to clear SW caches:", cacheErr);
        }
      }

      // Clear the offline queue so a different farmer logging in on the same
      // device never sees or flushes the previous user's queued actions.
      try {
        await clearOfflineQueue();
        console.log("[AuthProvider] Offline queue cleared on logout");
      } catch (qErr) {
        console.warn("[AuthProvider] Failed to clear offline queue:", qErr);
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
      {loading ? (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center">
          <LoadingState fullScreen label="Kinukuha ang sesyon..." />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
