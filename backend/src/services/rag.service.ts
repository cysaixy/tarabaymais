import prisma from "../config/prisma";
import { EmbeddingService } from "./embedding.service";

export interface RetrievedChunk {
  id: string;
  title: string;
  source: string;
  content: string;
  similarity: number;
}

export class RagService {
  /**
   * Searches the Knowledge Base using vector cosine distance.
   */
  static async retrieveRelevantChunks(
    query: string,
    limit = 4,
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const results = await prisma.$queryRaw<RetrievedChunk[]>`
        SELECT 
        id, 
        title, 
        source, 
        content, 
        1 - (embedding <=> ${vectorString}::vector) AS similarity
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${limit};
    
    `;

    return results;
  }

  /**
   * Assembles farm contextual memory for prompt enrichment.
   */
  static async buildFarmContext(cropCycleId: string, farmerId: string) {
    const cropCycle = await prisma.cropCycle.findFirst({
      where: { id: cropCycleId, farm: { farmerId } },
      include: {
        farm: true,
        observations: {
          take: 3,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!cropCycle) return null;

    const daysAfterPlanting = Math.floor(
      (Date.now() - new Date(cropCycle.plantingDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return {
      farmName: cropCycle.farm.name,
      location: `${cropCycle.farm.barangay}, ${cropCycle.farm.municipality}`,
      cropType: cropCycle.cropType,
      variety: cropCycle.variety || "Unspecified Corn Variety",
      plantingDate: cropCycle.plantingDate,
      daysAfterPlanting,
      recentObservations: cropCycle.observations.map((obs) => ({
        title: obs.title,
        severity: obs.severity,
        aiDiagnosis: obs.aiDiagnosis,
        date: obs.createdAt,
      })),
    };
  }
}
