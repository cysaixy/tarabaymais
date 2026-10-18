import { api } from "../lib/api";

export interface CreateDisasterReportPayload {
  disasterType: string; // e.g. "TYPHOON", "FLOOD", "DROUGHT"
  damagePercentage: number;
  estimatedLoss?: number;
  notes?: string;
}

/** Backend `CaseStatus` enum values (shared by expert + disaster cases). */
export type CaseStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INSPECTED"
  | "RESOLVED"
  | "REJECTED";

export interface DisasterReport {
  id: string;
  farmId: string;
  disasterType: string;
  damagePercentage: string | number;
  estimatedLoss?: string | number | null;
  status: CaseStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  verifiedBy?: { firstName: string; lastName: string } | null;
  farm?: { name: string; barangay: string; municipality: string };
}

export interface ExpertCase {
  id: string;
  observationId: string;
  assignedTechnicianId?: string | null;
  status: CaseStatus;
  recommendation?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
  observation?: {
    title: string;
    description: string;
    severity: string;
    imageUrl?: string | null;
    cropCycle?: {
      variety?: string;
      plantingDate?: string;
      farm?: {
        name: string;
        barangay: string;
        municipality: string;
        areaHectares?: number | string;
      };
    };
    farmer?: {
      firstName: string;
      lastName: string;
      phone?: string;
    } | null;
    aiDiagnosis?: {
      condition?: string;
      confidence?: number;
      recommendedAction?: string;
      [key: string]: unknown;
    } | null;
  };
  assignedTechnician?: {
    firstName: string;
    lastName: string;
    phone?: string;
  } | null;
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
  payload: CreateDisasterReportPayload,
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

/**
 * Updates the status of a disaster report or expert case.
 * Endpoint: PATCH /api/v1/case/pipeline/:caseId
 */
export const updateCaseStatus = async (
  caseId: string,
  payload: { caseType: "DISASTER_REPORT" | "EXPERT_REQUEST"; status: string },
): Promise<void> => {
  await api.patch(`/case/pipeline/${caseId}`, payload);
};

/**
 * Resolves an expert request by sending an agronomic recommendation.
 * Endpoint: PATCH /api/v1/case/expert-requests/:caseId/resolve
 */
export const resolveExpertCase = async (
  caseId: string,
  payload: { recommendation: string },
): Promise<void> => {
  await api.patch(`/case/expert-requests/${caseId}/resolve`, payload);
};
