/**
 * Typed API layer for the Officer Portal dashboard endpoints.
 * All endpoints live under GET /api/v1/officer/* and are protected by
 * officer/technician auth. Reuses the existing axios instance (src/lib/api.ts)
 * which attaches the Firebase ID token and handles 401 token refresh.
 */

import { api } from "../lib/api";

// ── Shared query params ──────────────────────────────────────────────────

export interface OfficerQueryParams {
  barangay?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

// ── Overview ─────────────────────────────────────────────────────────────

export interface KpiDelta {
  absolute: number | null;
  percent: number | null;
}

export interface KpiWithSparkline {
  value: number | null;
  delta: KpiDelta;
  sparkline: { date: string; value: number }[];
}

export interface OverviewData {
  totalFarms: KpiWithSparkline;
  activeCornHectares: KpiWithSparkline;
  openCases: KpiWithSparkline;
  disasterReportsThisPeriod: KpiWithSparkline;
  avgResponseTimeHours: KpiWithSparkline;
  casesResolvedThisPeriod: KpiWithSparkline;
}

export interface OverviewResponse {
  overview: OverviewData;
}

export const getOverview = async (params?: OfficerQueryParams): Promise<OverviewData> => {
  const { data } = await api.get<{ data: OverviewResponse }>("/officer/analytics/overview", {
    params,
  });
  return data.data.overview;
};

// ── Crop stages ──────────────────────────────────────────────────────────

export interface CropStage {
  farmCount: number;
  totalAreaHectares: number;
}

export interface CropStagesResponse {
  cropStages: { stages: Record<string, CropStage> };
}

export const getCropStages = async (params?: OfficerQueryParams): Promise<CropStagesResponse["cropStages"]> => {
  const { data } = await api.get<{ data: CropStagesResponse }>("/officer/analytics/crop-stages", {
    params,
  });
  return data.data.cropStages;
};

// ── Scan trends ──────────────────────────────────────────────────────────

export interface ScanTrendPoint {
  weekStart: string; // YYYY-MM-DD (Monday, Asia/Manila)
  healthy: number;
  flagged: number;
}

export interface ScanTrendsResponse {
  scanTrends: { weekly: ScanTrendPoint[] };
}

export const getScanTrends = async (params?: OfficerQueryParams): Promise<ScanTrendPoint[]> => {
  const { data } = await api.get<{ data: ScanTrendsResponse }>("/officer/analytics/scan-trends", {
    params,
  });
  return data.data.scanTrends.weekly;
};

// ── Top issues ───────────────────────────────────────────────────────────

export interface TopIssue {
  diagnosis: string;
  count: number;
  avgSeverity: number;
}

export interface TopIssuesResponse {
  topIssues: { topIssues: TopIssue[] };
}

export const getTopIssues = async (params?: OfficerQueryParams): Promise<TopIssue[]> => {
  const { data } = await api.get<{ data: TopIssuesResponse }>("/officer/analytics/top-issues", {
    params,
  });
  return data.data.topIssues.topIssues;
};

// ── Disasters ────────────────────────────────────────────────────────────

export type DisasterGroupBy = "barangay" | "month" | "type";

export interface DisasterGroup {
  groupKey: string;
  count: number;
  totalEstimatedLoss: number;
}

export interface DisastersResponse {
  disasters: { groupBy: DisasterGroupBy; groups: DisasterGroup[] };
}

export interface DisastersQueryParams extends OfficerQueryParams {
  groupBy?: DisasterGroupBy;
}

export const getDisasters = async (
  params?: DisastersQueryParams,
): Promise<DisastersResponse["disasters"]> => {
  const { data } = await api.get<{ data: DisastersResponse }>("/officer/analytics/disasters", {
    params,
  });
  return data.data.disasters;
};

// ── Farms geo ────────────────────────────────────────────────────────────

export type FarmHealthStatus = "healthy" | "watch" | "critical";

export interface FarmGeoFeatureProperties {
  id: string;
  name: string;
  barangay: string;
  municipality: string;
  hectares: number;
  growthStage: string | null;
  healthStatus: FarmHealthStatus;
  openCaseCount: number;
}

export interface DisasterGeoFeatureProperties {
  id: string;
  kind: "disaster";
  disasterType: string;
  estimatedLoss: number;
  farmName: string;
  barangay: string;
}

export interface FarmsGeoResponse {
  farmsGeo: {
    type: "FeatureCollection";
    features: Array<
      | {
          type: "Feature";
          properties: FarmGeoFeatureProperties;
          geometry: { type: "Point"; coordinates: [number, number] };
        }
      | {
          type: "Feature";
          properties: DisasterGeoFeatureProperties;
          geometry: { type: "Point"; coordinates: [number, number] };
        }
    >;
    farmsWithoutLocation: number;
  };
}

export const getFarmsGeo = async (params?: OfficerQueryParams): Promise<FarmsGeoResponse["farmsGeo"]> => {
  const { data } = await api.get<{ data: FarmsGeoResponse }>("/officer/farms/geo", {
    params,
  });
  return data.data.farmsGeo;
};

// ── Queue ────────────────────────────────────────────────────────────────

export type QueueItemType = "case" | "observation" | "disaster";

export interface QueueItem {
  id: string;
  type: QueueItemType;
  severity: string;
  farmerName: string;
  farmName: string;
  barangay: string;
  summary: string;
  createdAt: string;
  waitingHours: number;
  status: string;
}

export interface QueueResponse {
  queue: {
    items: QueueItem[];
    total: number;
    nextCursor: number | null;
    limit: number;
    offset: number;
  };
}

export interface QueueQueryParams extends OfficerQueryParams {
  limit?: number;
  offset?: number;
  type?: QueueItemType;
  history?: boolean;
}

export const getQueue = async (params?: QueueQueryParams): Promise<QueueResponse["queue"]> => {
  const { data } = await api.get<{ data: QueueResponse }>("/officer/queue", {
    params,
  });
  return data.data.queue;
};

// ── Barangay (extended) ──────────────────────────────────────────────────

export interface BarangayRow {
  barangay: string;
  farms: number;
  hectares: number;
  openCases: number;
  avgHealthScore: number; // backward compat
  riskScore: number; // 0-100, higher = worse risk
  disasterCount: number;
}

export interface BarangaysResponse {
  barangays: BarangayRow[];
}

export const getBarangays = async (): Promise<BarangayRow[]> => {
  const { data } = await api.get<{ data: BarangaysResponse }>("/analytics/barangays");
  return data.data.barangays;
};
