-- S2: SMS'siz online randevu talebi.
--  * phoneVerified: eski ve elle girilen kayitlar etkilenmez (varsayilan true); yalniz dogrulamasiz online talep false.
--  * cancelReason: ret ve sure dolumunu ayirir.
--  * customerId artik bos olabilir: dogrulanmamis talep var olan musteri kaydina BAGLANMAZ (KVKK, hukuk-uyum).
--    Girilen ad ve normalize telefon requestedName/requestedPhone'da tutulur; salon onayda musteriyi bilincli secer.
--  * CHECK: musterisiz kayit yalniz dogrulanmamis talep olabilir ve ad+telefon tasimak zorundadir.
-- Geri alma (musterisiz kayit yokken): ALTER TABLE "appointments" DROP CONSTRAINT "appointments_customer_or_request",
--   ALTER COLUMN "customerId" SET NOT NULL, DROP COLUMN "requestedName", DROP COLUMN "requestedPhone",
--   DROP COLUMN "cancelReason", DROP COLUMN "phoneVerified"; DROP TYPE "AppointmentCancelReason";
--   Musterisiz kayit varsa once onaylanmali, reddedilmeli ya da silinmelidir.
CREATE TYPE "AppointmentCancelReason" AS ENUM ('rejected', 'expired');

ALTER TABLE "appointments"
  ADD COLUMN "cancelReason" "AppointmentCancelReason",
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requestedName" TEXT,
  ADD COLUMN "requestedPhone" TEXT,
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_customer_or_request" CHECK (
    "customerId" IS NOT NULL
    OR ("phoneVerified" = false AND "requestedName" IS NOT NULL AND "requestedPhone" IS NOT NULL)
  );

-- Telefon basina bekleyen talep tavani requestedPhone ile sayilir.
CREATE INDEX "appointments_tenantId_requestedPhone_idx" ON "appointments" ("tenantId", "requestedPhone") WHERE "requestedPhone" IS NOT NULL;
