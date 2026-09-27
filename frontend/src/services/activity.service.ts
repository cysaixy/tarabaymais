import { api } from "../lib/api";

export type ActivityType =
  | "PREPARATION"
  | "PLANTING"
  | "FERTILIZER"
  | "PEST_CONTROL"
  | "IRRIGATION"
  | "HARVEST"
  | "OTHER";

export interface CreateActivityPayload {
  activityType: ActivityType;
  description: string;
  costAmount?: number;
  performedAt?: string; // ISO string or YYYY-MM-DD
}

export interface CropActivity {
  id: string;
  cropCycleId: string;
  activityType: ActivityType;
  description: string;
  costAmount?: string | number | null;
  performedAt: string;
  createdAt: string;
}

/**
 * Creates a crop activity record on the backend.
 * Endpoint: POST /api/v1/activities/:cropCycleId
 */
export const createActivity = async (
  cropCycleId: string,
  payload: CreateActivityPayload
): Promise<CropActivity> => {
  const { data } = await api.post(`/activities/${cropCycleId}`, payload);
  return data.data.activity;
};
