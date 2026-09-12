import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CaseStatus, SeverityLevel, ActivityType } from "@prisma/client";
import { uploadToSupabase } from "../utils/uploadToSupabase";

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
  const { title, description, severity } = req.body;

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
    console.log("Image URL:", imageUrl);
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file);
    }

    const observation = await prisma.observation.create({
      data: {
        cropCycleId: cropCycleId as string,
        farmerId: req.user!.id,
        title,
        description,
        imageUrl: imageUrl || null,
        severity: severity || SeverityLevel.LOW,
      },
    });

    let expertCase = null;
    if (
      severity === SeverityLevel.HIGH ||
      severity === SeverityLevel.CRITICAL
    ) {
      expertCase = await prisma.expertRequest.create({
        data: {
          observationId: observation.id,
          status: CaseStatus.SUBMITTED,
        },
      });
    }

    return res.status(201).json({ observation, autoEscalatedCase: expertCase });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to record observation", details: error.message });
  }
};
