-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "stripe_customer_id" TEXT,
ADD COLUMN "stripe_subscription_id" TEXT,
ADD COLUMN "subscription_status" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_stripe_customer_id_key" ON "profiles"("stripe_customer_id");
