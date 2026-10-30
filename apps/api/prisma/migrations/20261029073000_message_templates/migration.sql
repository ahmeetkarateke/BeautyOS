-- ADR-0047 / L4: message_deliveries ileti govdesi saklamaz; sablonlu iletide (templateKey, templateVersion) tutulur.
-- Bir kerelik veri gecisi: migration oncesi kayitlarin metni sablondan uretilmedi (klinikte hizmet adi da gecebiliyordu), bu yuzden
-- HEPSI legacy@0 olur; sahte "reminder_*@1" ispati yazilmaz. Govde yalniz sablonlu amaclarda (reminder_24h, reminder_2h, verification)
-- bosaltilir; campaign ve transactional serbest metinleri ADR-0047'ye gore saklanir ve 1 yil sonra anonimlestirilir.
-- Canlida bu veri silme sayilir: kurucu onayli canli yayinla (yayinla.sh --onayli) birlikte calisir.
-- Geri alma: gövdeler geri gelmez (kasitli). ALTER TABLE "message_deliveries" DROP CONSTRAINT "message_deliveries_body_or_template",
-- DROP COLUMN "templateKey", DROP COLUMN "templateVersion"; "body" NOT NULL yapmak icin once bos govdeler doldurulmali.
ALTER TABLE "message_deliveries" ALTER COLUMN "body" DROP NOT NULL;
ALTER TABLE "message_deliveries" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "message_deliveries" ADD COLUMN "templateVersion" INTEGER;

UPDATE "message_deliveries" SET "templateKey" = 'legacy', "templateVersion" = 0;

UPDATE "message_deliveries" SET "body" = NULL WHERE "purpose" IN ('reminder_24h', 'reminder_2h', 'verification');

ALTER TABLE "message_deliveries"
  ADD CONSTRAINT "message_deliveries_body_or_template"
  CHECK ("body" IS NOT NULL OR ("templateKey" IS NOT NULL AND "templateVersion" IS NOT NULL));
