import { Request, Response } from "express";
import prisma from "../config/prisma";
import e from "cors";
import { CropStatus } from "@prisma/client";

export const createCropCycle = async (req: Request, res: Response) => {
  const farmId = req.params.farmId as string;
  const { cropType, variety, plantingDate, expectedHarvestDate, areaHectares } =
    req.body;

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

    const cropCycle = await prisma.cropCycle.create({
      data: {
        farmId,
        cropType: cropType || "corn",
        variety: variety || null,
        plantingDate: new Date(plantingDate),
        expectedHarvestDate: expectedHarvestDate
          ? new Date(expectedHarvestDate)
          : null,
        areaHectares: parseFloat(areaHectares),
        status: CropStatus.ACTIVE,
      },
    });

    return res.status(201).json({ cropCycle });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to create crop cycle", details: error.message });
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
