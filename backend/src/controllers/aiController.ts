import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";

// ── AI client initialization ──────────────────────────────────────────────────
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY_RAG || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("[AI] GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

const rawModel = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const modelName = rawModel.includes("gemini-2.0") ? "gemini-3.8-flash" : rawModel;

// ── Diagnosis prompt ──────────────────────────────────────────────────────────
const DIAGNOSIS_PROMPT = `
You are an expert agricultural botanist specializing in corn (maize) crops in the Philippines.
Analyze this image of a corn leaf or plant and provide a diagnosis in strict raw JSON format
(no markdown code blocks, no trailing text).

Expected JSON structure:
{
  "isCornPlant": true,
  "diseaseDetected": "Disease or Pest Name or None",
  "confidence": 0.95,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "description": "Brief 2-sentence explanation of visible symptoms.",
  "recommendedAction": "Immediate steps the farmer should take."
}
`.trim();

// ── Controller ────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/scan */
export const scanCropHealth = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw ApiError.badRequest("Image file is required for AI scanning");
    }

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [DIAGNOSIS_PROMPT, imagePart],
    });


    const rawText = response.text?.replace(/```json|```/g, "").trim();

    let diagnosis: unknown;
    try {
      diagnosis = JSON.parse(rawText ?? "{}");
    } catch {
      throw ApiError.internal(
        "AI returned a malformed response — unable to parse diagnosis JSON",
      );
    }

    return sendSuccess(res, 200, { data: { diagnosis } });
  },
);
