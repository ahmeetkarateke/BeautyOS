-- A7 / ADR-0043: musterinin randevu baglantisi. Token yalniz SHA-256 ozetiyle saklanir (nullable, UNIQUE);
-- yeni iptal nedeni cancelled_by_customer. Geri alma: DROP INDEX "appointments_manageTokenHash_key"; ALTER TABLE "appointments"
-- DROP COLUMN "manageTokenHash"; (enum degeri geri alinmaz; kullanilmayan deger zararsizdir.)
ALTER TYPE "AppointmentCancelReason" ADD VALUE 'cancelled_by_customer';
ALTER TABLE "appointments" ADD COLUMN "manageTokenHash" TEXT;
CREATE UNIQUE INDEX "appointments_manageTokenHash_key" ON "appointments"("manageTokenHash");
