-- CreateTable
CREATE TABLE "bot_conversations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "referenceCode" TEXT,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_conversations_tenantId_endedAt_idx" ON "bot_conversations"("tenantId", "endedAt" DESC);

-- AddForeignKey
ALTER TABLE "bot_conversations" ADD CONSTRAINT "bot_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
