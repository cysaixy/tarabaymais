import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CaseStatus, Role } from "@prisma/client";
import { FcmService } from "../services/fcm.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";
import { invalidateAnalyticsCache } from "./analyticsController";
import { invalidateOfficerAnalyticsCache } from "./officerAnalyticsController";

// ── Input schemas (Zod v4 compatible) ─────────────────────────────────────────

const updateCaseStatusSchema = z.object({
  caseType: z.enum(["EXPERT_REQUEST", "DISASTER_REPORT"]),
  status: z.enum(
    Object.values(CaseStatus) as [CaseStatus, ...CaseStatus[]],
  ),
  recommendation: z.string().optional(),
  assignedTechnicianId: z.string().optional(),
});

const createDisasterReportSchema = z.object({
  disasterType: z.string().min(1, "disasterType is required"),
  damagePercentage: z.coerce.number().min(0).max(100),
  estimatedLoss: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const resolveExpertCaseSchema = z.object({
  recommendation: z.string().min(1, "recommendation is required"),
  status: z
    .enum(Object.values(CaseStatus) as [CaseStatus, ...CaseStatus[]])
    .optional()
    .default(CaseStatus.RESOLVED),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/v1/case/pipeline */
export const getUnifiedCases = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Farmers only see their own cases; staff see all
    const expertCasesWhere =
      userRole === Role.FARMER
        ? { observation: { farmerId: userId } }
        : {};

    const disasterCasesWhere =
      userRole === Role.FARMER
        ? { farm: { farmerId: userId } }
        : {};

    const [expertRequests, disasterReports] = await Promise.all([
      prisma.expertRequest.findMany({
        where: expertCasesWhere,
        include: {
          observation: {
            include: {
              farmer: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
              cropCycle: {
                include: {
                  farm: {
                    include: {
                      farmer: {
                        select: { id: true, firstName: true, lastName: true, phone: true },
                      },
                    },
                  },
                },
              },
            },
          },
          assignedTechnician: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.disasterReport.findMany({
        where: disasterCasesWhere,
        include: {
          farm: {
            include: {
              farmer: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
          verifiedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return sendSuccess(res, 200, {
      data: {
        pipeline: {
          expertCases: expertRequests,
          disasterCases: disasterReports,
        },
      },
    });
  },
);

/** PATCH /api/v1/case/pipeline/:caseId */
export const updateCaseStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const caseId = req.params["caseId"] as string;

    const parseResult = updateCaseStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { caseType, status, recommendation, assignedTechnicianId } =
      parseResult.data;

    if (caseType === "EXPERT_REQUEST") {
      const existing = await prisma.expertRequest.findUnique({
        where: { id: caseId },
        select: { status: true, firstResponseAt: true, assignedTechnicianId: true },
      });

      if (!existing) {
        throw ApiError.notFound("Case not found");
      }

      const isFirstResponse =
        existing.status === CaseStatus.SUBMITTED && status !== CaseStatus.SUBMITTED;
      const isFirstAssignment =
        !existing.assignedTechnicianId && !!assignedTechnicianId;

      const updated = await prisma.expertRequest.update({
        where: { id: caseId },
        data: {
          status,
          ...(recommendation !== undefined && { recommendation }),
          ...(assignedTechnicianId && {
            assignedTechnician: { connect: { id: assignedTechnicianId } },
          }),
          ...(status === CaseStatus.RESOLVED && { resolvedAt: new Date() }),
          ...((isFirstResponse || isFirstAssignment) && {
            firstResponseAt: new Date(),
          }),
        },
      });
      await invalidateAnalyticsCache();
      await invalidateOfficerAnalyticsCache();
      return sendSuccess(res, 200, { data: { updatedCase: updated } });
    }

    // caseType === "DISASTER_REPORT"
    const updated = await prisma.disasterReport.update({
      where: { id: caseId },
      data: { status, verifiedById: req.user!.id },
    });
    await invalidateAnalyticsCache();
    await invalidateOfficerAnalyticsCache();
    return sendSuccess(res, 200, { data: { updatedCase: updated } });
  },
);

/** POST /api/v1/case/disaster-report/:farmId */
export const createDisasterReport = asyncHandler(
  async (req: Request, res: Response) => {
    const farmId = req.params["farmId"] as string;

    const parseResult = createDisasterReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { disasterType, damagePercentage, estimatedLoss, notes } =
      parseResult.data;

    const farm = await prisma.farm.findFirst({
      where: { id: farmId, farmerId: req.user!.id },
    });

    if (!farm) {
      throw ApiError.notFound("Farm not found or access denied");
    }

    const report = await prisma.disasterReport.create({
      data: {
        farmId,
        disasterType,
        damagePercentage,
        estimatedLoss: estimatedLoss ?? null,
        notes: notes ?? null,
        status: CaseStatus.SUBMITTED,
      },
    });

    await invalidateAnalyticsCache();
    await invalidateOfficerAnalyticsCache();

    return sendSuccess(res, 201, { data: { disasterReport: report } });
  },
);

/** PATCH /api/v1/case/expert-requests/:caseId/resolve */
export const resolveExpertCase = asyncHandler(
  async (req: Request, res: Response) => {
    const caseId = req.params["caseId"] as string;

    const parseResult = resolveExpertCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { recommendation, status } = parseResult.data;

    const existing = await prisma.expertRequest.findUnique({
      where: { id: caseId },
      select: { firstResponseAt: true, assignedTechnicianId: true },
    });

    if (!existing) {
      throw ApiError.notFound("Case not found");
    }

    const updatedCase = await prisma.expertRequest.update({
      where: { id: caseId },
      data: {
        recommendation,
        status,
        assignedTechnicianId: req.user!.id,
        resolvedAt: status === CaseStatus.RESOLVED ? new Date() : null,
        ...(!existing.firstResponseAt && { firstResponseAt: new Date() }),
      },
      include: {
        observation: { include: { farmer: true, cropCycle: true } },
      },
    });

    await FcmService.sendToUser(
      updatedCase.observation.farmerId,
      "✅ Crop Issue Recommendation Updated",
      `A field technician has responded to your observation: "${updatedCase.observation.title}"`,
      { caseId: updatedCase.id, type: "CASE_RESOLVED" },
    );

    await invalidateAnalyticsCache();

    return sendSuccess(res, 200, { data: { resolvedCase: updatedCase } });
  },
);
