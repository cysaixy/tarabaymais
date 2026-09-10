import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

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
