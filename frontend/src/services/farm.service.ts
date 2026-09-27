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

export interface CropCycle {
  id: string;
  farmId: string;
  cropType: string;
  variety?: string;
  plantingDate: string;
  expectedHarvestDate?: string;
  areaHectares: string | number;
  status: "ACTIVE" | "HARVESTED" | "FAILED" | "CANCELLED";
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

/** Creates a crop cycle nested under a farm */
export const createCropCycle = async (
  farmId: string,
  payload: CreateCropCyclePayload
): Promise<CropCycle> => {
  const { data } = await api.post(`/crop-cycles/farm/${farmId}`, payload);
  return data.data.cropCycle;
};

/** Lists crop cycles for a specific farm */
export const listCropCycles = async (farmId: string): Promise<CropCycle[]> => {
  const { data } = await api.get(`/crop-cycles/farm/${farmId}`);
  return data.data.cropCycles;
};
