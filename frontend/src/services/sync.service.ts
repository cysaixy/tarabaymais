import { api } from "../lib/api";
import { createObservation } from "./observation.service";

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
  idempotencyKey?: string;
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
 * Converts a File to a Base64 data URL so it can be safely stored in
 * IndexedDB / localStorage. Returns null if reading fails.
 */
export const fileToBase64 = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

/**
 * Reconstructs a File object from a Base64 data URL so it can be appended
 * to FormData for upload.
 */
export const base64ToFile = (
  dataUrl: string,
  fileName: string,
  mimeType: string,
): File => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mimeType || mime });
};

/** Queues an action item when offline */
export const queueOfflineAction = (
  item: Omit<SyncActionItem, "clientRefId" | "clientTimestamp" | "idempotencyKey">,
) => {
  const current = getOfflineQueue();
  const newItem: SyncActionItem = {
    ...item,
    payload: { ...item.payload },
    clientRefId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientTimestamp: new Date().toISOString(),
    idempotencyKey: `idem-${crypto.randomUUID()}`,
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
 *
 * Actions carrying `imageBase64` (offline photos) are reconstructed into
 * File objects and uploaded individually via multipart FormData so the photo
 * is not dropped. All other actions go through the batch JSON endpoint.
 */
export const sendBatchSync = async (
  actions: SyncActionItem[],
): Promise<BatchSyncResponse> => {
  const results: SyncResultItem[] = [];

  // Separate actions with Base64 images from those without
  const imageActions = actions.filter(
    (a) => a.actionType === "CREATE_OBSERVATION" &&
      (a.payload as Record<string, unknown>).imageBase64 &&
      typeof (a.payload as Record<string, unknown>).imageBase64 === "string",
  );
  const plainActions = actions.filter(
    (a) => !(imageActions.includes(a)),
  );

  // 1. Upload image observations individually via multipart FormData
  for (const action of imageActions) {
    const payload = action.payload as Record<string, unknown>;
    try {
      const file = base64ToFile(
        payload.imageBase64 as string,
        (payload.imageFileName as string) || "observation.jpg",
        (payload.imageMimeType as string) || "image/jpeg",
      );

      await createObservation({
        cropCycleId: payload.cropCycleId as string,
        title: payload.title as string,
        description: payload.description as string,
        severity: (payload.severity as any) || "LOW",
        image: file,
        aiDiagnosis: (payload.aiDiagnosis as any) || null,
        idempotencyKey: action.idempotencyKey,
      });

      results.push({
        clientRefId: action.clientRefId,
        status: "SUCCESS",
      });
    } catch (err: any) {
      results.push({
        clientRefId: action.clientRefId,
        status: "FAILED",
        error: err?.message || "Image upload failed",
      });
    }
  }

  // 2. Send plain (non-image) actions through the batch JSON endpoint
  if (plainActions.length > 0) {
    const { data } = await api.post("/sync", { actions: plainActions });
    const batchResult = data.data;
    results.push(...batchResult.results);
  }

  return {
    total: actions.length,
    processed: results.filter((r) => r.status === "SUCCESS").length,
    failed: results.filter((r) => r.status !== "SUCCESS").length,
    results,
  };
};
