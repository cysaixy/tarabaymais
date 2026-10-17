import { createContext, useContext } from "react";
import type { Farm, CropCycle } from "../services/farm.service";

/**
 * Shared "active farm + active crop cycle" selection, used by every farmer
 * screen that needs a cropCycleId or farmId. Backed by localStorage
 * (`tarabay_active_farm`) so the selection survives reloads and is consistent
 * across pages.
 */
export interface FarmSelectionValue {
  /** All farms owned by the signed-in farmer (from GET /farm). */
  farms: Farm[];
  /** Crop cycles for the currently selected farm (from GET /crop-cycles/farm/:id). */
  cycles: CropCycle[];

  /** Currently selected farm, or null when the farmer has none. */
  selectedFarm: Farm | null;
  /** Currently selected crop cycle, or null when the farm has none. */
  selectedCycle: CropCycle | null;

  /** True while the initial farms/cycles load is in flight. */
  loading: boolean;
  /** True while cycles for a newly selected farm are loading. */
  cyclesLoading: boolean;
  /** True once the first farms load has resolved (success or failure). */
  resolved: boolean;
  /** Set when the farms load failed (network/server). */
  error: boolean;

  /** Select a farm by id; loads its cycles and auto-selects the ACTIVE one. */
  selectFarm: (farmId: string) => void;
  /** Select a crop cycle by id within the currently selected farm. */
  selectCycle: (cropCycleId: string) => void;
  /** Re-fetch farms (and the selected farm's cycles). */
  refresh: () => Promise<void>;
  /** Clear the persisted selection (call on logout). */
  clear: () => void;
}

export const FarmSelectionContext = createContext<FarmSelectionValue | null>(
  null,
);

/** Access the shared farm/cycle selection. Must be inside FarmSelectionProvider. */
export const useFarmSelection = (): FarmSelectionValue => {
  const ctx = useContext(FarmSelectionContext);
  if (!ctx) {
    throw new Error(
      "useFarmSelection must be used within a FarmSelectionProvider",
    );
  }
  return ctx;
};

/** localStorage key (shared with the legacy useFarmContext hook). */
export const FARM_SELECTION_KEY = "tarabay_active_farm";

/** Persisted shape: enough to hydrate instantly and restore the selection. */
export interface PersistedSelection {
  farmId: string;
  cropCycleId: string;
  // Denormalized display fields kept for instant hydration on first paint.
  farmName: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  variety: string;
  plantingDate: string;
}
