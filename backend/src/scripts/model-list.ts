import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY_RAG;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_RAG is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = await ai.models.list();

  for await (const model of models) {
    console.log(model.name, model.supportedActions);
  }
}

listModels().catch((error) => {
  console.error("Failed to list models:", error);
  process.exit(1);
});
