import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CropStatus, Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schemas ─────────────────────────────────────────────────────────────

const createCropCycleSchema = z.object({
  cropType: z.string().optional().default("corn"),
  variety: z.string().optional().nullable(),
  plantingDate: z.string().min(1, "plantingDate is required"),
  expectedHarvestDate: z.string().optional().nullable(),
  areaHectares: z.coerce.number().positive("areaHectares must be a positive number"),
});

const updateStatusSchema = z.object({
  status: z.enum(Object.values(CropStatus) as [CropStatus, ...CropStatus[]]),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/v1/crop-cycles/farm/:farmId */
export const createCropCycle = asyncHandler(
  async (req: Request, res: Response) => {
    const farmId = req.params["farmId"] as string;

    const parseResult = createCropCycleSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const {
      cropType,
      variety,
      plantingDate,
      expectedHarvestDate,
      areaHectares,
    } = parseResult.data;

    const farm = await prisma.farm.findFirst({
      where: { id: farmId, farmerId: req.user!.id },
    });

    if (!farm) {
      throw ApiError.notFound("Farm not found or access denied");
    }

    if (farm.areaHectares == null) {
      throw ApiError.badRequest("Farm total hectares is not configured");
    }

    // Enforce area capacity constraint
    const activeAreaResult = await prisma.cropCycle.aggregate({
      where: { farmId, status: CropStatus.ACTIVE },
      _sum: { areaHectares: true },
    });

    const activeHectares = activeAreaResult._sum.areaHectares?.toNumber() ?? 0;
    const farmTotalHectares = farm.areaHectares.toNumber();

    if (activeHectares + areaHectares > farmTotalHectares) {
      throw ApiError.badRequest(
        "Total active crop-cycle area cannot exceed the farm area",
        {
          farmTotalHectares,
          activeHectares,
          remainingHectares: farmTotalHectares - activeHectares,
        },
      );
    }

    const cropCycle = await prisma.cropCycle.create({
      data: {
        farmId,
        cropType,
        variety: variety ?? null,
        plantingDate: new Date(plantingDate),
        expectedHarvestDate: expectedHarvestDate
          ? new Date(expectedHarvestDate)
          : null,
        areaHectares,
        status: CropStatus.ACTIVE,
      },
    });

    return sendSuccess(res, 201, { data: { cropCycle } });
  },
);

/** GET /api/v1/crop-cycles/farm/:farmId */
export const getFarmCropCycles = asyncHandler(
  async (req: Request, res: Response) => {
    const farmId = req.params["farmId"] as string;
    const user = req.user!;

    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        ...(user.role === Role.FARMER && { farmerId: user.id }),
      },
    });

    if (!farm) {
      throw ApiError.notFound("Farm not found or access denied");
    }

    const cropCycles = await prisma.cropCycle.findMany({
      where: { farmId },
      orderBy: { plantingDate: "desc" },
    });

    return sendSuccess(res, 200, { data: { cropCycles } });
  },
);

/** PATCH /api/v1/crop-cycles/:id/status */
export const updateCropCycleStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const existingCycle = await prisma.cropCycle.findFirst({
      where: { id, farm: { farmerId: req.user!.id } },
    });

    if (!existingCycle) {
      throw ApiError.notFound("Crop cycle not found or access denied");
    }

    const updatedCycle = await prisma.cropCycle.update({
      where: { id },
      data: { status: parseResult.data.status },
    });

    return sendSuccess(res, 200, { data: { cropCycle: updatedCycle } });
  },
);

/** DELETE /api/v1/crop-cycles/:id */
export const deleteCropCycle = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;

    const cropCycle = await prisma.cropCycle.findFirst({
      where: { id, farm: { farmerId: req.user!.id } },
    });

    if (!cropCycle) {
      throw ApiError.notFound("Crop cycle not found or access denied");
    }

    await prisma.cropCycle.delete({ where: { id } });

    return sendSuccess(res, 200, {
      message: "Crop cycle deleted successfully",
      data: { deletedCropCycle: cropCycle },
    });
  },
);
