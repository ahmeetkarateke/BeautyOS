-- ADR-0038: ayni telefonla birden cok musteri (aile paylasimi olagandir).
--  * customers (tenantId, phone) tekilligi kalkar, ayni sutunlarda normal indeks kalir.
--  * appointments CHECK gevser: musterisiz kayit, ad ve telefon (requestedName/requestedPhone) tasiyorsa gecerlidir.
--    Boylece sms modunda ayni telefonda birden cok kart varken talep hicbirine baglanmadan salon eslestirmesini bekler.
-- Geri alma: tekrarlayan telefon varsa UNIQUE yeniden eklenemez; once tekrar taramasi gerekir:
--   SELECT "tenantId", phone, count(*) FROM customers GROUP BY 1, 2 HAVING count(*) > 1;
--   Tekrarlar birlestirilince: DROP INDEX "customers_tenantId_phone_idx"; CREATE UNIQUE INDEX "customers_tenantId_phone_key" ON "customers"("tenantId", "phone");
--   CHECK geri: DROP CONSTRAINT "appointments_customer_or_request"; ADD CONSTRAINT ... CHECK ("customerId" IS NOT NULL OR ("phoneVerified" = false AND "requestedName" IS NOT NULL AND "requestedPhone" IS NOT NULL));
--   (once phoneVerified=true olan musterisiz talepler onaylanmali ya da reddedilmeli.)
DROP INDEX "customers_tenantId_phone_key";
CREATE INDEX "customers_tenantId_phone_idx" ON "customers"("tenantId", "phone");

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_customer_or_request";
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_customer_or_request" CHECK (
    "customerId" IS NOT NULL
    OR ("requestedName" IS NOT NULL AND "requestedPhone" IS NOT NULL)
  );
