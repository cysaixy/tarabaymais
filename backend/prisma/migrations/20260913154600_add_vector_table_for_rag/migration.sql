-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);
