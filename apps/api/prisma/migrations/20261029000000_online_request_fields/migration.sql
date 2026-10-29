-- S2: SMS'siz online randevu talebi. Eski ve elle girilen kayitlar etkilenmez (phoneVerified varsayilan true);
-- yalniz dogrulamasiz online talep false yazilir. cancelReason ret ve sure dolumunu ayirir.
-- Geri alma: ALTER TABLE "appointments" DROP COLUMN "cancelReason", DROP COLUMN "phoneVerified"; DROP TYPE "AppointmentCancelReason";
CREATE TYPE "AppointmentCancelReason" AS ENUM ('rejected', 'expired');
ALTER TABLE "appointments"
  ADD COLUMN "cancelReason" "AppointmentCancelReason",
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT true;
