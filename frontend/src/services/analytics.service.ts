import { api } from "../lib/api";

/**
 * Regional summary KPIs for the municipal/officer portal.
 * Endpoint: GET /api/v1/analytics/summary (role: OFFICER | TECHNICIAN)
 *
 * Prisma Decimal fields (hectares, loss, avg) serialize as strings, so numeric
 * fields are coerced with Number() here for safe display and math.
 */
export interface DisasterMetrics {
  totalReports: number;
  totalEstimatedLossPHP: number;
  averageDamagePercentage: number;
}

export interface AnalyticsSummary {
  totalFarmers: number;
  totalFarms: number;
  activeCropCycles: number;
  totalActiveHectares: number;
  pendingExpertCases: number;
  disasterMetrics: DisasterMetrics;
}

export const getAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const { data } = await api.get("/analytics/summary");
  const s = data.data.summary;
  return {
    totalFarmers: Number(s.totalFarmers ?? 0),
    totalFarms: Number(s.totalFarms ?? 0),
    activeCropCycles: Number(s.activeCropCycles ?? 0),
    totalActiveHectares: Number(s.totalActiveHectares ?? 0),
    pendingExpertCases: Number(s.pendingExpertCases ?? 0),
    disasterMetrics: {
      totalReports: Number(s.disasterMetrics?.totalReports ?? 0),
      totalEstimatedLossPHP: Number(s.disasterMetrics?.totalEstimatedLossPHP ?? 0),
      averageDamagePercentage: Number(
        s.disasterMetrics?.averageDamagePercentage ?? 0,
      ),
    },
  };
};

/**
 * Per-barangay farm distribution.
 * Endpoint: GET /api/v1/analytics/barangays (role: OFFICER | TECHNICIAN)
 *
 * The backend returns the raw Prisma groupBy shape
 * `{ barangay, _count: { id }, _sum: { areaHectares } }`; this flattens it and
 * coerces the Decimal hectares to a number.
 */
export interface BarangayDistribution {
  barangay: string;
  farmCount: number;
  totalHectares: number;
}

interface RawBarangayRow {
  barangay: string;
  _count?: { id?: number };
  _sum?: { areaHectares?: string | number | null };
}

export const getBarangayDistribution = async (): Promise<
  BarangayDistribution[]
> => {
  const { data } = await api.get("/analytics/barangays");
  const rows: RawBarangayRow[] = data.data.barangays ?? [];
  return rows.map((r) => ({
    barangay: r.barangay,
    farmCount: Number(r._count?.id ?? 0),
    totalHectares: Number(r._sum?.areaHectares ?? 0),
  }));
};

/**
 * Downloads an analytics report (xlsx or csv) as a Blob.
 * Endpoint: GET /api/v1/analytics/export (role: OFFICER | TECHNICIAN)
 */
export type ExportType = "disaster-claims" | "barangay-summary";
export type ExportFormat = "xlsx" | "csv";

export interface ExportParams {
  type: ExportType;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  barangay?: string;
}

export const downloadAnalyticsReport = async (
  params: ExportParams,
): Promise<Blob> => {
  const { data } = await api.get("/analytics/export", {
    params,
    responseType: "blob",
  });
  return data as Blob;
};
