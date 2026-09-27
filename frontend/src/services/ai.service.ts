import { api } from "../lib/api";

export interface ScanDiagnosisResult {
  diseaseDetected?: string;
  confidence?: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description?: string;
  recommendedAction?: string;
  isCornPlant?: boolean;
  symptoms?: string[];
  recommendations?: string[];
  rawText?: string;
}

export interface RagChatSource {
  title: string;
  source: string;
}

export interface RagChatResponse {
  answer: string;
  sources: RagChatSource[];
  farmContextUsed: boolean;
}

/**
 * Uploads a leaf photo for Gemini Multimodal Plant Health Scan.
 * Endpoint: POST /api/v1/ai/scan (multipart/form-data with `image` field)
 */
export const scanPlantHealth = async (imageFile: File): Promise<ScanDiagnosisResult> => {
  const fd = new FormData();
  fd.append("image", imageFile);

  const { data } = await api.post("/ai/scan", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

/**
 * Sends a farmer query to the RAG Agricultural Chat Advisor.
 * Endpoint: POST /api/v1/ai/chat
 */
export const sendRagChat = async (
  prompt: string,
  cropCycleId?: string
): Promise<RagChatResponse> => {
  const { data } = await api.post("/ai/chat", {
    prompt,
    cropCycleId,
  });
  return data.data;
};
