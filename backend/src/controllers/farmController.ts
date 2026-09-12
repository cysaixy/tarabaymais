import { Request, Response } from "express";
import prisma from "../config/prisma";

export const createFarm = async (req: Request, res: Response) => {
  const { name, municipality, barangay, areaHectares, latitude, longitude } =
    req.body;

  try {
    const farm = await prisma.farm.create({
      data: {
        farmerId: req.user!.id,
        name,
        municipality,
        barangay,
        areaHectares: parseFloat(areaHectares),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    return res.status(201).json({ farm });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to create farm", details: error.message });
  }
};

export const getMyFarms = async (req: Request, res: Response) => {
  try {
    const farms = await prisma.farm.findMany({
      where: { farmerId: req.user!.id },
      include: { cropCycles: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ farms });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: "Failed to retrieve farms", details: error.message });
  }
};

const toFiniteNumberOrNull = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN; // NaN signals "invalid"
};

const findOwnedFarm = (farmId: string, farmerId: string) =>
  prisma.farm.findFirst({
    where: { id: farmId, farmerId },
  });

// ---- controllers -----------------------------------------------------------

export const updateFarm = async (req: Request, res: Response) => {
  const farmId = req.params.farmId as string;
  const { name, municipality, barangay, areaHectares, latitude, longitude } =
    req.body;

  try {
    const farm = await findOwnedFarm(farmId, req.user!.id);
    if (!farm) {
      return res.status(404).json({ error: "Farm not found" });
    }

    // Validate areaHectares
    let parsedArea: number | undefined;
    if (areaHectares !== undefined) {
      parsedArea = Number(areaHectares);
      if (!Number.isFinite(parsedArea) || parsedArea <= 0) {
        return res
          .status(400)
          .json({ error: "areaHectares must be a positive number" });
      }
    }

    // Validate latitude
    const parsedLatitude = toFiniteNumberOrNull(latitude);
    if (Number.isNaN(parsedLatitude)) {
      return res.status(400).json({ error: "latitude must be a valid number" });
    }

    // Validate longitude
    const parsedLongitude = toFiniteNumberOrNull(longitude);
    if (Number.isNaN(parsedLongitude)) {
      return res
        .status(400)
        .json({ error: "longitude must be a valid number" });
    }

    const updatedFarm = await prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(name !== undefined && { name }),
        ...(municipality !== undefined && { municipality }),
        ...(barangay !== undefined && { barangay }),
        ...(parsedArea !== undefined && { areaHectares: parsedArea }),
        ...(parsedLatitude !== undefined && { latitude: parsedLatitude }),
        ...(parsedLongitude !== undefined && { longitude: parsedLongitude }),
      },
    });

    return res.status(200).json({ farm: updatedFarm });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to update farm",
      details: error.message,
    });
  }
};

export const deleteFarm = async (req: Request, res: Response) => {
  const farmId = req.params.farmId as string;

  try {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, farmerId: req.user!.id },
      select: {
        id: true,
        _count: { select: { cropCycles: true } },
      },
    });

    if (!farm) {
      return res.status(404).json({ error: "Farm not found" });
    }

    await prisma.farm.delete({ where: { id: farmId } });

    return res.status(200).json({
      message: "Farm deleted successfully",
      deletedCropCycles: farm._count.cropCycles,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to delete farm",
      details: error.message,
    });
  }
};
