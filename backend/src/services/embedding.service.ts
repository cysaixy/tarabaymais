import { GoogleGenAI } from "@google/genai";
import prisma from "../config/prisma";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not configured");
}

const ai = new GoogleGenAI({ apiKey });

export class EmbeddingService {
  static async generateEmbedding(text: string): Promise<number[]> {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

    const embedding = response.embeddings?.[0];

    if (!embedding?.values) {
      throw new Error("Failed to generate embedding values from Google GenAI");
    }

    return embedding.values;
  }

  /**
   * Embeds and ingests official agricultural guidance chunks into the database.
   */
  static async ingestDocumentChunk(data: {
    title: string;
    source: string;
    category: string;
    content: string;
  }): Promise<void> {
    const { title, source, category, content } = data;
    const embedding = await this.generateEmbedding(`${title}:${content}`);
    const vectorString = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
    INSERT INTO knowledge_chunks (id, title, source, category, content, embedding, created_at)
    VALUES (
        gen_random_uuid()::varchar(64),
        ${title},
        ${source},
        ${category},
        ${content},
        ${vectorString}::vector,
        NOW()
    );
    `;
  }
}
