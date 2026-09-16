import { Request, Response } from "express";
import { SyncService, SyncAction } from "../services/sync.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schema ──────────────────────────────────────────────────────────────

/**
 * We validate the shape of each action at the transport layer and let
 * SyncService handle per-action business validation. The `payload` field
 * is intentionally open — each action type checks its own required keys.
 */
const syncActionSchema = z.object({
  clientRefId: z.string(),
  actionType: z.enum([
    "CREATE_OBSERVATION",
    "CREATE_CROP_ACTIVITY",
    "CREATE_DISASTER_REPORT",
  ]),
  payload: z.record(z.string(), z.unknown()),
  clientTimestamp: z.string().optional(),
});

const batchSyncSchema = z.object({
  actions: z
    .array(syncActionSchema)
    .min(1, "actions must be a non-empty array"),
});

// ── Controller ────────────────────────────────────────────────────────────────

/** POST /api/v1/sync */
export const processBatchSync = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = batchSyncSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const userId = req.user!.id;
    // Cast to SyncAction[] — shape is verified by zodSchema above
    const actions = parseResult.data.actions as SyncAction[];
    const syncSummary = await SyncService.processBatch(userId, actions);

    sendSuccess(res, 200, { data: syncSummary });
  },
);
