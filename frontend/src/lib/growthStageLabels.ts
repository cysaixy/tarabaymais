/**
 * Tagalog labels for corn growth stages. Single source of truth for the
 * officer dashboard UI. Keys match the GrowthStage type from the backend.
 */

export type GrowthStageKey =
  | "SEEDLING"
  | "VEGETATIVE"
  | "TASSELING"
  | "SILKING"
  | "GRAIN_FILL"
  | "HARVEST_READY";

export const GROWTH_STAGE_TAGALOG: Record<GrowthStageKey, string> = {
  SEEDLING: "Punla",
  VEGETATIVE: "Paglaki",
  TASSELING: "Pagtatasel",
  SILKING: "Pagsisilk",
  GRAIN_FILL: "Pagbubuo ng Butil",
  HARVEST_READY: "Handa nang Anihin",
} as const;

export const GROWTH_STAGE_COLORS: Record<GrowthStageKey, string> = {
  SEEDLING: "#059669",      // emerald-600
  VEGETATIVE: "#0891b2",    // cyan-600
  TASSELING: "#d97706",     // amber-600
  SILKING: "#b45309",       // amber-700
  GRAIN_FILL: "#7c3aed",    // violet-600
  HARVEST_READY: "#047857", // emerald-800
} as const;

/** Health status colors (color-blind-safe). */
export const HEALTH_COLORS: Record<string, string> = {
  healthy: "#059669",
  watch: "#d97706",
  critical: "#dc2626",
} as const;
