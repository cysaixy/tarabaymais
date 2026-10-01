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

/**
 * Lists activities for a crop cycle or all activities for the authenticated user.
 * Endpoint: GET /api/v1/activities/:cropCycleId or GET /api/v1/activities
 */
export const listActivities = async (
  cropCycleId?: string
): Promise<CropActivity[]> => {
  const url = cropCycleId ? `/activities/${cropCycleId}` : "/activities";
  const { data } = await api.get(url);
  return data.data.activities;
};

