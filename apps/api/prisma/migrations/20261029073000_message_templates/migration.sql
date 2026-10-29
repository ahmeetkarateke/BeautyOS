-- ADR-0047 / L4: message_deliveries ileti gövdesini saklamaz; sablonlu iletide (templateKey, templateVersion) tutulur.
-- Bir kerelik veri gecisi: mevcut TUM govdeler bosaltilir (OTP ve kisisel metin birikmesin). Sablon amaci eslesen kayitlara anahtar/surum
-- yazilir, eslesmeyenler legacy@0 olur. Canlida bu veri silme sayilir: kurucu onayli canli yayinla (yayinla.sh --onayli) birlikte calisir.
-- Geri alma: gövdeler geri gelmez (kasitli). ALTER TABLE "message_deliveries" DROP CONSTRAINT "message_deliveries_body_or_template",
-- DROP COLUMN "templateKey", DROP COLUMN "templateVersion"; "body" NOT NULL yapmak icin once bos govdeler doldurulmali.
ALTER TABLE "message_deliveries" ALTER COLUMN "body" DROP NOT NULL;
ALTER TABLE "message_deliveries" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "message_deliveries" ADD COLUMN "templateVersion" INTEGER;

UPDATE "message_deliveries"
SET "templateKey" = CASE "purpose"
      WHEN 'reminder_24h' THEN 'reminder_24h'
      WHEN 'reminder_2h' THEN 'reminder_2h'
      WHEN 'verification' THEN 'phone_verification'
      ELSE 'legacy'
    END,
    "templateVersion" = CASE WHEN "purpose" IN ('reminder_24h', 'reminder_2h', 'verification') THEN 1 ELSE 0 END;

UPDATE "message_deliveries" SET "body" = NULL;

ALTER TABLE "message_deliveries"
  ADD CONSTRAINT "message_deliveries_body_or_template"
  CHECK ("body" IS NOT NULL OR ("templateKey" IS NOT NULL AND "templateVersion" IS NOT NULL));
