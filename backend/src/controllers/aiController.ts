import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import prisma from "../config/prisma";
import { Prisma, SeverityLevel } from "@prisma/client";
import { invalidateAnalyticsCache } from "./analyticsController";
import { computeScanVerdict } from "../lib/scanVerdict";

// ── AI client initialization ──────────────────────────────────────────────────
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY_RAG || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("[AI] GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

const modelName = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

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

    const d = diagnosis as {
      diseaseDetected?: string;
      confidence?: number;
      severity?: string;
      description?: string;
      recommendedAction?: string;
      isCornPlant?: boolean;
    };

    // Persist every scan in PlantScan so the officer dashboard can use it.
    // Verdict computed via shared computeScanVerdict (see src/lib/scanVerdict.ts).
    const verdict = computeScanVerdict({
      diagnosis: d.diseaseDetected ?? null,
      severity: d.severity ?? null,
    });
    const severityVal = verdict === "FLAGGED" ? ((d.severity ?? "LOW") as SeverityLevel) : SeverityLevel.LOW;

    const scan = await prisma.plantScan.create({
      data: {
        farmerId: req.user!.id,
        cropCycleId: null,
        rawResult: diagnosis as Prisma.InputJsonValue,
        diagnosis: d.diseaseDetected ?? null,
        confidence: d.confidence != null ? d.confidence : null,
        severity: severityVal,
        verdict: verdict as any,
      },
    });

    await invalidateAnalyticsCache();

    return sendSuccess(res, 200, {
      data: {
        diagnosis: d,
        scanId: scan.id,
      },
    });
  },
);
