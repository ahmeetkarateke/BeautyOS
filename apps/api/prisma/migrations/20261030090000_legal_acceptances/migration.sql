-- W30 / ADR-0048: kayit sirasinda verilen sozlesme ve riza kabulleri (belge basina ayri satir).
-- Geri alma: DROP TABLE "legal_acceptances"; (kabul kayitlari duser, hesaplar etkilenmez.)
CREATE TABLE "legal_acceptances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "document" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_acceptances_document_check" CHECK ("document" IN ('terms', 'dpa', 'marketing_email'))
);
CREATE INDEX "legal_acceptances_tenantId_userId_idx" ON "legal_acceptances"("tenantId", "userId");
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
