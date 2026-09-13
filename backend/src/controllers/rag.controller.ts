import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { RagService } from "../services/rag.service";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not configured");
}

const ai = new GoogleGenAI({ apiKey });

export const handleRagChat = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { prompt, cropCycleId } = req.body;
    const userId = (req as any).user?.id;

    if (!prompt) {
      res.status(400).json({ error: "Missing chat prompt" });
      return;
    }

    // 1. Fetch relevant vector knowledge
    const knowledgeChunks = await RagService.retrieveRelevantChunks(prompt, 4);

    // 2. Fetch farm context if cropCycleId is supplied
    let farmContext = null;
    if (cropCycleId && userId) {
      farmContext = await RagService.buildFarmContext(cropCycleId, userId);
    }

    // 3. Construct Grounded Prompt
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

    // 4. Call Gemini 3.6 Flash
    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: systemPrompt,
    });

    res.status(200).json({
      answer: aiResponse.text,
      sources: knowledgeChunks.map((c) => ({
        title: c.title,
        source: c.source,
      })),
      farmContextUsed: !!farmContext,
    });
  } catch (error: any) {
    console.error("RAG Chat Error:", error);
    res
      .status(500)
      .json({ error: "Failed to process chat query", details: error.message });
  }
};
