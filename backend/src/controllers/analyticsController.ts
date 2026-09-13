import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role, CropStatus, CaseStatus } from "@prisma/client";

export const getSummaryAnalytics = async (_req: Request, res: Response) => {
  try {
    const [
      totalFarmers,
      totalFarms,
      activeCycles,
      hectareAggregation,
      activeCasesCount,
      disasterLossAggregation,
    ] = await Promise.all([
      // Total registered farmers
      prisma.user.count({ where: { role: Role.FARMER } }),

      // Total registered farms
      prisma.farm.count(),

      // Active crop cycles count
      prisma.cropCycle.count({ where: { status: CropStatus.ACTIVE } }),

      // Total active planted corn area in hectares
      prisma.cropCycle.aggregate({
        where: { status: CropStatus.ACTIVE },
        _sum: { areaHectares: true },
      }),

      // Unresolved expert request cases
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

      // Total estimated disaster losses & average damage
      prisma.disasterReport.aggregate({
        _sum: { estimatedLoss: true },
        _avg: { damagePercentage: true },
        _count: { id: true },
      }),
    ]);

    return res.status(200).json({
      summary: {
        totalFarmers,
        totalFarms,
        activeCropCycles: activeCycles,
        totalActiveHectares: hectareAggregation._sum.areaHectares || 0,
        pendingExpertCases: activeCasesCount,
        disasterMetrics: {
          totalReports: disasterLossAggregation._count.id,
          totalEstimatedLossPHP:
            disasterLossAggregation._sum.estimatedLoss || 0,
          averageDamagePercentage:
            disasterLossAggregation._avg.damagePercentage || 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to fetch summary analytics",
      details: error.message,
    });
  }
};

export const getBarangayDistribution = async (_req: Request, res: Response) => {
  try {
    // Group active farms and hectarage by barangay
    const barangayData = await prisma.farm.groupBy({
      by: ["barangay"],
      _count: { id: true },
      _sum: { areaHectares: true },
      orderBy: { barangay: "asc" },
    });

    return res.status(200).json({ barangays: barangayData });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to fetch barangay distribution",
      details: error.message,
    });
  }
};
