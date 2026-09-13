import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not configured");
}

const ai = new GoogleGenAI({ apiKey });

export const scanCropHealth = async (req: Request, res: Response) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "Image file is required for AI scanning" });
  }

  try {
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `
      You are an expert agricultural botanist specializing in corn (maize) crops in the Philippines.
      Analyze this image of a corn leaf or plant and provide a diagnosis in strict raw JSON format (no markdown code blocks, no trailing text).

      Expected JSON Structure:
      {
        "isCornPlant": true,
        "diseaseDetected": "Disease or Pest Name or None",
        "confidence": 0.95,
        "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        "description": "Brief 2-sentence explanation of visible symptoms.",
        "recommendedAction": "Immediate steps the farmer should take."
      }
    `;

    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [prompt, imagePart],
    });

    const rawText = response.text?.replace(/```json|```/g, "").trim();
    const diagnosis = JSON.parse(rawText || "{}");

    return res.status(200).json({ diagnosis });
  } catch (error: any) {
    return res.status(500).json({
      error: "AI diagnostic scan failed",
      details: error.message,
    });
  }
};
