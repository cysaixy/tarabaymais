import { Request, Response } from "express";
import prisma from "../config/prisma";
import e from "cors";
import { CropStatus } from "@prisma/client";

export const createCropCycle = async (req: Request, res: Response) => {
  const farmId = req.params.farmId as string;
  const { cropType, variety, plantingDate, expectedHarvestDate, areaHectares } =
    req.body;

  const requestedArea = Number(areaHectares);

  if (!Number.isFinite(requestedArea) || requestedArea <= 0) {
    return res.status(400).json({
      error: "areaHectares must be a positive number",
    });
  }

  try {
    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        farmerId: req.user!.id,
      },
    });

    if (!farm) {
      return res.status(404).json({
        error: "Farm not found or access denied",
      });
    }

    if (farm.areaHectares == null) {
      return res.status(400).json({
        error: "Farm total hectares is not configured",
      });
    }

    const activeAreaResult = await prisma.cropCycle.aggregate({
      where: {
        farmId,
        status: CropStatus.ACTIVE,
      },
      _sum: {
        areaHectares: true,
      },
    });

    const activeHectares = activeAreaResult._sum.areaHectares?.toNumber() ?? 0;

    const farmTotalHectares = farm.areaHectares.toNumber();
    const totalRequestedHectares = activeHectares + requestedArea;

    if (totalRequestedHectares > farmTotalHectares) {
      return res.status(400).json({
        error: "Total active crop-cycle area cannot exceed the farm area",
        farmTotalHectares,
        activeHectares,
        remainingHectares: farmTotalHectares - activeHectares,
      });
    }

    const cropCycle = await prisma.cropCycle.create({
      data: {
        farmId,
        cropType: cropType || "corn",
        variety: variety || null,
        plantingDate: new Date(plantingDate),
        expectedHarvestDate: expectedHarvestDate
          ? new Date(expectedHarvestDate)
          : null,
        areaHectares: requestedArea,
        status: CropStatus.ACTIVE,
      },
    });

    return res.status(201).json({ cropCycle });
  } catch (error: any) {
    return res.status(400).json({
      error: "Failed to create crop cycle",
      details: error.message,
    });
  }
};

export const getFarmCropCycles = async (req: Request, res: Response) => {
  const farmId = req.params.farmId as string;

  try {
    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        farmerId: req.user!.id,
      },
    });

    if (!farm) {
      return res.status(404).json({ error: "Farm not found or access denied" });
    }

    const cropCycles = await prisma.cropCycle.findMany({
      where: { farmId },
      orderBy: { plantingDate: "desc" },
    });

    return res.status(200).json({ cropCycles });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch crop cycles", details: error.message });
  }
};

export const updateCropCycleStatus = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  if (!Object.values(CropStatus).includes(status)) {
    return res.status(400).json({ error: "Invalid crop status value" });
  }

  try {
    const existingCycle = await prisma.cropCycle.findFirst({
      where: {
        id,
        farm: { farmerId: req.user!.id },
      },
    });

    if (!existingCycle) {
      return res
        .status(404)
        .json({ error: "Crop cycle not found or access denied" });
    }

    const updatedCycle = await prisma.cropCycle.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ cropCycle: updatedCycle });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to update crop cycle", details: error.message });
  }
};

export const deleteCropCycle = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const cropCycle = await prisma.cropCycle.findFirst({
      where: {
        id,
        farm: {
          farmerId: req.user!.id,
        },
      },
    });

    if (!cropCycle) {
      return res.status(404).json({
        error: "Crop cycle not found or access denied",
      });
    }

    await prisma.cropCycle.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Crop cycle deleted successfully",
      deletedCropCycle: cropCycle,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to delete crop cycle",
      details: error.message,
    });
  }
};
