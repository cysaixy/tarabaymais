-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "idempotency_key" VARCHAR(128) UNIQUE;
