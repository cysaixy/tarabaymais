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
