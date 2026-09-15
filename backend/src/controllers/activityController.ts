import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CaseStatus, SeverityLevel, ActivityType } from "@prisma/client";
import { uploadToSupabase } from "../utils/uploadToSupabase";
import { FcmService } from "../services/fcm.service";

export const logCropActivity = async (req: Request, res: Response) => {
  const { cropCycleId } = req.params;
  const { activityType, description, costAmount, performedAt } = req.body;

  const validActivityTypes = Object.values(ActivityType);

  if (!validActivityTypes.includes(activityType)) {
    return res.status(400).json({
      error: "Invalid activityType",
      allowedValues: validActivityTypes,
    });
  }

  try {
    const cycle = await prisma.cropCycle.findFirst({
      where: {
        id: cropCycleId as string,
        farm: {
          farmerId: req.user!.id,
        },
      },
    });

    if (!cycle) {
      return res
        .status(404)
        .json({ error: "Crop cycle not found or access denied" });
    }

    const activity = await prisma.cropActivity.create({
      data: {
        cropCycleId: cropCycleId as string,
        activityType: activityType as ActivityType,
        description,
        costAmount:
          costAmount !== undefined && costAmount !== null
            ? parseFloat(costAmount)
            : null,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
      },
    });

    return res.status(201).json({ activity });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to log activity", details: error.message });
  }
};

export const createObservation = async (req: Request, res: Response) => {
  const { cropCycleId } = req.params;
  const { title, description, severity, aiDiagnosis } = req.body;

  const validSeverities = Object.values(SeverityLevel);

  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      error: "Invalid severity",
      allowedValues: validSeverities,
    });
  }

  try {
    const cycle = await prisma.cropCycle.findFirst({
      where: {
        id: cropCycleId as string,
        farm: { farmerId: req.user!.id },
      },
    });

    if (!cycle) {
      return res
        .status(404)
        .json({ error: "Crop cycle not found or access denied" });
    }

    // Upload photo if one was provided
    let imageUrl: string | null = null;
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file);
    }

    let parsedDiagnosis = null;
    if (aiDiagnosis) {
      try {
        parsedDiagnosis =
          typeof aiDiagnosis === "string"
            ? JSON.parse(aiDiagnosis)
            : aiDiagnosis;
      } catch {
        return res
          .status(400)
          .json({ error: "Invalid JSON string format for aiDiagnosis" });
      }
    }

    const observation = await prisma.observation.create({
      data: {
        cropCycleId: cropCycleId as string,
        farmerId: req.user!.id,
        title,
        description,
        imageUrl: imageUrl || null,
        aiDiagnosis: parsedDiagnosis,
        severity: severity || SeverityLevel.LOW,
      },
    });

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

      // DISPATCH PUSH ALERT TO TECHNICIANS
      await FcmService.sendToRole(
        "TECHNICIAN",
        "🚨 High Severity Field Alert",
        `New ${severity} crop observation reported requiring inspection: "${title}"`,
        {
          caseId: autoEscalatedCase.id,
          observationId: observation.id,
          type: "EXPERT_DISPATCH",
        },
      );
    }

    return res.status(201).json({ observation, autoEscalatedCase });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to record observation", details: error.message });
  }
};
