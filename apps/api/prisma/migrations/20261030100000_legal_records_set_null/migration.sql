-- ADR-0048 (guncelleme, mudur karari 2026-10-30): kabul ve izin kayitlari kiraci/kullanici silinince kanit olarak KALIR (10 ve 3 yil saklama).
-- Yabanci anahtarlar ON DELETE SET NULL; satirda salon adresi, salon adi ve kullanici e-postasi anlik goruntu olarak saklanir.
-- Yalniz-ekleme tetikleyicisi korunur; tek istisna: SET NULL'un yaptigi tenantId/userId -> NULL guncellemesi.
-- Geri alma: yabanci anahtarlari CASCADE ile yeniden kur, NOT NULL koy (silinmis kiraci satirlari once temizlenmeli), anlik goruntu sutunlarini sil, forbid_update'i onceki surume dondur.

ALTER TABLE "legal_acceptances" ADD COLUMN "tenantSlug" TEXT, ADD COLUMN "tenantName" TEXT, ADD COLUMN "userEmail" TEXT;
ALTER TABLE "marketing_consents" ADD COLUMN "tenantSlug" TEXT, ADD COLUMN "tenantName" TEXT, ADD COLUMN "userEmail" TEXT;

-- Var olan satirlarin anlik goruntusu (tetikleyici bu doldurma icin gecici kapatilir).
ALTER TABLE "legal_acceptances" DISABLE TRIGGER "legal_acceptances_no_update";
UPDATE "legal_acceptances" a SET "tenantSlug" = t."slug", "tenantName" = t."name", "userEmail" = u."email"
  FROM "tenants" t, "users" u WHERE t."id" = a."tenantId" AND u."id" = a."userId";
ALTER TABLE "legal_acceptances" ENABLE TRIGGER "legal_acceptances_no_update";
ALTER TABLE "marketing_consents" DISABLE TRIGGER "marketing_consents_no_update";
UPDATE "marketing_consents" m SET "tenantSlug" = t."slug", "tenantName" = t."name", "userEmail" = u."email"
  FROM "tenants" t, "users" u WHERE t."id" = m."tenantId" AND u."id" = m."userId";
ALTER TABLE "marketing_consents" ENABLE TRIGGER "marketing_consents_no_update";

ALTER TABLE "legal_acceptances" ALTER COLUMN "tenantId" DROP NOT NULL, ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "marketing_consents" ALTER COLUMN "tenantId" DROP NOT NULL, ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "legal_acceptances" DROP CONSTRAINT "legal_acceptances_tenantId_fkey", DROP CONSTRAINT "legal_acceptances_userId_fkey";
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_consents" DROP CONSTRAINT "marketing_consents_tenantId_fkey", DROP CONSTRAINT "marketing_consents_userId_fkey";
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Diger sutunlar degismeden kalir; tenantId/userId yalniz oldugu gibi kalabilir ya da NULL'a inebilir (baska degere gecemez, NULL'dan geri dolamaz).
CREATE OR REPLACE FUNCTION "forbid_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'tenantId' - 'userId') = (to_jsonb(OLD) - 'tenantId' - 'userId')
     AND (NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId" OR NEW."tenantId" IS NULL)
     AND (NEW."userId" IS NOT DISTINCT FROM OLD."userId" OR NEW."userId" IS NULL) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Bu tablo yalniz eklenir, guncellenemez.';
END $$;
