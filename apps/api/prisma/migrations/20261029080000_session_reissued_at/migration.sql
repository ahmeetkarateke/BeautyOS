-- S6b: tolerans icinde yeniden basim tek sefer ve kosullu UPDATE ile (reissuedAt IS NULL) isaretlenir; saat ve sayim farkina bagli degildir.
-- Geri alma: ALTER TABLE "sessions" DROP COLUMN "reissuedAt"; (oturumlar etkilenmez.)
ALTER TABLE "sessions" ADD COLUMN "reissuedAt" TIMESTAMP(3);
