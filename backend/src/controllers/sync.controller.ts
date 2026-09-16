import { Request, Response } from "express";
import { SyncService } from "../services/sync.service";

export const processBatchSync = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { actions } = req.body;

    if (!Array.isArray(actions) || actions.length === 0) {
      res
        .status(400)
        .json({ error: "Actions parameter must be a non-empty array" });
      return;
    }

    const syncSummary = await SyncService.processBatch(userId, actions);
    res.status(200).json(syncSummary);
  } catch (error: any) {
    console.error("Batch Sync Processing Error:", error);
    res.status(500).json({
      error: "Failed to process offline sync batch",
      details: error.message,
    });
  }
};
