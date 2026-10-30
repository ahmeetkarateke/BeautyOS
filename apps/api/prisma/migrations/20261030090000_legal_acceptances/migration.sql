-- W30 / ADR-0048: kayit kabulleri (belge basina satir) ve K3 ticari ileti izni. Iki tablo da yalniz eklenir: UPDATE tetikleyiciyle engellenir.
-- Silme yalniz kiraci/kullanici silinirken (ON DELETE CASCADE) olur. Geri alma: DROP TABLE "marketing_consents", "legal_acceptances"; DROP FUNCTION "forbid_update"();
CREATE FUNCTION "forbid_update"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Bu tablo yalniz eklenir, guncellenemez.'; END $$;

CREATE TABLE "legal_acceptances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "channel" TEXT NOT NULL,
  "labelVersion" TEXT NOT NULL,
  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_acceptances_type_check" CHECK ("documentType" IN ('terms', 'dpa', 'privacy_notice')),
  CONSTRAINT "legal_acceptances_channel_check" CHECK ("channel" IN ('signup', 'reaccept'))
);
CREATE INDEX "legal_acceptances_tenantId_userId_idx" ON "legal_acceptances"("tenantId", "userId");
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TRIGGER "legal_acceptances_no_update" BEFORE UPDATE ON "legal_acceptances" FOR EACH ROW EXECUTE FUNCTION "forbid_update"();

CREATE TABLE "marketing_consents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "consentTextVersion" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "marketing_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketing_consents_status_check" CHECK ("status" IN ('granted', 'revoked')),
  CONSTRAINT "marketing_consents_channel_check" CHECK ("channel" = 'email')
);
CREATE INDEX "marketing_consents_tenantId_userId_idx" ON "marketing_consents"("tenantId", "userId");
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TRIGGER "marketing_consents_no_update" BEFORE UPDATE ON "marketing_consents" FOR EACH ROW EXECUTE FUNCTION "forbid_update"();
