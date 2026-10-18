import { api } from "../lib/api";

export type SyncActionType =
  | "CREATE_OBSERVATION"
  | "CREATE_CROP_ACTIVITY"
  | "CREATE_DISASTER_REPORT";

export interface SyncActionItem<T = Record<string, unknown>> {
  clientRefId: string;
  actionType: SyncActionType;
  payload: T;
  clientTimestamp?: string;
  displayTitle?: string;
}

export interface SyncResultItem {
  clientRefId: string;
  serverId?: string;
  status: "SUCCESS" | "FAILED" | "ORPHANED";
  error?: string;
}

export interface BatchSyncResponse {
  total: number;
  processed: number;
  failed: number;
  results: SyncResultItem[];
}

const OFFLINE_QUEUE_KEY = "tarabay_offline_queue";

/** Reads queued actions from local storage */
export const getOfflineQueue = (): SyncActionItem[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Strips an unusable `blob:` object URL from an offline payload's `imageUrl`.
 *
 * Offline photo sync is deferred to the PWA phase. A `blob:` URL is only valid
 * in the tab that created it, so persisting it to the queue would sync a dead
 * link. Until real offline upload exists, we queue the observation text without
 * a photo rather than a broken reference.
 */
const stripBlobImageUrl = (
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const url = payload.imageUrl;
  if (typeof url === "string" && url.startsWith("blob:")) {
    const sanitized = { ...payload };
    delete sanitized.imageUrl;
    return sanitized;
  }
  return payload;
};

/** Queues an action item when offline */
export const queueOfflineAction = (
  item: Omit<SyncActionItem, "clientRefId" | "clientTimestamp">,
) => {
  const current = getOfflineQueue();
  const newItem: SyncActionItem = {
    ...item,
    payload: stripBlobImageUrl(item.payload),
    clientRefId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientTimestamp: new Date().toISOString(),
  };
  current.push(newItem);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current));
  return newItem;
};

/** Clears all queued items */
export const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
};

/**
 * Sends queued actions to the backend batch sync endpoint.
 * Endpoint: POST /api/v1/sync
 */
export const sendBatchSync = async (
  actions: SyncActionItem[],
): Promise<BatchSyncResponse> => {
  const { data } = await api.post("/sync", { actions });
  return data.data;
};
