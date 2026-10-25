/*
  Add PlantScan model (every AI scan persisted), link Observations to scans via scan_id,
  and add first_response_at to ExpertRequest for response-time analytics.

  Warnings:
  - No data loss: all new columns/tables are additive and nullable.
  - Existing observations keep scan_id = NULL until re-linked.
*/

-- CreateEnum: scan_verdict
CREATE TYPE "scan_verdict" AS ENUM ('healthy', 'flagged');

-- CreateTable: plant_scans
CREATE TABLE "plant_scans" (
    "id" VARCHAR(64) NOT NULL,
    "crop_cycle_id" VARCHAR(64),
    "farmer_id" VARCHAR(128) NOT NULL,
    "raw_result" JSON NOT NULL,
    "diagnosis" VARCHAR(255),
    "confidence" DECIMAL(5,4),
    "severity" "severity_level",
    "verdict" "scan_verdict" NOT NULL DEFAULT 'flagged',
    "scan_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plant_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique scan_id on plant_scans
CREATE UNIQUE INDEX "plant_scans_scan_id_key" ON "plant_scans"("scan_id");

-- CreateIndex: plant_scans created_at desc
CREATE INDEX "idx_plant_scans_created_at_desc" ON "plant_scans"("created_at" DESC);

-- CreateIndex: plant_scans farmer_id
CREATE INDEX "idx_plant_scans_farmer_id" ON "plant_scans"("farmer_id");

-- CreateIndex: plant_scans crop_cycle_id
CREATE INDEX "idx_plant_scans_crop_cycle_id" ON "plant_scans"("crop_cycle_id");

-- CreateIndex: plant_scans verdict + created_at desc
CREATE INDEX "idx_plant_scans_verdict_created_at_desc" ON "plant_scans"("verdict", "created_at" DESC);

-- AlterTable: add scan_id to observations (nullable, unique)
ALTER TABLE "observations" ADD COLUMN "scan_id" VARCHAR(64);

-- CreateIndex: unique scan_id on observations
CREATE UNIQUE INDEX "observations_scan_id_key" ON "observations"("scan_id");

-- CreateIndex: observations severity + created_at desc
CREATE INDEX "idx_observations_severity_created_at_desc" ON "observations"("severity", "created_at" DESC);

-- AlterTable: add first_response_at to expert_requests (nullable)
ALTER TABLE "expert_requests" ADD COLUMN "first_response_at" TIMESTAMPTZ;

-- CreateIndex: expert_requests first_response_at
CREATE INDEX "idx_expert_requests_first_response_at" ON "expert_requests"("first_response_at");

-- CreateIndex: expert_requests status + created_at desc
CREATE INDEX "idx_expert_requests_status_created_at_desc" ON "expert_requests"("status", "created_at" DESC);

-- AddForeignKey: observations.scan_id -> plant_scans.id
ALTER TABLE "observations" ADD CONSTRAINT "observations_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "plant_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: plant_scans.crop_cycle_id -> crop_cycles.id
ALTER TABLE "plant_scans" ADD CONSTRAINT "plant_scans_crop_cycle_id_fkey" FOREIGN KEY ("crop_cycle_id") REFERENCES "crop_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: plant_scans.farmer_id -> users.id
ALTER TABLE "plant_scans" ADD CONSTRAINT "plant_scans_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
