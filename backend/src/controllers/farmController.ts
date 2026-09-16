import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schemas ─────────────────────────────────────────────────────────────

const createFarmSchema = z.object({
  name: z.string().min(1, "name is required"),
  municipality: z.string().min(1, "municipality is required"),
  barangay: z.string().min(1, "barangay is required"),
  areaHectares: z.coerce.number().positive("areaHectares must be positive"),
  latitude: z.coerce.number().finite().optional().nullable(),
  longitude: z.coerce.number().finite().optional().nullable(),
});

const updateFarmSchema = z.object({
  name: z.string().min(1).optional(),
  municipality: z.string().min(1).optional(),
  barangay: z.string().min(1).optional(),
  areaHectares: z.coerce.number().positive().optional(),
  latitude: z.coerce.number().finite().optional().nullable(),
  longitude: z.coerce.number().finite().optional().nullable(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the farm only if it belongs to the requesting user. */
const findOwnedFarm = (farmId: string, farmerId: string) =>
  prisma.farm.findFirst({ where: { id: farmId, farmerId } });

// ── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/v1/farm */
export const createFarm = asyncHandler(async (req: Request, res: Response) => {
  const parseResult = createFarmSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw ApiError.badRequest(
      "Invalid request body",
      parseResult.error.flatten().fieldErrors,
    );
  }

  const { name, municipality, barangay, areaHectares, latitude, longitude } =
    parseResult.data;

  const farm = await prisma.farm.create({
    data: {
      farmerId: req.user!.id,
      name,
      municipality,
      barangay,
      areaHectares,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });

  return sendSuccess(res, 201, { data: { farm } });
});

/** GET /api/v1/farm */
export const getMyFarms = asyncHandler(async (req: Request, res: Response) => {
  const farms = await prisma.farm.findMany({
    where: { farmerId: req.user!.id },
    include: { cropCycles: true },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, 200, { data: { farms } });
});

/** PATCH /api/v1/farm/:farmId */
export const updateFarm = asyncHandler(async (req: Request, res: Response) => {
  const farmId = req.params["farmId"] as string;

  const parseResult = updateFarmSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw ApiError.badRequest(
      "Invalid request body",
      parseResult.error.flatten().fieldErrors,
    );
  }

  const farm = await findOwnedFarm(farmId, req.user!.id);
  if (!farm) {
    throw ApiError.notFound("Farm not found");
  }

  const { name, municipality, barangay, areaHectares, latitude, longitude } =
    parseResult.data;

  const updatedFarm = await prisma.farm.update({
    where: { id: farmId },
    data: {
      ...(name !== undefined && { name }),
      ...(municipality !== undefined && { municipality }),
      ...(barangay !== undefined && { barangay }),
      ...(areaHectares !== undefined && { areaHectares }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
    },
  });

  return sendSuccess(res, 200, { data: { farm: updatedFarm } });
});

/** DELETE /api/v1/farm/:farmId */
export const deleteFarm = asyncHandler(async (req: Request, res: Response) => {
  const farmId = req.params["farmId"] as string;

  const farm = await prisma.farm.findFirst({
    where: { id: farmId, farmerId: req.user!.id },
    select: {
      id: true,
      _count: { select: { cropCycles: true } },
    },
  });

  if (!farm) {
    throw ApiError.notFound("Farm not found");
  }

  await prisma.farm.delete({ where: { id: farmId } });

  return sendSuccess(res, 200, {
    message: "Farm deleted successfully",
    data: { deletedCropCycles: farm._count.cropCycles },
  });
});
