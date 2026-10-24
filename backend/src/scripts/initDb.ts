import { Client } from "pg";

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL not set, skipping pgvector init.");
    return;
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("✅ PostgreSQL 'vector' extension enabled successfully.");
  } catch (err: any) {
    console.warn("⚠️ Notice while enabling 'vector' extension:", err?.message || err);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

initDb();
