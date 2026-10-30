-- ADR-0039 (1/2, sema): Telegram sohbet no telefon degildir; ayri kanal kimligi alanlari.
--  * customers.telegramChatId (kiracida tekil, NULL'lar cakismaz); customers.phone bos olabilir.
--  * Kimliksiz kart olmaz: phone ya da telegramChatId'den biri dolu (customers_identity_present).
--  * appointments.requestedChatId; musterisiz talep ad + (telefon ya da sohbet no) tasir.
-- Geri alma (veri taşındıktan sonra): once telegramChatId -> phone geri kopyalanir
--   (UPDATE customers SET phone = "telegramChatId" WHERE phone IS NULL), sonra:
--   DROP INDEX "customers_tenantId_telegramChatId_key"; ALTER TABLE customers DROP CONSTRAINT customers_identity_present,
--   DROP COLUMN "telegramChatId"; ALTER COLUMN phone SET NOT NULL;
--   appointments: CHECK eski bicime (ADR-0038) dondurulur, DROP COLUMN "requestedChatId" (requestedChatId dolu talep yok sayilir).
ALTER TABLE "customers" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "customers" ALTER COLUMN "phone" DROP NOT NULL;
CREATE UNIQUE INDEX "customers_tenantId_telegramChatId_key" ON "customers"("tenantId", "telegramChatId");
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_identity_present" CHECK ("phone" IS NOT NULL OR "telegramChatId" IS NOT NULL);

ALTER TABLE "appointments" ADD COLUMN "requestedChatId" TEXT;
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_customer_or_request";
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_customer_or_request" CHECK (
    "customerId" IS NOT NULL
    OR ("requestedName" IS NOT NULL AND ("requestedPhone" IS NOT NULL OR "requestedChatId" IS NOT NULL))
  );
