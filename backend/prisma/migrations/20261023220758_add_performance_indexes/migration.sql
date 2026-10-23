-- Performance indexes for common query patterns
-- Generated from index audit (2026-10-23)

-- High priority: farmer-scoped farm list with ordering
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id_created_at_desc ON "farms" ("farmer_id", "created_at" DESC);

-- High priority: crop cycles per farm ordered by planting date
CREATE INDEX IF NOT EXISTS idx_crop_cycles_farm_id_planting_date_desc ON "crop_cycles" ("farm_id", "planting_date" DESC);

-- High priority: activities per crop cycle ordered by performed date
CREATE INDEX IF NOT EXISTS idx_crop_activities_crop_cycle_id_performed_at_desc ON "crop_activities" ("crop_cycle_id", "performed_at" DESC);

-- High priority: observations per crop cycle ordered by created date
CREATE INDEX IF NOT EXISTS idx_observations_crop_cycle_id_created_at_desc ON "observations" ("crop_cycle_id", "created_at" DESC);

-- High priority: farmer-scoped observations (also used in expert_cases join)
CREATE INDEX IF NOT EXISTS idx_observations_farmer_id ON "observations" ("farmer_id");

-- Medium priority: active area aggregate on crop cycle creation
CREATE INDEX IF NOT EXISTS idx_crop_cycles_farm_id_status ON "crop_cycles" ("farm_id", "status");

-- Medium priority: expert requests listing (staff view)
CREATE INDEX IF NOT EXISTS idx_expert_requests_created_at_desc ON "expert_requests" ("created_at" DESC);

-- Medium priority: disaster reports listing + export range queries
CREATE INDEX IF NOT EXISTS idx_disaster_reports_created_at_desc ON "disaster_reports" ("created_at" DESC);

-- Medium priority: disaster reports join to farms (export aggregation)
CREATE INDEX IF NOT EXISTS idx_disaster_reports_farm_id ON "disaster_reports" ("farm_id");

-- Medium priority: vector similarity search for RAG (hnsw index)
-- Requires pgvector extension (enabled in migration 20260915000000)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);