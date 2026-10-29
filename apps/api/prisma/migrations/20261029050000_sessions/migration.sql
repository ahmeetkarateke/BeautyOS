-- S6: sunucu taraflı oturum. Yenileme token'ı yalnız SHA-256 özetiyle saklanır; her kullanımda yeni satır (aynı familyId)
-- açılır, eski satır usedAt ile kapanır. Kullanılmış token tekrar gelirse aile (familyId) iptal edilir.
-- Geri alma: DROP TABLE "sessions"; (tüm oturumlar düşer, kullanıcılar yeniden giriş yapar; başka veri etkilenmez.)
CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tenantId" UUID,
  "familyId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_familyId_idx" ON "sessions"("familyId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
