import { RagService } from "../services/rag.service";

async function testVectorSearch() {
  const sampleQuery =
    "Ano ang gagawin kapag may uod o pinholes sa dahon ng mais?";
  console.log(`🔍 Testing Similarity Search for Query: "${sampleQuery}"\n`);

  try {
    const results = await RagService.retrieveRelevantChunks(sampleQuery, 2);
    console.log("Top Retrived Vector Results:");

    results.forEach((res, index) => {
      console.log(
        `\n--- Match ${index + 1} (Similarity Score: ${(res.similarity * 100).toFixed(2)}%) ---`,
      );
      console.log(`Title: ${res.title}`);
      console.log(`Source: ${res.source}`);
      console.log(`Content snippet: ${res.content.substring(0, 120)}...`);
    });
  } catch (error: any) {
    console.error("Vector search test failed:", error.message);
  }
}

testVectorSearch();
