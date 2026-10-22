/**
 * useNetworkStatus — React hook that tracks the browser's online/offline state.
 *
 * Listens to `window`'s `online`/`offline` events and returns a single boolean
 * `isOffline`. Safe to call during SSR (returns `false` when `navigator` is
 * unavailable).
 */
import { useCallback, useEffect, useState } from "react";

export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator === "undefined" ? false : !navigator.onLine,
  );

  const handleOnline = useCallback(() => setIsOffline(false), []);
  const handleOffline = useCallback(() => setIsOffline(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOffline;
}
