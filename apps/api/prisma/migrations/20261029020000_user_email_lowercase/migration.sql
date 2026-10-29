-- S7: giris ve kayit e-postayi kucuk harfle TAM eslestirir (ILIKE joker riski nedeniyle 'insensitive' aranmaz).
-- Eski karisik harfli kayitlari bir kerelik kucuk harfe cevir.
-- Giris kiracidan bagimsiz e-postayla aranir (findFirst), bu yuzden tekrar kontrolu KURESELDIR (kiracisiz superadmin
-- dahil): iki kayit yalniz harf farkiyla ayniysa migration anlasilir hatayla durur, veri degistirilmez ve silinmez;
-- cakismalar elle cozulmeli.
-- Geri alma: gerekmez (e-posta zaten kucuk harfle esdeger); orijinal buyuk/kucuk harf bilgisi geri getirilemez.
DO $$
DECLARE
  clashes integer;
BEGIN
  SELECT count(*) INTO clashes FROM (
    SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1
  ) d;
  IF clashes > 0 THEN
    RAISE EXCEPTION 'S7: % e-posta grubu yalniz buyuk/kucuk harf farkiyla (ya da kiracilar arasi) cakisiyor. Once elle cozun.', clashes;
  END IF;
END $$;

UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
