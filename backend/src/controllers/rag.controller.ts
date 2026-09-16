import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { RagService } from "../services/rag.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── AI client initialization ──────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY_RAG;
if (!apiKey) {
  throw new Error(
    "[RAG] GEMINI_API_KEY_RAG environment variable is not configured",
  );
}

const ai = new GoogleGenAI({ apiKey });

// ── Input schema ──────────────────────────────────────────────────────────────

const ragChatSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  cropCycleId: z.string().optional(),
});

// ── Controller ────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/chat */
export const handleRagChat = asyncHandler(
  async (req: Request, res: Response) => {
    const parseResult = ragChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid request body",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const { prompt, cropCycleId } = parseResult.data;
    const userId = req.user?.id;

    // 1. Fetch relevant vector knowledge (top 4 chunks)
    const knowledgeChunks = await RagService.retrieveRelevantChunks(prompt, 4);

    // 2. Optionally enrich with farm context if a crop cycle is provided
    let farmContext = null;
    if (cropCycleId && userId) {
      farmContext = await RagService.buildFarmContext(cropCycleId, userId);
    }

    // 3. Build grounded system prompt
    const contextText = knowledgeChunks
      .map(
        (c, idx) =>
          `[Source ${idx + 1}: ${c.title} (${c.source})]\n${c.content}`,
      )
      .join("\n\n");

    const farmText = farmContext
      ? `FARM CONTEXT:
        - Location: ${farmContext.location}
        - Crop Variety: ${farmContext.variety}
        - Age: ${farmContext.daysAfterPlanting} Days After Planting (DAP)
        - Recent Field Observations: ${JSON.stringify(farmContext.recentObservations)}`
      : "FARM CONTEXT: None provided.";

    const systemPrompt = `You are Tarabay-Mais AI, an agricultural decision-support assistant for corn farmers in Cagayan, Philippines.
Use the provided official knowledge sources and farm context to answer the farmer's question.

SAFETY RULES:
- Provide causes, potential issues, and general guidance.
- DO NOT prescribe exact pesticide/chemical dosage prescriptions autonomously. Suggest field inspection or expert validation if severe.
- Speak in clear, accessible language (Tagalog/Filipino or English as preferred by the user).

OFFICIAL KNOWLEDGE SOURCES:
${contextText || "No specific document retrieved."}

${farmText}

FARMER QUESTION:
${prompt}`;

    // 4. Call Gemini
    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: systemPrompt,
    });

    return sendSuccess(res, 200, {
      data: {
        answer: aiResponse.text,
        sources: knowledgeChunks.map((c) => ({
          title: c.title,
          source: c.source,
        })),
        farmContextUsed: !!farmContext,
      },
    });
  },
);
