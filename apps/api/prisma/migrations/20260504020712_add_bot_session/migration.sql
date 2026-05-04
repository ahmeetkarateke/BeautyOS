-- CreateTable
CREATE TABLE "bot_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelType" TEXT NOT NULL,
    "fromRef" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_sessions_tenantId_idx" ON "bot_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "bot_sessions_expiresAt_idx" ON "bot_sessions"("expiresAt");
