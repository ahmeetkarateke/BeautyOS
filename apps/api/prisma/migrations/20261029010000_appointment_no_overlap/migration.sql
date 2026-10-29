-- S3: ayni personele cakisan randevuyu veritabaninda engelle.
-- Geri alma: ALTER TABLE "appointments" DROP CONSTRAINT "appointments_staff_no_overlap";
--   (btree_gist eklentisi baska yerde kullanilmiyorsa DROP EXTENSION btree_gist; zorunlu degil.)
-- Kisit iptal, gelmedi ve silinmis randevulari saymaz. Aralik yari acik: biri biterken oburu baslayabilir.
-- Kolonlar TIMESTAMP(3) (saat dilimsiz, UTC) oldugu icin tsrange kullanilir.

-- btree_gist PG13+ "trusted" eklentidir: veritabani sahibi CREATE ile kurabilir, superuser gerekmez.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- K4: mevcut veride cakisma varsa kisit kurulamaz; migration anlasilir mesajla durur, veri otomatik silinmez/degistirilmez.
DO $$
DECLARE
  bad_range integer;
  overlap_count integer;
BEGIN
  SELECT count(*) INTO bad_range FROM "appointments"
   WHERE "endAt" < "startAt" AND NOT "isDeleted" AND "status" NOT IN ('cancelled', 'no_show');
  IF bad_range > 0 THEN
    RAISE EXCEPTION 'S3: % randevuda endAt < startAt. Once duzeltin (SELECT id FROM appointments WHERE "endAt" < "startAt").', bad_range;
  END IF;

  SELECT count(*) INTO overlap_count
    FROM "appointments" a
    JOIN "appointments" b
      ON a."staffId" = b."staffId" AND a."id" < b."id"
     AND a."startAt" < b."endAt" AND b."startAt" < a."endAt"
   WHERE NOT a."isDeleted" AND a."status" NOT IN ('cancelled', 'no_show')
     AND NOT b."isDeleted" AND b."status" NOT IN ('cancelled', 'no_show');
  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'S3: % cakisan randevu cifti var. Kisit kurulmadi. Cakismalari elle cozun (iptal ya da saat degisikligi) ve migration''i yeniden calistirin.', overlap_count;
  END IF;
END $$;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_staff_no_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tsrange("startAt", "endAt") WITH &&
  ) WHERE ("status" NOT IN ('cancelled', 'no_show') AND NOT "isDeleted");
