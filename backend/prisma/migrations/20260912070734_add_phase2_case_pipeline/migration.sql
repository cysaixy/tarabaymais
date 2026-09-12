/*
  Warnings:

  - The primary key for the `crop_cycles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `farmer_profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `farms` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('preparation', 'planting', 'fertilizer', 'pest_control', 'irrigation', 'harvest', 'other');

-- CreateEnum
CREATE TYPE "severity_level" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('submitted', 'under_review', 'inspected', 'resolved', 'rejected');

-- DropForeignKey
ALTER TABLE "crop_cycles" DROP CONSTRAINT "crop_cycles_farm_id_fkey";

-- AlterTable
ALTER TABLE "crop_cycles" DROP CONSTRAINT "crop_cycles_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "farm_id" SET DATA TYPE VARCHAR(64),
ADD CONSTRAINT "crop_cycles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "farmer_profiles" DROP CONSTRAINT "farmer_profiles_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(64),
ADD CONSTRAINT "farmer_profiles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "farms" DROP CONSTRAINT "farms_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(64),
ADD CONSTRAINT "farms_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "crop_activities" (
    "id" VARCHAR(64) NOT NULL,
    "crop_cycle_id" VARCHAR(64) NOT NULL,
    "activity_type" "activity_type" NOT NULL,
    "description" TEXT NOT NULL,
    "cost_amount" DECIMAL(10,2),
    "performed_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" VARCHAR(64) NOT NULL,
    "crop_cycle_id" VARCHAR(64) NOT NULL,
    "farmer_id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" VARCHAR(500),
    "severity" "severity_level" NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_requests" (
    "id" VARCHAR(64) NOT NULL,
    "observation_id" VARCHAR(64) NOT NULL,
    "assigned_technician_id" VARCHAR(128),
    "status" "case_status" NOT NULL DEFAULT 'submitted',
    "recommendation" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expert_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_reports" (
    "id" VARCHAR(64) NOT NULL,
    "farm_id" VARCHAR(64) NOT NULL,
    "disaster_type" VARCHAR(50) NOT NULL,
    "damage_percentage" DECIMAL(5,2) NOT NULL,
    "estimated_loss" DECIMAL(12,2),
    "status" "case_status" NOT NULL DEFAULT 'submitted',
    "verified_by_id" VARCHAR(128),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disaster_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expert_requests_observation_id_key" ON "expert_requests"("observation_id");

-- AddForeignKey
ALTER TABLE "crop_cycles" ADD CONSTRAINT "crop_cycles_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_activities" ADD CONSTRAINT "crop_activities_crop_cycle_id_fkey" FOREIGN KEY ("crop_cycle_id") REFERENCES "crop_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_crop_cycle_id_fkey" FOREIGN KEY ("crop_cycle_id") REFERENCES "crop_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_requests" ADD CONSTRAINT "expert_requests_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_requests" ADD CONSTRAINT "expert_requests_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
