-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folders_user_id_idx" ON "folders"("user_id");

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "folder_id" UUID;

-- CreateIndex
CREATE INDEX "documents_folder_id_idx" ON "documents"("folder_id");

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "folder_id" UUID;

-- CreateIndex
CREATE INDEX "chat_messages_user_id_folder_id_created_at_idx" ON "chat_messages"("user_id", "folder_id", "created_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
