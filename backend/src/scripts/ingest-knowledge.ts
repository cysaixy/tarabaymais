import { EmbeddingService } from "../services/embedding.service";

const cagayanCornKnowledge = [
  {
    title: "Fall Armyworm (FAW) Early Detection and Management",
    source: "DA Region II RCPC / Plant Health Clinic",
    category: "PEST_MANAGEMENT",
    content:
      "Fall Armyworm (Spodoptera frugiperda) targets corn leaves during the vegetative/whorl stage. " +
      "Look for pinholes, ragged leaf margins, and frass (sawdust-like excrement) inside the whorl. " +
      "Apply biological control agents like Trichogramma chilonis or Metarhizium anisopliae early. " +
      "If severe infestation occurs, consult field technicians for targeted intervention.",
  },
  {
    title: "Corn Fertilizer Schedule: Sidedressing and Hilling-up",
    source: "DA Region II Corn Technology Guide",
    category: "FERTILIZER",
    content:
      "Apply complete fertilizer (14-14-14) at planting. Perform hilling-up and sidedressing with Urea (46-0-0) " +
      "or Ammonium Sulfate at 21 to 30 days after planting (DAP). This stage is critical for root anchorage " +
      "and nitrogen uptake required for cob development.",
  },
  {
    title: "Gray Leaf Spot (Cercospora zeae-maydis) Symptoms",
    source: "DA Region II Plant Health Clinic",
    category: "DISEASE_MANAGEMENT",
    content:
      "Gray Leaf Spot appears as small, rectangular, tan-to-brown lesions strictly bounded by leaf veins on lower leaves. " +
      "High humidity and prolonged leaf wetness accelerate spread. Ensure field drainage, practice crop rotation, " +
      "and monitor fields closely during wet seasons.",
  },
  {
    title: "Drought Mitigation & Water Stress at Flowering Stage",
    source: "Cagayan OPA & PAGASA Agro-Weather Bulletin",
    category: "CLIMATE_ADAPTATION",
    content:
      "Corn is most sensitive to drought/water stress 2 weeks before flowering through tassel and silk emergence. " +
      "Moisture deficits during silk emergence reduce pollination efficiency and grain filling. Practice shallow cultivation " +
      "or mulching to retain soil moisture during extended dry spells.",
  },
];

async function runIngestion() {
  console.log("🚀 Starting Knowledge Base Vector Embedding Ingestion...\n");

  for (const doc of cagayanCornKnowledge) {
    try {
      console.log(`⏳ Embedding: "${doc.title}"...`);
      await EmbeddingService.ingestDocumentChunk(doc);
      console.log(`✅ Successfully stored in PostgreSQL vector DB.`);
    } catch (error: any) {
      console.error(`❌ Failed to ingest "${doc.title}":`, error.message);
    }
  }
  console.log(
    "\n🎉 Ingestion complete! Knowledge chunks are ready for RAG retrieval.",
  );
  process.exit(0);
}

runIngestion();
