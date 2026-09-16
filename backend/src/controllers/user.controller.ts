import { Request, Response } from "express";
import prisma from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schema ──────────────────────────────────────────────────────────────

const fcmTokenSchema = z.object({
  fcmToken: z.string().min(1, "fcmToken is required"),
});

// ── Controller ────────────────────────────────────────────────────────────────

/** POST /api/v1/register/fcm-token */
export const registerFcmToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = fcmTokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { fcmToken: parseResult.data.fcmToken },
    });

    sendSuccess(res, 200, { message: "FCM token updated successfully" });
  },
);
