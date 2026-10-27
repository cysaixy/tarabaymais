/**
 * Growth-stage computation for corn (maize) crop cycles.
 *
 * Stage is derived from days-after-planting (DAP) for ACTIVE crop cycles only.
 * Thresholds are named constants so variety-specific durations can be added later.
 *
 * The SQL CASE expression mirrors this logic exactly and is used in
 * `$queryRaw` queries so the database does the grouping (no N+1).
 */

export const GROWTH_STAGE_THRESHOLDS = {
  SEEDLING_MAX: 30,
  VEGETATIVE_MAX: 60,
  TASSELING_MAX: 80,
  SILKING_MAX: 100,
  GRAIN_FILL_MAX: 120,
} as const;

export type GrowthStage =
  | "SEEDLING"
  | "VEGETATIVE"
  | "TASSELING"
  | "SILKING"
  | "GRAIN_FILL"
  | "HARVEST_READY";

export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  SEEDLING: "Seedling",
  VEGETATIVE: "Vegetative",
  TASSELING: "Tasseling",
  SILKING: "Silking",
  GRAIN_FILL: "Grain Fill",
  HARVEST_READY: "Harvest-ready",
} as const;

/** Compute growth stage from plantingDate and a reference date (days after planting). */
export function computeGrowthStage(
  plantingDate: Date | string,
  referenceDate: Date | string = new Date(),
): GrowthStage | null {
  const planted = new Date(plantingDate);
  const ref = new Date(referenceDate);
  if (Number.isNaN(planted.getTime()) || Number.isNaN(ref.getTime())) return null;

  const dap = Math.floor(
    (ref.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dap < 0) return null; // not planted yet
  if (dap <= GROWTH_STAGE_THRESHOLDS.SEEDLING_MAX) return "SEEDLING";
  if (dap <= GROWTH_STAGE_THRESHOLDS.VEGETATIVE_MAX) return "VEGETATIVE";
  if (dap <= GROWTH_STAGE_THRESHOLDS.TASSELING_MAX) return "TASSELING";
  if (dap <= GROWTH_STAGE_THRESHOLDS.SILKING_MAX) return "SILKING";
  if (dap <= GROWTH_STAGE_THRESHOLDS.GRAIN_FILL_MAX) return "GRAIN_FILL";
  return "HARVEST_READY";
}

/**
 * SQL CASE expression (PostgreSQL) that computes growth_stage from planting_date,
 * bucketed in Asia/Manila time. Returns NULL for non-ACTIVE or missing cycles.
 * Use inside `$queryRaw` as: `CASE WHEN ... END AS "growthStage"`.
 */
export const GROWTH_STAGE_SQL_CASE = `
CASE
  WHEN cc."status" IS DISTINCT FROM 'active' THEN NULL
  WHEN (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - cc."planting_date")) / 86400)::int <= ${GROWTH_STAGE_THRESHOLDS.SEEDLING_MAX} THEN 'SEEDLING'
  WHEN (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - cc."planting_date")) / 86400)::int <= ${GROWTH_STAGE_THRESHOLDS.VEGETATIVE_MAX} THEN 'VEGETATIVE'
  WHEN (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - cc."planting_date")) / 86400)::int <= ${GROWTH_STAGE_THRESHOLDS.TASSELING_MAX} THEN 'TASSELING'
  WHEN (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - cc."planting_date")) / 86400)::int <= ${GROWTH_STAGE_THRESHOLDS.SILKING_MAX} THEN 'SILKING'
  WHEN (EXTRACT(epoch FROM (now() AT TIME ZONE 'Asia/Manila' - cc."planting_date")) / 86400)::int <= ${GROWTH_STAGE_THRESHOLDS.GRAIN_FILL_MAX} THEN 'GRAIN_FILL'
  ELSE 'HARVEST_READY'
END
`.trim();
