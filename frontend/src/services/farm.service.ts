import { api } from "../lib/api";

export interface CreateFarmPayload {
  name: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  municipality: string;
  barangay: string;
  areaHectares: string | number;
  latitude?: string | number | null;
  longitude?: string | number | null;
  cropCycles?: CropCycle[];
}

export interface CreateCropCyclePayload {
  cropType?: string;
  variety?: string;
  plantingDate: string; // ISO or YYYY-MM-DD
  expectedHarvestDate?: string;
  areaHectares: number;
}

/** Crop cycle lifecycle status (matches Prisma CropStatus enum). */
export type CropStatus = "ACTIVE" | "HARVESTED" | "FAILED" | "CANCELLED";

export interface CropCycle {
  id: string;
  farmId: string;
  cropType: string;
  variety?: string;
  plantingDate: string;
  expectedHarvestDate?: string;
  areaHectares: string | number;
  status: CropStatus;
}

/** Lists all farms belonging to the authenticated farmer */
export const listFarms = async (): Promise<Farm[]> => {
  const { data } = await api.get("/farm");
  return data.data.farms;
};

/** Creates a new farm */
export const createFarm = async (payload: CreateFarmPayload): Promise<Farm> => {
  const { data } = await api.post("/farm", payload);
  return data.data.farm;
};

/** Partial update of a farm. Endpoint: PATCH /farm/:farmId */
export type UpdateFarmPayload = Partial<CreateFarmPayload>;

export const updateFarm = async (
  farmId: string,
  payload: UpdateFarmPayload,
): Promise<Farm> => {
  const { data } = await api.patch(`/farm/${farmId}`, payload);
  return data.data.farm;
};

/**
 * Deletes a farm (and cascades its crop cycles on the backend).
 * Endpoint: DELETE /farm/:farmId → { deletedCropCycles: number }
 */
export const deleteFarm = async (
  farmId: string,
): Promise<{ deletedCropCycles: number }> => {
  const { data } = await api.delete(`/farm/${farmId}`);
  return data.data;
};

/** Fetches a single farm (with its crop cycles) by filtering the farms list. */
export const getFarmById = async (farmId: string): Promise<Farm | null> => {
  const farms = await listFarms();
  return farms.find((f) => f.id === farmId) ?? null;
};

/** Creates a crop cycle nested under a farm */
export const createCropCycle = async (
  farmId: string,
  payload: CreateCropCyclePayload,
): Promise<CropCycle> => {
  const { data } = await api.post(`/crop-cycles/farm/${farmId}`, payload);
  return data.data.cropCycle;
};

/** Lists crop cycles for a specific farm */
export const listCropCycles = async (farmId: string): Promise<CropCycle[]> => {
  const { data } = await api.get(`/crop-cycles/farm/${farmId}`);
  return data.data.cropCycles;
};

/** Fetches a single crop cycle by ID with its details */
export const getCropCycle = async (id: string): Promise<CropCycle> => {
  const { data } = await api.get(`/crop-cycles/${id}`);
  return data.data.cropCycle;
};

/**
 * Updates a crop cycle's lifecycle status.
 * Endpoint: PATCH /crop-cycles/:id/status
 *
 * Moving a cycle out of ACTIVE (e.g. HARVESTED) frees up its area, since the
 * backend's farm area cap only counts ACTIVE cycles.
 */
export const updateCropCycleStatus = async (
  id: string,
  status: CropStatus,
): Promise<CropCycle> => {
  const { data } = await api.patch(`/crop-cycles/${id}/status`, { status });
  return data.data.cropCycle;
};

/**
 * Deletes a crop cycle.
 * Endpoint: DELETE /crop-cycles/:id → { deletedCropCycle }
 */
export const deleteCropCycle = async (id: string): Promise<CropCycle> => {
  const { data } = await api.delete(`/crop-cycles/${id}`);
  return data.data.deletedCropCycle;
};

/** A crop cycle enriched with the farm it belongs to (for display context). */
export interface ActiveCropCycle {
  cropCycle: CropCycle;
  farm: Farm;
}

/**
 * Resolves the farmer's current working crop cycle for quick-action screens
 * (record activity, observation, etc.).
 *
 * Strategy (option A — auto-select, no picker):
 *   1. List the farmer's farms.
 *   2. Walk farms in order, preferring the most recently planted ACTIVE cycle.
 *   3. Fall back to the most recent cycle of any status if none are ACTIVE.
 *
 * Returns `null` when the farmer has no farm or no crop cycle yet, so callers
 * can render an onboarding empty-state instead of guessing an id.
 */
export const getActiveCropCycle = async (): Promise<ActiveCropCycle | null> => {
  const farms = await listFarms();
  if (farms.length === 0) return null;

  const plantedTime = (c: CropCycle) => {
    const t = new Date(c.plantingDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  let best: ActiveCropCycle | null = null;
  let bestIsActive = false;

  for (const farm of farms) {
    // Reuse cycles embedded in the farm payload if present, else fetch them.
    const cycles =
      farm.cropCycles && farm.cropCycles.length > 0
        ? farm.cropCycles
        : await listCropCycles(farm.id);

    for (const cycle of cycles) {
      const isActive = cycle.status === "ACTIVE";

      // Prefer ACTIVE cycles; among the same active-ness, prefer newer planting.
      if (
        best === null ||
        (isActive && !bestIsActive) ||
        (isActive === bestIsActive &&
          plantedTime(cycle) > plantedTime(best.cropCycle))
      ) {
        best = { cropCycle: cycle, farm };
        bestIsActive = isActive;
      }
    }
  }

  return best;
};
