-- SMS & Email altyapısı: Phone verification + Customer flags + Message deliveries

-- Enums
CREATE TYPE "MessageChannel" AS ENUM ('sms', 'email');
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'bounced');
CREATE TYPE "DeliveryPurpose" AS ENUM (
  'verification',
  'reminder_24h',
  'reminder_2h',
  'booking_confirm',
  'cancellation',
  'campaign',
  'transactional'
);

-- Customer extensions
ALTER TABLE "customers"
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "marketingConsentSms" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingConsentEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingConsentUpdatedAt" TIMESTAMP(3);

-- Phone verification
CREATE TABLE "phone_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "customerId" UUID,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "phone_verifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "phone_verifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "phone_verifications_phone_createdAt_idx" ON "phone_verifications"("phone", "createdAt" DESC);
CREATE INDEX "phone_verifications_tenantId_idx" ON "phone_verifications"("tenantId");

-- Message deliveries
CREATE TABLE "message_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID,
  "appointmentId" UUID,
  "channel" "MessageChannel" NOT NULL,
  "purpose" "DeliveryPurpose" NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "body" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
  "providerName" TEXT,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "cost" DECIMAL(10, 4),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "message_deliveries_tenantId_createdAt_idx" ON "message_deliveries"("tenantId", "createdAt" DESC);
CREATE INDEX "message_deliveries_customerId_idx" ON "message_deliveries"("customerId");
CREATE INDEX "message_deliveries_appointmentId_idx" ON "message_deliveries"("appointmentId");
