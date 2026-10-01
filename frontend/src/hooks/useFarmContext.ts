import { useState, useEffect } from "react";
import {
  getActiveCropCycle,
  type Farm,
  type CropCycle,
} from "../services/farm.service";

export interface FarmContextData {
  farmId: string;
  farmName: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  cropCycleId: string;
  variety: string;
  plantingDate: string;
  loading: boolean;
  /** true when resolved from the API (even if no active cycle exists) */
  resolved: boolean;
}

const STORAGE_KEY = "tarabay_active_farm";

/** Shape we persist to localStorage so pages don't re-fetch on every mount. */
interface PersistedFarmContext {
  farmId: string;
  farmName: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  cropCycleId: string;
  variety: string;
  plantingDate: string;
}

const EMPTY: Omit<FarmContextData, "loading" | "resolved"> = {
  farmId: "",
  farmName: "",
  municipality: "",
  barangay: "",
  areaHectares: 0,
  cropCycleId: "",
  variety: "",
  plantingDate: "",
};

function fromPersisted(p: PersistedFarmContext): FarmContextData {
  return { ...p, loading: false, resolved: true };
}

function fromApi(farm: Farm, cycle: CropCycle): PersistedFarmContext {
  return {
    farmId: farm.id,
    farmName: farm.name,
    municipality: farm.municipality,
    barangay: farm.barangay,
    areaHectares: Number(farm.areaHectares),
    cropCycleId: cycle.id,
    variety: cycle.variety || cycle.cropType || "Mais",
    plantingDate: cycle.plantingDate,
  };
}

/**
 * Resolves the farmer's active crop cycle once, caches it in localStorage, and
 * returns the context on subsequent mounts without a network round-trip.
 *
 * All farmer pages import this hook instead of reading localStorage directly.
 */
export function useFarmContext(): FarmContextData {
  const [ctx, setCtx] = useState<FarmContextData>(() => {
    // Hydrate from cache on first render — avoids loading flash on fast devices
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedFarmContext;
        if (parsed.farmId && parsed.cropCycleId) {
          return fromPersisted(parsed);
        }
      }
    } catch {
      // ignore corrupt cache
    }
    return { ...EMPTY, loading: true, resolved: false };
  });

  useEffect(() => {
    // Already hydrated from localStorage — skip network call
    if (ctx.resolved) return;

    let cancelled = false;

    const resolve = async () => {
      try {
        const active = await getActiveCropCycle();
        if (cancelled) return;

        if (active) {
          const persisted = fromApi(active.farm, active.cropCycle);
          // Write back to localStorage so other pages / mounts are instant
          localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
          setCtx(fromPersisted(persisted));
        } else {
          // Farmer has no farm yet (brand-new, pre-onboarding)
          setCtx({ ...EMPTY, loading: false, resolved: true });
        }
      } catch {
        if (cancelled) return;
        // Keep whatever we have (could be stale cache); mark resolved
        setCtx((prev) => ({ ...prev, loading: false, resolved: true }));
      }
    };

    void resolve();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ctx;
}

/**
 * Writes a freshly-created farm + crop cycle to the shared localStorage cache.
 * Call this from FarmerOnboardingPage after all three API calls succeed so
 * every farmer page hydrates instantly without a network round-trip.
 */
export function persistFarmContext(farm: Farm, cycle: CropCycle): void {
  const persisted = fromApi(farm, cycle);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

/**
 * Clears the cached farm context.
 * Call on logout so the next farmer session starts fresh.
 */
export function clearFarmContext(): void {
  localStorage.removeItem(STORAGE_KEY);
}
