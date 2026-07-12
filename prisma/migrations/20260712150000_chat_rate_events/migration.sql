-- CreateTable
CREATE TABLE "chat_rate_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rate_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_rate_events_user_id_created_at_idx" ON "chat_rate_events"("user_id", "created_at");
