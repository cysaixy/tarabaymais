import { api } from "../lib/api";

export interface CreateDisasterReportPayload {
  disasterType: string; // e.g. "TYPHOON", "FLOOD", "DROUGHT"
  damagePercentage: number;
  estimatedLoss?: number;
  notes?: string;
}

export interface DisasterReport {
  id: string;
  farmId: string;
  disasterType: string;
  damagePercentage: string | number;
  estimatedLoss?: string | number | null;
  status: "SUBMITTED" | "UNDER_REVIEW" | "INSPECTED" | "RESOLVED" | "REJECTED";
  notes?: string | null;
  createdAt: string;
}

export interface ExpertCase {
  id: string;
  observationId: string;
  assignedTechnicianId?: string | null;
  status: string;
  recommendation?: string | null;
  observation?: {
    title: string;
    description: string;
    severity: string;
    imageUrl?: string | null;
  };
}

export interface CasePipelineData {
  expertCases: ExpertCase[];
  disasterCases: DisasterReport[];
}

/**
 * Creates a disaster damage claim for a farm.
 * Endpoint: POST /api/v1/case/disaster-report/:farmId
 */
export const createDisasterReport = async (
  farmId: string,
  payload: CreateDisasterReportPayload
): Promise<DisasterReport> => {
  const { data } = await api.post(`/case/disaster-report/${farmId}`, payload);
  return data.data.disasterReport;
};

/**
 * Fetches the unified case pipeline scoped to the authenticated caller.
 * Endpoint: GET /api/v1/case/pipeline
 */
export const getCasePipeline = async (): Promise<CasePipelineData> => {
  const { data } = await api.get("/case/pipeline");
  return data.data.pipeline;
};
