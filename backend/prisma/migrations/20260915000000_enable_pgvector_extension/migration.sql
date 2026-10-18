-- Ensure the pgvector extension is available before any `vector` column is used.
-- Idempotent: safe to run even if the extension is already enabled.
-- NOTE: the database role must be allowed to create extensions. On Supabase,
-- pgvector is available and this succeeds; on a locked-down Postgres you may
-- need a superuser to run `CREATE EXTENSION vector;` once, out of band.
CREATE EXTENSION IF NOT EXISTS vector;
