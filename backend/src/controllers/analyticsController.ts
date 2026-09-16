import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role, CropStatus, CaseStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/v1/analytics/summary */
export const getSummaryAnalytics = asyncHandler(
  async (_req: Request, res: Response) => {
    const [
      totalFarmers,
      totalFarms,
      activeCycles,
      hectareAggregation,
      activeCasesCount,
      disasterLossAggregation,
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.FARMER } }),
      prisma.farm.count(),
      prisma.cropCycle.count({ where: { status: CropStatus.ACTIVE } }),
      prisma.cropCycle.aggregate({
        where: { status: CropStatus.ACTIVE },
        _sum: { areaHectares: true },
      }),
      prisma.expertRequest.count({
        where: {
          status: {
            in: [
              CaseStatus.SUBMITTED,
              CaseStatus.UNDER_REVIEW,
              CaseStatus.INSPECTED,
            ],
          },
        },
      }),
      prisma.disasterReport.aggregate({
        _sum: { estimatedLoss: true },
        _avg: { damagePercentage: true },
        _count: { id: true },
      }),
    ]);

    return sendSuccess(res, 200, {
      data: {
        summary: {
          totalFarmers,
          totalFarms,
          activeCropCycles: activeCycles,
          totalActiveHectares: hectareAggregation._sum.areaHectares ?? 0,
          pendingExpertCases: activeCasesCount,
          disasterMetrics: {
            totalReports: disasterLossAggregation._count.id,
            totalEstimatedLossPHP:
              disasterLossAggregation._sum.estimatedLoss ?? 0,
            averageDamagePercentage:
              disasterLossAggregation._avg.damagePercentage ?? 0,
          },
        },
      },
    });
  },
);

/** GET /api/v1/analytics/barangays */
export const getBarangayDistribution = asyncHandler(
  async (_req: Request, res: Response) => {
    const barangayData = await prisma.farm.groupBy({
      by: ["barangay"],
      _count: { id: true },
      _sum: { areaHectares: true },
      orderBy: { barangay: "asc" },
    });

    return sendSuccess(res, 200, { data: { barangays: barangayData } });
  },
);
