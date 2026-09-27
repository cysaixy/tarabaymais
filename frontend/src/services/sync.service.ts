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

/** Queues an action item when offline */
export const queueOfflineAction = (item: Omit<SyncActionItem, "clientRefId" | "clientTimestamp">) => {
  const current = getOfflineQueue();
  const newItem: SyncActionItem = {
    ...item,
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
  actions: SyncActionItem[]
): Promise<BatchSyncResponse> => {
  const { data } = await api.post("/sync", { actions });
  return data.data;
};
