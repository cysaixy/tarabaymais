/**
 * useSyncQueue — Tracks the number of unsynced observations/actions in the
 * IndexedDB offline queue.
 *
 * Returns `pendingCount`. Re-evaluates whenever:
 * - a new item is queued offline, or
 * - the queue is synced and emptied,
 * via the `queue_updated` window event dispatched by `sync.service`. Also
 * refreshes when the tab comes back online (another tab may have synced).
 */
import { useCallback, useEffect, useState } from "react";
import { getOfflineQueue } from "../services/sync.service";
import { QUEUE_UPDATED_EVENT } from "../lib/offlineQueue";

export function useSyncQueue(): { pendingCount: number } {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      setPendingCount(queue.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    // Read once after mount, deferred via setTimeout so setState is not
    // invoked synchronously within the effect body (avoids cascading renders).
    const initial = setTimeout(() => {
      void refresh();
    }, 0);

    if (typeof window === "undefined") return;
    window.addEventListener(QUEUE_UPDATED_EVENT, refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearTimeout(initial);
      window.removeEventListener(QUEUE_UPDATED_EVENT, refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  return { pendingCount };
}
