import prisma from "../config/prisma";
import { EmbeddingService } from "./embedding.service";
import { getOrSet, hashKey } from "../lib/cache";

export interface RetrievedChunk {
  id: string;
  title: string;
  source: string;
  content: string;
  similarity: number;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class RagService {
  /**
   * Searches the Knowledge Base using vector cosine distance.
   * Cached for 1 hour since knowledge base is static.
   */
  static async retrieveRelevantChunks(
    query: string,
    limit = 4,
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(",")}]`;
    const cacheKey = `rag:chunks:${hashKey(normalizeQuery(query) + '|' + limit)}:${limit}`;

    return getOrSet(
      cacheKey,
      3600, // 1 hour TTL
      async () => {
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
      },
      { jitterSec: 300 }
    );
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
