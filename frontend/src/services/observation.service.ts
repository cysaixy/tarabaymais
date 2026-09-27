import { api } from "../lib/api";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CreateObservationParams {
  cropCycleId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  image?: File | null;
  aiDiagnosis?: Record<string, unknown> | null;
}

export interface ObservationRecord {
  id: string;
  cropCycleId: string;
  farmerId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  severity: SeverityLevel;
  aiDiagnosis?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ObservationResponse {
  observation: ObservationRecord;
  autoEscalatedCase?: {
    id: string;
    observationId: string;
    status: string;
  } | null;
}

/**
 * Creates an observation with optional photo attachment.
 * Endpoint: POST /api/v1/observations/:cropCycleId (multipart/form-data)
 */
export const createObservation = async (
  params: CreateObservationParams
): Promise<ObservationResponse> => {
  const fd = new FormData();
  fd.append("title", params.title);
  fd.append("description", params.description);
  fd.append("severity", params.severity);

  if (params.aiDiagnosis) {
    fd.append("aiDiagnosis", JSON.stringify(params.aiDiagnosis));
  }
  if (params.image) {
    fd.append("image", params.image);
  }

  // Browser automatically sets Content-Type boundary
  const { data } = await api.post(`/observations/${params.cropCycleId}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};
