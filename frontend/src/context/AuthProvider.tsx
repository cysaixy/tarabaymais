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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const initialCheckDone = useRef(false);

  /**
   * Refreshes the backend profile for the signed-in Firebase user in the background.
   * On success: overwrites local cache and updates React state.
   * On failure: if offline or server starting up (5xx/timeout), preserves cache.
   * Only clears session and logs out on genuine 401/403 auth rejection while online.
   */
  const syncProfileBackground = useCallback(
    async (currentUser: User): Promise<DbUserProfile | null> => {
      try {
        const dbProfile = await getMe();
        console.log("[AuthProvider] Fresh profile loaded from backend");
        cacheProfile(currentUser.uid, dbProfile);
        setProfile(dbProfile);
        setRole(dbProfile.role);
        return dbProfile;
      } catch (err: unknown) {
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        const isAuthRejection =
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403);

        const isUserDisabled =
          err instanceof Error &&
          (err.message.includes("auth/user-disabled") ||
            err.message.includes("auth/user-token-expired") ||
            err.message.includes("auth/invalid-user-token"));

        if (isOnline && (isAuthRejection || isUserDisabled)) {
          console.warn("[AuthProvider] Genuine online auth rejection: clearing session");
          clearCachedProfile(currentUser.uid);
          setProfile(null);
          setRole(null);
          await logOut().catch(() => {});
          return null;
        }

        // Offline, timeout, network error, or Render cold start (502/504):
        // PRESERVE the cached profile! Never sign out on network/server errors.
        console.log("[AuthProvider] Background sync skipped/failed (offline or server waking up): keeping cached profile");
        return readCachedProfile(currentUser.uid);
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

      // Request persistent browser storage so cache survives low-memory cleanups (Requirement 4)
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }

      // Step 1: Immediately restore from local cache (0ms blocking — Requirement 2 & 3)
      const cached = readCachedProfile(currentUser.uid);
      if (cached) {
        setProfile(cached);
        setRole(cached.role);
        if (isFirstCheck) {
          initialCheckDone.current = true;
          setLoading(false);
        }
      }

      // Step 2: Fetch fresh data in the background without blocking the dashboard
      try {
        await syncProfileBackground(currentUser);
      } finally {
        if (!initialCheckDone.current) {
          initialCheckDone.current = true;
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [syncProfileBackground]);

  // Revalidate the persisted session when connectivity returns
  useEffect(() => {
    const revalidateWhenOnline = () => {
      const currentUser = auth.currentUser;
      if (currentUser) void syncProfileBackground(currentUser);
    };

    window.addEventListener("online", revalidateWhenOnline);
    return () => window.removeEventListener("online", revalidateWhenOnline);
  }, [syncProfileBackground]);

  const refreshProfile = useCallback(async (): Promise<DbUserProfile | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    await currentUser.getIdToken(true);
    return syncProfileBackground(currentUser);
  }, [syncProfileBackground]);

  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    try {
      await logOut();
    } catch {
      // Ignore sign-out failures (e.g. already signed out / offline).
    } finally {
      // --- Clear all service-worker caches (api-cache, photo-cache, workbox) ---
      if (typeof caches !== "undefined") {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
          console.log("[AuthProvider] All SW caches cleared on logout:", cacheNames);
        } catch (cacheErr) {
          console.warn("[AuthProvider] Failed to clear SW caches:", cacheErr);
        }
      }

      // Clear the offline queue so another user on this device never sees or flushes it
      try {
        await clearOfflineQueue();
        console.log("[AuthProvider] Offline queue cleared on logout");
      } catch (qErr) {
        console.warn("[AuthProvider] Failed to clear offline queue:", qErr);
      }

      // Clear the cached farm selection & local storage items
      clearFarmContext();
      localStorage.removeItem("tarabaymais.farm-selection");
      localStorage.removeItem("fcm_token");
      localStorage.removeItem("fcm_token_registered");
      localStorage.removeItem("notification_prompted_at");

      if (uid) clearReadNotifications(uid);
      clearCachedProfile(uid);

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
