import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role, CropStatus, CaseStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { getOrSet, invalidate, invalidatePrefix } from "../lib/cache";

// ── Cache keys & TTLs ──────────────────────────────────────────────────────────
const CACHE_KEYS = {
  SUMMARY: 'analytics:summary',
  BARANGAYS: 'analytics:barangays',
} as const;

const CACHE_TTL = {
  SUMMARY: 300,      // 5 minutes
  BARANGAYS: 900,    // 15 minutes
} as const;

// ── Serialization helpers ──────────────────────────────────────────────────────
function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  // Prisma Decimal has .toNumber()
  if (typeof v === 'object' && v !== null && typeof (v as { toNumber?: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/v1/analytics/summary */
export const getSummaryAnalytics = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getOrSet(
      CACHE_KEYS.SUMMARY,
      CACHE_TTL.SUMMARY,
      async () => {
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

        return {
          totalFarmers: toNumber(totalFarmers),
          totalFarms: toNumber(totalFarms),
          activeCropCycles: toNumber(activeCycles),
          totalActiveHectares: toNumber(hectareAggregation._sum.areaHectares),
          pendingExpertCases: toNumber(activeCasesCount),
          disasterMetrics: {
            totalReports: toNumber(disasterLossAggregation._count.id),
            totalEstimatedLossPHP: toNumber(disasterLossAggregation._sum.estimatedLoss),
            averageDamagePercentage: toNumber(disasterLossAggregation._avg.damagePercentage),
          },
        };
      },
      { jitterSec: 30 }
    );

    return sendSuccess(res, 200, {
      data: {
        summary: data,
      },
    });
  },
);

/** GET /api/v1/analytics/barangays */
export const getBarangayDistribution = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getOrSet(
      CACHE_KEYS.BARANGAYS,
      CACHE_TTL.BARANGAYS,
      async () => {
        const barangayData = await prisma.farm.groupBy({
          by: ["barangay"],
          _count: { id: true },
          _sum: { areaHectares: true },
          orderBy: { barangay: "asc" },
        });

        // Open cases per barangay
        const openCasesRows = await prisma.$queryRawUnsafe<{
          barangay: string; count: string;
        }[]>(
          `SELECT f."barangay" AS barangay, COUNT(*)::text AS count
           FROM "expert_requests" er
           JOIN "observations" o ON er."observation_id" = o.id
           JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
           JOIN "farms" f ON cc."farm_id" = f.id
           WHERE er.status IN ('submitted','under_review','inspected')
           GROUP BY f."barangay"`,
        );
        const openCasesMap = new Map<string, number>();
        for (const r of openCasesRows) {
          openCasesMap.set(r.barangay, toNumber(r.count));
        }

        // Disaster count per barangay
        const disasterRows = await prisma.$queryRawUnsafe<{
          barangay: string; count: string;
        }[]>(
          `SELECT f."barangay" AS barangay, COUNT(*)::text AS count
           FROM "disaster_reports" dr
           JOIN "farms" f ON dr."farm_id" = f.id
           GROUP BY f."barangay"`,
        );
        const disasterMap = new Map<string, number>();
        for (const r of disasterRows) {
          disasterMap.set(r.barangay, toNumber(r.count));
        }

        // Convert BigInt/Decimal to plain numbers for JSON serialization
        return barangayData.map((row) => {
          const openCases = openCasesMap.get(row.barangay) ?? 0;
          const disasterCount = disasterMap.get(row.barangay) ?? 0;
          const farmCount = toNumber(row._count.id);
          const totalAreaHectares = toNumber(row._sum.areaHectares);

          // Risk score formula (0-100, higher = worse risk):
          //   risk = min(100, (openCases/farms)*40 + (disasterCount/farms)*30)
          // Baseline 0 risk; each open case per farm adds 40 points, each
          // disaster per farm adds 30 points, clamped to 100.
          // avgHealthScore (100 - risk) kept for backward compatibility.
          const healthScore = farmCount > 0
            ? Math.round(
                100
                - (openCases / farmCount) * 40
                - (disasterCount / farmCount) * 30,
              )
            : 0;
          const riskScore = Math.max(0, Math.min(100, 100 - healthScore));

          return {
            barangay: row.barangay,
            farms: farmCount,
            hectares: totalAreaHectares,
            openCases,
            avgHealthScore: Math.max(0, Math.min(100, healthScore)),
            riskScore,
            disasterCount,
          };
        });
      },
      { jitterSec: 60 },
    );

    return sendSuccess(res, 200, { data: { barangays: data } });
  },
);

// ── Invalidation helpers (called by mutators) ──────────────────────────────────
export async function invalidateAnalyticsCache(): Promise<void> {
  await invalidate(CACHE_KEYS.SUMMARY);
  await invalidate(CACHE_KEYS.BARANGAYS);
  await invalidatePrefix("officer:analytics:");
}
