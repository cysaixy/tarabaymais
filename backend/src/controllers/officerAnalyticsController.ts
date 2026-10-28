import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";
import { getOrSet, invalidatePrefix } from "../lib/cache";
import { hashKey } from "../lib/cache";
import { GROWTH_STAGE_SQL_CASE } from "../lib/growthStage";
import { computeScanVerdict } from "../lib/scanVerdict";

// ── Cache ────────────────────────────────────────────────────────────────
const CACHE_PREFIX = "officer:analytics";
const CACHE_TTL_SEC = 120;

function cacheKey(parts: string[]): string {
  return `${CACHE_PREFIX}:${hashKey(parts.join(":"))}`;
}

export async function invalidateOfficerAnalyticsCache(): Promise<void> {
  await invalidatePrefix(`${CACHE_PREFIX}:`);
}

// ── Shared helpers ──────────────────────────────────────────────────────

const baseQuerySchema = z.object({
  barangay: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toNumber?: () => number }).toNumber === "function"
  ) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function parseDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to
    ? new Date(`${to}T23:59:59.999+08:00`)
    : new Date();
  const fromDate = from
    ? new Date(`${from}T00:00:00+08:00`)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const lengthMs = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - lengthMs), to: new Date(from.getTime()) };
}

/** Barangay WHERE fragment. Always returns at least one param slot. */
function barangayWhere(barangay?: string): { whereSql: string; params: unknown[] } {
  if (!barangay) return { whereSql: "TRUE", params: [] };
  return { whereSql: "f.\"barangay\" ILIKE $1", params: [`%${barangay}%`] };
}

function delta(current: number | null, previous: number | null) {
  if (current === null) return { absolute: null, percent: null };
  if (previous === null || previous === 0) {
    return { absolute: current, percent: current > 0 ? 100 : 0 };
  }
  return {
    absolute: current - previous,
    percent: Math.round(((current - previous) / previous) * 100),
  };
}

/** Fill a daily sparkline map into points for the current period (cumulative). */
function fillSparkline(
  rows: { day: string; count: string }[],
  fromDate: Date,
  days: number,
  cumulative = false,
): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, toNumber(r.count));
  const points: { date: string; value: number }[] = [];
  let running = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const v = map.get(ds) ?? 0;
    running = cumulative ? running + v : v;
    points.push({ date: ds, value: running });
  }
  return points;
}

/** Fill a weekly zero-filled series for scan trends. weekStart = Monday (Asia/Manila). */
function fillWeeklySeries(
  rows: { week: string; healthy: string; flagged: string }[],
  fromDate: Date,
  toDate: Date,
): { weekStart: string; healthy: number; flagged: number }[] {
  const map = new Map<string, { healthy: number; flagged: number }>();
  for (const r of rows) {
    map.set(r.week, { healthy: toNumber(r.healthy), flagged: toNumber(r.flagged) });
  }

  // Start from the Monday of the week containing fromDate.
  const start = new Date(fromDate);
  const day = start.getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const points: { weekStart: string; healthy: number; flagged: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= toDate) {
    const ws = cursor.toISOString().slice(0, 10);
    points.push({ weekStart: ws, ...(map.get(ws) ?? { healthy: 0, flagged: 0 }) });
    cursor.setDate(cursor.getDate() + 7);
  }
  return points;
}

// ── Controllers ─────────────────────────────────────────────────────────

/** GET /officer/analytics/overview */
export const getOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = baseQuerySchema.safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay, from, to } = parse.data;
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const prev = previousPeriod(fromDate, toDate);
    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) || 1;
    const bw = barangayWhere(barangay);

    const cacheKeyStr = cacheKey(["overview", barangay ?? "", from ?? "", to ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const bParams = bw.params;
        const p = bParams.length;

        // ── Current period ──
        const [
          totalFarmsRow,
          activeHectaresRow,
          openCasesRow,
          disasterReportsRow,
          avgResponseRow,
          resolvedCasesRow,
        ] = await Promise.all([
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "farms" f WHERE ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ sum: string }[]>(
            `SELECT COALESCE(SUM(cc."area_hectares"), 0)::text AS sum
             FROM "crop_cycles" cc
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE cc."status" = 'active' AND ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er.status IN ('submitted','under_review','inspected') AND ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "disaster_reports" dr
             JOIN "farms" f ON dr."farm_id" = f.id
             WHERE dr."created_at" >= $${p + 1}
               AND dr."created_at" <= $${p + 2}
               AND ${bw.whereSql}`,
            ...bParams, fromDate, toDate,
          ),
          prisma.$queryRawUnsafe<{ avg: string }[]>(
            `SELECT AVG(EXTRACT(epoch FROM (er."first_response_at" - er."created_at")) / 3600)::text AS avg
             FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er."first_response_at" IS NOT NULL
               AND er."created_at" >= $${p + 1}
               AND er."created_at" <= $${p + 2}
               AND ${bw.whereSql}`,
            ...bParams, fromDate, toDate,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er.status = 'resolved'
               AND er."resolved_at" >= $${p + 1}
               AND er."resolved_at" <= $${p + 2}
               AND ${bw.whereSql}`,
            ...bParams, fromDate, toDate,
          ),
        ]);

        const totalFarms = toNumber(totalFarmsRow[0]?.count);
        const activeCornHectares = toNumber(activeHectaresRow[0]?.sum);
        const openCases = toNumber(openCasesRow[0]?.count);
        const disasterReportsThisPeriod = toNumber(disasterReportsRow[0]?.count);
        const avgResponseTimeHoursRaw = toNumber(avgResponseRow[0]?.avg);
        const avgResponseTimeHours = Number.isFinite(avgResponseTimeHoursRaw) ? avgResponseTimeHoursRaw : null;
        const casesResolvedThisPeriod = toNumber(resolvedCasesRow[0]?.count);

        // ── Previous period for deltas ──
        const [
          prevTotalFarms,
          prevActiveHectares,
          prevOpenCases,
          prevDisasterReports,
          prevAvgResponseRow,
          prevResolvedCases,
        ] = await Promise.all([
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "farms" f WHERE ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ sum: string }[]>(
            `SELECT COALESCE(SUM(cc."area_hectares"), 0)::text AS sum
             FROM "crop_cycles" cc
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE cc."status" = 'active' AND ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er.status IN ('submitted','under_review','inspected') AND ${bw.whereSql}`,
            ...bParams,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "disaster_reports" dr
             JOIN "farms" f ON dr."farm_id" = f.id
             WHERE dr."created_at" >= $${p + 1} AND dr."created_at" <= $${p + 2} AND ${bw.whereSql}`,
            ...bParams, prev.from, prev.to,
          ),
          prisma.$queryRawUnsafe<{ avg: string }[]>(
            `SELECT AVG(EXTRACT(epoch FROM (er."first_response_at" - er."created_at")) / 3600)::text AS avg
             FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er."first_response_at" IS NOT NULL
               AND er."created_at" >= $${p + 1} AND er."created_at" <= $${p + 2}
               AND ${bw.whereSql}`,
            ...bParams, prev.from, prev.to,
          ),
          prisma.$queryRawUnsafe<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE er.status = 'resolved'
               AND er."resolved_at" >= $${p + 1} AND er."resolved_at" <= $${p + 2}
               AND ${bw.whereSql}`,
            ...bParams, prev.from, prev.to,
          ),
        ]);

        const prevTotalFarmsVal = toNumber(prevTotalFarms[0]?.count);
        const prevActiveHectaresVal = toNumber(prevActiveHectares[0]?.sum);
        const prevOpenCasesVal = toNumber(prevOpenCases[0]?.count);
        const prevDisasterReportsVal = toNumber(prevDisasterReports[0]?.count);
        const prevAvgResponseRaw = toNumber(prevAvgResponseRow[0]?.avg);
        const prevAvgResponse = Number.isFinite(prevAvgResponseRaw) ? prevAvgResponseRaw : null;
        const prevResolvedCasesVal = toNumber(prevResolvedCases[0]?.count);

        // ── Sparklines: daily cumulative for totals, daily for rates ──
        const [disasterSparklineRows, resolvedSparklineRows, openCasesSparklineRows] =
          await Promise.all([
            prisma.$queryRawUnsafe<{ day: string; count: string }[]>(
              `SELECT to_char(dr."created_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
                      COUNT(*)::text AS count
               FROM "disaster_reports" dr
               JOIN "farms" f ON dr."farm_id" = f.id
               WHERE dr."created_at" >= $${p + 1} AND dr."created_at" <= $${p + 2}
                 AND ${bw.whereSql}
               GROUP BY day ORDER BY day ASC`,
              ...bParams, fromDate, toDate,
            ),
            prisma.$queryRawUnsafe<{ day: string; count: string }[]>(
              `SELECT to_char(er."resolved_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
                      COUNT(*)::text AS count
               FROM "expert_requests" er
               JOIN "observations" o ON er."observation_id" = o.id
               JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
               JOIN "farms" f ON cc."farm_id" = f.id
               WHERE er.status = 'resolved'
                 AND er."resolved_at" >= $${p + 1} AND er."resolved_at" <= $${p + 2}
                 AND ${bw.whereSql}
               GROUP BY day ORDER BY day ASC`,
              ...bParams, fromDate, toDate,
            ),
            prisma.$queryRawUnsafe<{ day: string; count: string }[]>(
              `SELECT to_char(er."created_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
                      COUNT(*)::text AS count
               FROM "expert_requests" er
               JOIN "observations" o ON er."observation_id" = o.id
               JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
               JOIN "farms" f ON cc."farm_id" = f.id
               WHERE er.status IN ('submitted','under_review','inspected')
                 AND ${bw.whereSql}
               GROUP BY day ORDER BY day ASC`,
              ...bParams,
            ),
          ]);

        // Cumulative daily totals for totalFarms and activeCornHectares:
        // count farms/cycles created on or before each day in the range.
        const [farmsByDayRows, cyclesByDayRows] = await Promise.all([
          prisma.$queryRawUnsafe<{ day: string; count: string }[]>(
            `SELECT to_char(f."created_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
                    COUNT(*)::text AS count
             FROM "farms" f
             WHERE ${bw.whereSql}
               AND f."created_at" <= $${p + 1}
             GROUP BY day ORDER BY day ASC`,
            ...bParams, toDate,
          ),
          prisma.$queryRawUnsafe<{ day: string; count: string }[]>(
            `SELECT to_char(cc."created_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
                    COUNT(*)::text AS count
             FROM "crop_cycles" cc
             JOIN "farms" f ON cc."farm_id" = f.id
             WHERE cc."status" = 'active'
               AND ${bw.whereSql}
               AND cc."created_at" <= $${p + 1}
             GROUP BY day ORDER BY day ASC`,
            ...bParams, toDate,
          ),
        ]);

        return {
          totalFarms: {
            value: totalFarms,
            delta: delta(totalFarms, prevTotalFarmsVal),
            sparkline: fillSparkline(farmsByDayRows, fromDate, days, true),
          },
          activeCornHectares: {
            value: activeCornHectares,
            delta: delta(activeCornHectares, prevActiveHectaresVal),
            sparkline: fillSparkline(cyclesByDayRows, fromDate, days, true),
          },
          openCases: {
            value: openCases,
            delta: delta(openCases, prevOpenCasesVal),
            sparkline: fillSparkline(openCasesSparklineRows, fromDate, days),
          },
          disasterReportsThisPeriod: {
            value: disasterReportsThisPeriod,
            delta: delta(disasterReportsThisPeriod, prevDisasterReportsVal),
            sparkline: fillSparkline(disasterSparklineRows, fromDate, days),
          },
          avgResponseTimeHours: {
            value: avgResponseTimeHours,
            delta:
              avgResponseTimeHours !== null && prevAvgResponse !== null
                ? delta(avgResponseTimeHours, prevAvgResponse)
                : { absolute: null, percent: null },
            sparkline: [],
          },
          casesResolvedThisPeriod: {
            value: casesResolvedThisPeriod,
            delta: delta(casesResolvedThisPeriod, prevResolvedCasesVal),
            sparkline: fillSparkline(resolvedSparklineRows, fromDate, days),
          },
        };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { overview: data } });
  },
);

/** GET /officer/analytics/crop-stages */
export const getCropStages = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = baseQuerySchema.safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay } = parse.data;
    const bw = barangayWhere(barangay);
    const cacheKeyStr = cacheKey(["crop-stages", barangay ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const rows = await prisma.$queryRawUnsafe<{
          growthStage: string; farmCount: string; totalArea: string;
        }[]>(
          `SELECT ${GROWTH_STAGE_SQL_CASE} AS "growthStage",
                  COUNT(DISTINCT f.id)::text AS "farmCount",
                  COALESCE(SUM(cc."area_hectares"), 0)::text AS "totalArea"
           FROM "crop_cycles" cc
           JOIN "farms" f ON cc."farm_id" = f.id
           WHERE cc."status" = 'active' AND ${bw.whereSql}
           GROUP BY "growthStage"
           ORDER BY "growthStage"`,
          ...bw.params,
        );

        const stages: Record<string, { farmCount: number; totalAreaHectares: number }> = {
          SEEDLING: { farmCount: 0, totalAreaHectares: 0 },
          VEGETATIVE: { farmCount: 0, totalAreaHectares: 0 },
          TASSELING: { farmCount: 0, totalAreaHectares: 0 },
          SILKING: { farmCount: 0, totalAreaHectares: 0 },
          GRAIN_FILL: { farmCount: 0, totalAreaHectares: 0 },
          HARVEST_READY: { farmCount: 0, totalAreaHectares: 0 },
        };

        for (const r of rows) {
          const stage = r.growthStage ?? "SEEDLING";
          if (stages[stage] !== undefined) {
            stages[stage] = { farmCount: toNumber(r.farmCount), totalAreaHectares: toNumber(r.totalArea) };
          }
        }

        return { stages };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { cropStages: data } });
  },
);

/** GET /officer/analytics/scan-trends */
export const getScanTrends = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = baseQuerySchema.safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay, from, to } = parse.data;
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const cacheKeyStr = cacheKey(["scan-trends", barangay ?? "", from ?? "", to ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        // All bucketing uses Asia/Manila time. Verdict computed via shared
        // computeScanVerdict rule and stored on PlantScan.verdict.
        const rows = await prisma.$queryRawUnsafe<{
          week: string; healthy: string; flagged: string;
        }[]>(
          `SELECT to_char(
                    date_trunc('week', ps."created_at" AT TIME ZONE 'Asia/Manila'),
                    'YYYY-MM-DD'
                  ) AS "week",
                  COUNT(*) FILTER (WHERE ps."verdict" = 'healthy')::text AS "healthy",
                  COUNT(*) FILTER (WHERE ps."verdict" = 'flagged')::text AS "flagged"
           FROM "plant_scans" ps
           WHERE ps."created_at" >= $1 AND ps."created_at" <= $2
             AND ($3::text IS NULL OR EXISTS (
               SELECT 1 FROM "farms" f
               JOIN "crop_cycles" cc ON cc."farm_id" = f.id
               WHERE cc.id = ps."crop_cycle_id" AND f."barangay" ILIKE $4
             ))
           GROUP BY "week" ORDER BY "week" ASC`,
          fromDate, toDate, barangay ?? null, `%${barangay ?? ""}%`,
        );

        return {
          weekly: fillWeeklySeries(rows, fromDate, toDate),
        };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { scanTrends: data } });
  },
);

/** GET /officer/analytics/top-issues */
export const getTopIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = baseQuerySchema.safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay, from, to } = parse.data;
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const cacheKeyStr = cacheKey(["top-issues", barangay ?? "", from ?? "", to ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const scanRows = await prisma.$queryRawUnsafe<{
          diagnosis: string; severity: string; cnt: string;
        }[]>(
          `SELECT COALESCE(NULLIF(ps."diagnosis", ''), 'Unknown') AS "diagnosis",
                  COALESCE(ps."severity", 'medium') AS "severity",
                  COUNT(*)::text AS "cnt"
           FROM "plant_scans" ps
           WHERE ps."created_at" >= $1 AND ps."created_at" <= $2
             AND ($3::text IS NULL OR EXISTS (
               SELECT 1 FROM "farms" f
               JOIN "crop_cycles" cc ON cc."farm_id" = f.id
               WHERE cc.id = ps."crop_cycle_id" AND f."barangay" ILIKE $4
             ))
           GROUP BY "diagnosis", "severity"`,
          fromDate, toDate, barangay ?? null, `%${barangay ?? ""}%`,
        );

        const obsRows = await prisma.$queryRawUnsafe<{
          diagnosis: string; severity: string; cnt: string;
        }[]>(
          `SELECT COALESCE(NULLIF((o."ai_diagnosis"->>'diseaseDetected'), ''), 'Unknown') AS "diagnosis",
                  COALESCE(o."severity", 'medium') AS "severity",
                  COUNT(*)::text AS "cnt"
           FROM "observations" o
           JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
           JOIN "farms" f ON cc."farm_id" = f.id
           WHERE o."scan_id" IS NULL
             AND o."created_at" >= $1 AND o."created_at" <= $2
             AND ($3::text IS NULL OR f."barangay" ILIKE $4)
             AND o."ai_diagnosis" IS NOT NULL
           GROUP BY "diagnosis", "severity"`,
          fromDate, toDate, barangay ?? null, `%${barangay ?? ""}%`,
        );

        const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

        const agg = new Map<string, { count: number; severitySum: number; severityCount: number }>();

        const add = (diagnosis: string, severity: string, count: number) => {
          const existing = agg.get(diagnosis) ?? { count: 0, severitySum: 0, severityCount: 0 };
          existing.count += count;
          existing.severitySum += (SEVERITY_WEIGHT[severity.toLowerCase()] ?? 2) * count;
          existing.severityCount += count;
          agg.set(diagnosis, existing);
        };

        for (const r of scanRows) add(r.diagnosis, r.severity, toNumber(r.cnt));
        for (const r of obsRows) add(r.diagnosis, r.severity, toNumber(r.cnt));

        const issues = Array.from(agg.entries())
          .map(([diagnosis, a]) => ({
            diagnosis,
            count: a.count,
            avgSeverity: a.severityCount > 0 ? Math.round((a.severitySum / a.severityCount) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        return { topIssues: issues };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { topIssues: data } });
  },
);

/** GET /officer/analytics/disasters?groupBy=barangay|month|type */
export const getDisasters = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = z
      .object({
        barangay: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        groupBy: z.enum(["barangay", "month", "type"]).default("barangay"),
      })
      .safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay, from, to, groupBy } = parse.data;
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const bw = barangayWhere(barangay);
    const cacheKeyStr = cacheKey(["disasters", groupBy, barangay ?? "", from ?? "", to ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const p = bw.params.length;

        let groupSql: string;
        if (groupBy === "barangay") {
          groupSql = `
            SELECT f."barangay" AS "groupKey",
                   COUNT(*)::text AS "count",
                   COALESCE(SUM(dr."estimated_loss"), 0)::text AS "totalEstimatedLoss"
            FROM "disaster_reports" dr
            JOIN "farms" f ON dr."farm_id" = f.id
            WHERE dr."created_at" >= $${p + 1} AND dr."created_at" <= $${p + 2}
              AND ${bw.whereSql}
            GROUP BY f."barangay"
            ORDER BY "count" DESC`;
        } else if (groupBy === "month") {
          groupSql = `
            SELECT to_char(dr."created_at" AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS "groupKey",
                   COUNT(*)::text AS "count",
                   COALESCE(SUM(dr."estimated_loss"), 0)::text AS "totalEstimatedLoss"
            FROM "disaster_reports" dr
            JOIN "farms" f ON dr."farm_id" = f.id
            WHERE dr."created_at" >= $${p + 1} AND dr."created_at" <= $${p + 2}
              AND ${bw.whereSql}
            GROUP BY "groupKey"
            ORDER BY "groupKey" ASC`;
        } else {
          groupSql = `
            SELECT dr."disaster_type" AS "groupKey",
                   COUNT(*)::text AS "count",
                   COALESCE(SUM(dr."estimated_loss"), 0)::text AS "totalEstimatedLoss"
            FROM "disaster_reports" dr
            JOIN "farms" f ON dr."farm_id" = f.id
            WHERE dr."created_at" >= $${p + 1} AND dr."created_at" <= $${p + 2}
              AND ${bw.whereSql}
            GROUP BY dr."disaster_type"
            ORDER BY "count" DESC`;
        }

        const rows = await prisma.$queryRawUnsafe<{
          groupKey: string; count: string; totalEstimatedLoss: string;
        }[]>(groupSql, ...bw.params, fromDate, toDate);

        return {
          groupBy,
          groups: rows.map((r) => ({
            groupKey: r.groupKey,
            count: toNumber(r.count),
            totalEstimatedLoss: toNumber(r.totalEstimatedLoss),
          })),
        };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { disasters: data } });
  },
);

/** GET /officer/farms/geo */
export const getFarmsGeo = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = baseQuerySchema.safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay } = parse.data;
    const bw = barangayWhere(barangay);
    const cacheKeyStr = cacheKey(["farms-geo", barangay ?? ""]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const farms = await prisma.$queryRawUnsafe<{
          id: string; name: string; barangay: string; municipality: string;
          areaHectares: string; latitude: string | null; longitude: string | null;
          growthStage: string | null; healthStatus: string; openCaseCount: string;
        }[]>(
          `WITH latest_obs AS (
             SELECT o.id, o."crop_cycle_id", o."severity", o."created_at",
                    ROW_NUMBER() OVER (PARTITION BY cc."farm_id" ORDER BY o."created_at" DESC) AS rn
             FROM "observations" o
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             WHERE o."created_at" >= now() - INTERVAL '14 days'
           ),
           open_counts AS (
             SELECT cc."farm_id" AS farm_id, COUNT(*)::text AS cnt
             FROM "expert_requests" er
             JOIN "observations" o ON er."observation_id" = o.id
             JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
             WHERE er.status IN ('submitted','under_review','inspected')
             GROUP BY cc."farm_id"
           )
           SELECT f.id, f.name, f."barangay", f.municipality,
                  f."area_hectares"::text AS "areaHectares",
                  f.latitude::text AS "latitude", f.longitude::text AS "longitude",
                  ${GROWTH_STAGE_SQL_CASE} AS "growthStage",
                  CASE
                    WHEN EXISTS (
                      SELECT 1 FROM "expert_requests" er
                      JOIN "observations" o ON er."observation_id" = o.id
                      JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
                      WHERE cc."farm_id" = f.id
                        AND er.status IN ('submitted','under_review','inspected')
                        AND o."severity" IN ('critical')
                    ) THEN 'critical'
                    WHEN EXISTS (
                      SELECT 1 FROM "expert_requests" er
                      JOIN "observations" o ON er."observation_id" = o.id
                      JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
                      WHERE cc."farm_id" = f.id
                        AND er.status IN ('submitted','under_review','inspected')
                        AND o."severity" IN ('high','medium')
                    ) THEN 'watch'
                    WHEN COALESCE(lo."severity", 'low') = 'critical' THEN 'critical'
                    WHEN COALESCE(lo."severity", 'low') IN ('high','medium') THEN 'watch'
                    ELSE 'healthy'
                  END AS "healthStatus",
                  COALESCE(oc.cnt, '0') AS "openCaseCount"
           FROM "farms" f
           LEFT JOIN LATERAL (
             SELECT cc.*
             FROM "crop_cycles" cc
             WHERE cc."farm_id" = f.id AND cc."status" = 'active'
             ORDER BY cc."planting_date" DESC, cc."created_at" DESC
             LIMIT 1
           ) cc ON TRUE
           LEFT JOIN latest_obs lo ON lo."crop_cycle_id" = cc.id AND lo.rn = 1
           LEFT JOIN open_counts oc ON oc.farm_id = f.id
           WHERE ${bw.whereSql}`,
          ...bw.params,
        );

        const farmsWithoutLocationRow = await prisma.$queryRawUnsafe<{ count: string }[]>(
          `SELECT COUNT(*)::text AS count FROM "farms" f
           WHERE (f.latitude IS NULL OR f.longitude IS NULL) AND ${bw.whereSql}`,
          ...bw.params,
        );
        const farmsWithoutLocation = toNumber(farmsWithoutLocationRow[0]?.count);

        const disasters = await prisma.$queryRawUnsafe<{
          id: string; disasterType: string; estimatedLoss: string;
          latitude: string; longitude: string; farmName: string; barangay: string;
        }[]>(
          `SELECT dr.id, dr."disaster_type", dr."estimated_loss"::text AS "estimatedLoss",
                  f.latitude::text AS "latitude", f.longitude::text AS "longitude",
                  f.name AS "farmName", f."barangay" AS "barangay"
           FROM "disaster_reports" dr
           JOIN "farms" f ON dr."farm_id" = f.id
           WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL
             AND ${bw.whereSql}`,
          ...bw.params,
        );

        const features = farms.map((f) => {
          const hasGps = f.latitude != null && f.longitude != null
            && f.latitude !== "" && f.longitude !== "";
          return {
            type: "Feature" as const,
            properties: {
              id: f.id, name: f.name, barangay: f.barangay, municipality: f.municipality,
              hectares: toNumber(f.areaHectares), growthStage: f.growthStage,
              healthStatus: f.healthStatus, openCaseCount: toNumber(f.openCaseCount),
              noGps: !hasGps,
            },
            geometry: hasGps
              ? { type: "Point" as const, coordinates: [parseFloat(f.longitude!), parseFloat(f.latitude!)] }
              : null,
          };
        });

        const disasterFeatures = disasters.map((d) => ({
          type: "Feature" as const,
          properties: {
            id: d.id, kind: "disaster", disasterType: d.disasterType,
            estimatedLoss: toNumber(d.estimatedLoss), farmName: d.farmName, barangay: d.barangay,
          },
          geometry: { type: "Point" as const, coordinates: [parseFloat(d.longitude), parseFloat(d.latitude)] },
        }));

        return {
          type: "FeatureCollection",
          features: [...features, ...disasterFeatures],
          farmsWithoutLocation,
        };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { farmsGeo: data } });
  },
);

/** GET /officer/queue */
export const getQueue = asyncHandler(
  async (req: Request, res: Response) => {
    const parse = z
      .object({
        barangay: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).default(20),
        offset: z.coerce.number().min(0).default(0),
        type: z.enum(["case", "observation", "disaster"]).optional(),
        history: z.coerce.boolean().default(false),
      })
      .safeParse(req.query);
    if (!parse.success) {
      throw ApiError.badRequest("Invalid query parameters", parse.error.flatten().fieldErrors);
    }

    const { barangay, limit: limitVal, offset: offsetVal, type, history } = parse.data;
    const cacheKeyStr = cacheKey([
      "queue",
      barangay ?? "",
      type ?? "",
      history ? "history" : "actionable",
      String(limitVal),
      String(offsetVal),
    ]);

    const data = await getOrSet(
      cacheKeyStr,
      CACHE_TTL_SEC,
      async () => {
        const bgParam = `%${barangay ?? ""}%`;

        // Fetch all matching items (unlimited) for correct total + cursor pagination.
        const [cases, observations, disasters] = await Promise.all([
          type !== "observation" && type !== "disaster"
            ? prisma.$queryRawUnsafe<{
                id: string; type: string; severity: string; farmerName: string;
                farmName: string; barangay: string; summary: string;
                createdAt: string; waitingHours: string; status: string;
              }[]>(
                `SELECT er.id AS id, 'case' AS type,
                        COALESCE(o."severity", 'medium') AS severity,
                        u."first_name" || ' ' || u."last_name" AS farmerName,
                        f.name AS farmName, f."barangay" AS barangay,
                        o.title AS summary,
                        er."created_at"::text AS createdAt,
                        (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - er."created_at")) / 3600)::text AS waitingHours,
                        er.status AS status
                 FROM "expert_requests" er
                 JOIN "observations" o ON er."observation_id" = o.id
                 JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
                 JOIN "farms" f ON cc."farm_id" = f.id
                 JOIN "users" u ON o."farmer_id" = u.id
                 WHERE er.status IN (${history ? "'submitted','under_review','inspected','resolved','rejected'" : "'submitted','under_review','inspected'"})
                   AND ($1::text IS NULL OR f."barangay" ILIKE $2)
                 ORDER BY
                   CASE COALESCE(o."severity", 'medium')
                     WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
                   END,
                   er."created_at" ASC`,
                barangay ?? null, bgParam,
              )
            : [],
          type !== "case" && type !== "disaster"
            ? prisma.$queryRawUnsafe<{
                id: string; type: string; severity: string; farmerName: string;
                farmName: string; barangay: string; summary: string;
                createdAt: string; waitingHours: string; status: string;
              }[]>(
                `SELECT o.id AS id, 'observation' AS type, o."severity" AS severity,
                        u."first_name" || ' ' || u."last_name" AS farmerName,
                        f.name AS farmName, f."barangay" AS barangay,
                        o.title AS summary,
                        o."created_at"::text AS createdAt,
                        (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - o."created_at")) / 3600)::text AS waitingHours,
                        'pending' AS status
                 FROM "observations" o
                 JOIN "crop_cycles" cc ON o."crop_cycle_id" = cc.id
                 JOIN "farms" f ON cc."farm_id" = f.id
                 JOIN "users" u ON o."farmer_id" = u.id
                 WHERE o."severity" IN ('high','critical')
                   AND NOT EXISTS (SELECT 1 FROM "expert_requests" er WHERE er."observation_id" = o.id)
                   AND ($1::text IS NULL OR f."barangay" ILIKE $2)
                 ORDER BY
                   CASE o."severity" WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                   o."created_at" ASC`,
                barangay ?? null, bgParam,
              )
            : [],
          type !== "case" && type !== "observation"
            ? prisma.$queryRawUnsafe<{
                id: string; type: string; severity: string; farmerName: string;
                farmName: string; barangay: string; summary: string;
                createdAt: string; waitingHours: string; status: string;
              }[]>(
                `SELECT dr.id AS id, 'disaster' AS type,
                        CASE WHEN dr."damage_percentage" >= 50 THEN 'critical'
                             WHEN dr."damage_percentage" >= 25 THEN 'high'
                             WHEN dr."damage_percentage" >= 10 THEN 'medium'
                             ELSE 'low' END AS severity,
                        '' AS farmerName, f.name AS farmName, f."barangay" AS barangay,
                        dr."disaster_type" AS summary,
                        dr."created_at"::text AS createdAt,
                        (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - dr."created_at")) / 3600)::text AS waitingHours,
                        dr.status AS status
                 FROM "disaster_reports" dr
                 JOIN "farms" f ON dr."farm_id" = f.id
                 WHERE dr.status IN (${history ? "'submitted','under_review','inspected','resolved','rejected'" : "'submitted','under_review','inspected'"})
                   AND ($1::text IS NULL OR f."barangay" ILIKE $2)
                 ORDER BY dr."created_at" ASC`,
                barangay ?? null, bgParam,
              )
            : [],
        ]);

        const all = ([] as Array<{
          id: string; type: string; severity: string; farmerName: string;
          farmName: string; barangay: string; summary: string;
          createdAt: string; waitingHours: number; status: string; severityRank: number;
        }>).concat(
          ...cases.map((c) => ({ ...c, waitingHours: Math.round(toNumber(c.waitingHours)), severityRank: SEVERITY_ORDER[c.severity.toLowerCase()] ?? 99 })),
          ...observations.map((o) => ({ ...o, waitingHours: Math.round(toNumber(o.waitingHours)), severityRank: SEVERITY_ORDER[o.severity.toLowerCase()] ?? 99 })),
          ...disasters.map((d) => ({ ...d, waitingHours: Math.round(toNumber(d.waitingHours)), severityRank: SEVERITY_ORDER[d.severity.toLowerCase()] ?? 99 })),
        );

        all.sort((a, b) => {
          if (a.severityRank !== b.severityRank) return a.severityRank - b.severityRank;
          return b.waitingHours - a.waitingHours;
        });

        const total = all.length;
        const nextCursor = offsetVal + limitVal < total ? offsetVal + limitVal : null;
        const items = all.slice(offsetVal, offsetVal + limitVal).map(({ severityRank, ...rest }) => rest);

        return {
          items,
          total,
          nextCursor,
          limit: limitVal,
          offset: offsetVal,
        };
      },
      { jitterSec: 20 },
    );

    return sendSuccess(res, 200, { data: { queue: data } });
  },
);
