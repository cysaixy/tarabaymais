import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  Prisma,
  CaseStatus,
  SeverityLevel,
  ActivityType,
  Role,
} from "@prisma/client";
import { uploadToSupabase } from "../utils/uploadToSupabase";
import { FcmService } from "../services/fcm.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schemas (Zod v4 compatible) ─────────────────────────────────────────

const logActivitySchema = z.object({
  activityType: z.enum(
    Object.values(ActivityType) as [ActivityType, ...ActivityType[]],
  ),
  description: z.string().optional(),
  costAmount: z.coerce.number().nonnegative().optional().nullable(),
  performedAt: z.string().optional(),
});

const createObservationSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  severity: z.enum(
    Object.values(SeverityLevel) as [SeverityLevel, ...SeverityLevel[]],
  ),
  aiDiagnosis: z.unknown().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/v1/activities/:cropCycleId */
export const logCropActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const cropCycleId = req.params["cropCycleId"] as string;

    const parseResult = logActivitySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { activityType, description, costAmount, performedAt } =
      parseResult.data;

    const cycle = await prisma.cropCycle.findFirst({
      where: {
        id: cropCycleId,
        farm: { farmerId: req.user!.id },
      },
    });

    if (!cycle) {
      throw ApiError.notFound("Crop cycle not found or access denied");
    }

    const activity = await prisma.cropActivity.create({
      data: {
        cropCycleId,
        activityType,
        description: description ?? "",
        costAmount: costAmount ?? null,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
      },
    });

    return sendSuccess(res, 201, { data: { activity } });
  },
);

/** POST /api/v1/observations/:cropCycleId */
export const createObservation = asyncHandler(
  async (req: Request, res: Response) => {
    const cropCycleId = req.params["cropCycleId"] as string;

    const parseResult = createObservationSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { title, description, severity, aiDiagnosis } = parseResult.data;

    const cycle = await prisma.cropCycle.findFirst({
      where: {
        id: cropCycleId,
        farm: { farmerId: req.user!.id },
      },
    });

    if (!cycle) {
      throw ApiError.notFound("Crop cycle not found or access denied");
    }

    // Upload photo if provided
    let imageUrl: string | null = null;
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file);
    }

    // Normalize aiDiagnosis: accept a JSON string or plain object
    let parsedDiagnosis:
      | Prisma.NullableJsonNullValueInput
      | Prisma.InputJsonValue = Prisma.JsonNull;

    const rawDiagnosis = aiDiagnosis as string | object | null | undefined;

    if (rawDiagnosis != null) {
      if (typeof rawDiagnosis === "string") {
        try {
          const parsed = JSON.parse(rawDiagnosis);

          parsedDiagnosis =
            parsed === null
              ? Prisma.JsonNull
              : (parsed as Prisma.InputJsonValue);
        } catch {
          throw ApiError.badRequest("Invalid JSON string for aiDiagnosis");
        }
      } else {
        parsedDiagnosis = rawDiagnosis as Prisma.InputJsonValue;
      }
    }

    const observation = await prisma.observation.create({
      data: {
        cropCycleId,
        farmerId: req.user!.id,
        title,
        description: description ?? "",
        imageUrl,
        aiDiagnosis: parsedDiagnosis,
        severity,
      },
    });

    // Auto-escalate HIGH / CRITICAL observations to the expert queue
    let autoEscalatedCase = null;
    if (
      severity === SeverityLevel.HIGH ||
      severity === SeverityLevel.CRITICAL
    ) {
      autoEscalatedCase = await prisma.expertRequest.create({
        data: {
          observationId: observation.id,
          status: CaseStatus.SUBMITTED,
        },
      });

      await FcmService.sendToRole(
        Role.TECHNICIAN,
        "🚨 High Severity Field Alert",
        `New ${severity} crop observation requires inspection: "${title}"`,
        {
          caseId: autoEscalatedCase.id,
          observationId: observation.id,
          type: "EXPERT_DISPATCH",
        },
      );
    }

    return sendSuccess(res, 201, { data: { observation, autoEscalatedCase } });
  },
);
