/**
 * IndexedDB-backed offline queue store for Tarabay-Mais.
 *
 * Replaces the previous localStorage queue so pending observations/activities/
 * disaster reports survive page reloads and can be read reactively by
 * `useSyncQueue` (and across tabs).
 *
 * Database: `tarabay-mais` v1
 * Store: `offline_queue` (keyPath: `clientRefId`)
 */

import type { SyncActionItem } from "../services/sync.service";

const DB_NAME = "tarabay-mais";
const STORE_NAME = "offline_queue";
const DB_VERSION = 1;
export const QUEUE_UPDATED_EVENT = "queue_updated";

let dbInstance: IDBDatabase | null = null;

/** Opens (and migrates) the IndexedDB database once, then caches the connection. */
function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientRefId" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

/** Read every queued action. */
export async function idbGetQueue(): Promise<SyncActionItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as SyncActionItem[]);
    request.onerror = () => reject(request.error);
  });
}

/** Persist a single queued action. */
export async function idbAddItem(item: SyncActionItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Remove every queued action. */
export async function idbClearQueue(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Dispatch a window event so React hooks (useSyncQueue) re-read the queue instantly. */
export function notifyQueueUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
  }
}
