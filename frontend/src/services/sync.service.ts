import { api } from "../lib/api";
import {
  createObservation,
  type SeverityLevel,
} from "./observation.service";
import { createFarm } from "./farm.service";
import {
  idbAddItem,
  idbClearQueue,
  idbGetQueue,
  idbRemoveItems,
  notifyQueueUpdated,
} from "../lib/offlineQueue";

export type SyncActionType =
  | "CREATE_OBSERVATION"
  | "CREATE_CROP_ACTIVITY"
  | "CREATE_DISASTER_REPORT"
  | "CREATE_FARM";

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

const SEVERITY_LEVELS: readonly SeverityLevel[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

function isSeverityLevel(value: unknown): value is SeverityLevel {
  return (
    typeof value === "string" &&
    SEVERITY_LEVELS.includes(value as SeverityLevel)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Reads queued actions from IndexedDB. */
export const getOfflineQueue = async (): Promise<SyncActionItem[]> => {
  try {
    return await idbGetQueue();
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

/** Queues an action item when offline (persisted to IndexedDB). */
export const queueOfflineAction = async (
  item: Omit<SyncActionItem, "clientRefId" | "clientTimestamp" | "idempotencyKey">,
): Promise<SyncActionItem> => {
  const newItem: SyncActionItem = {
    ...item,
    payload: { ...item.payload },
    clientRefId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientTimestamp: new Date().toISOString(),
    idempotencyKey: `idem-${crypto.randomUUID()}`,
  };

  await idbAddItem(newItem);
  notifyQueueUpdated();
  return newItem;
};

/** Clears all queued items (IndexedDB). */
export const clearOfflineQueue = async (): Promise<void> => {
  await idbClearQueue();
  notifyQueueUpdated();
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
    (a) =>
      !(imageActions.includes(a)) && a.actionType !== "CREATE_FARM",
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
        severity: isSeverityLevel(payload.severity)
          ? payload.severity
          : "LOW",
        image: file,
        aiDiagnosis: asRecord(payload.aiDiagnosis),
        idempotencyKey: action.idempotencyKey,
      });

      results.push({
        clientRefId: action.clientRefId,
        status: "SUCCESS",
      });
    } catch (err: unknown) {
      results.push({
        clientRefId: action.clientRefId,
        status: "FAILED",
        error: getErrorMessage(err, "Image upload failed"),
      });
    }
  }

  // 2. Send plain (non-image) actions through the batch JSON endpoint
  if (plainActions.length > 0) {
    const { data } = await api.post("/sync", { actions: plainActions });
    const batchResult = data.data;
    results.push(...batchResult.results);
  }

  // 3. Handle CREATE_FARM individually (no image, but needs direct API call)
  const farmActions = actions.filter(
    (a) => a.actionType === "CREATE_FARM",
  );
  for (const action of farmActions) {
    const payload = action.payload as Record<string, unknown>;
    try {
      await createFarm({
        name: payload.name as string,
        municipality: payload.municipality as string,
        barangay: payload.barangay as string,
        areaHectares: Number(payload.areaHectares),
        latitude: payload.latitude as number | null,
        longitude: payload.longitude as number | null,
      });
      results.push({
        clientRefId: action.clientRefId,
        status: "SUCCESS",
      });
    } catch (err: unknown) {
      results.push({
        clientRefId: action.clientRefId,
        status: "FAILED",
        error: getErrorMessage(err, "Farm creation failed"),
      });
    }
  }

  return {
    total: actions.length,
    processed: results.filter((r) => r.status === "SUCCESS").length,
    failed: results.filter((r) => r.status !== "SUCCESS").length,
    results,
  };
};

/**
 * Syncs all locally queued actions and removes only successful actions.
 * Failed actions remain queued so they can be retried instead of being lost.
 */
export const syncPendingOfflineActions = async (): Promise<BatchSyncResponse> => {
  const actions = await getOfflineQueue();
  if (actions.length === 0) {
    return { total: 0, processed: 0, failed: 0, results: [] };
  }

  const response = await sendBatchSync(actions);
  const successfulIds = response.results
    .filter((result) => result.status === "SUCCESS")
    .map((result) => result.clientRefId);

  await idbRemoveItems(successfulIds);
  notifyQueueUpdated();
  return response;
};
