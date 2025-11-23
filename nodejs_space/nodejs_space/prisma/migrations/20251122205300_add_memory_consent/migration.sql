-- CreateTable
CREATE TABLE IF NOT EXISTS "memory_consent" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "consent_date" TIMESTAMP(6),
    "consent_version" VARCHAR(20),
    "preferences" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "memory_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "memory_consent_user_id_key" ON "memory_consent"("user_id");
