-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "requests_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_user_id_idx" ON "usage"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_user_id_period_start_key" ON "usage"("user_id", "period_start");
