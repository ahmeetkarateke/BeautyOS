-- ADR-0039 (2/2, veri): Telegram kanalindan gelen kartlarin sohbet no'su phone'dan telegramChatId'ye tasinir.
-- Olcut "telefon bicimine uymayan" DEGIL (sohbet no 5 ile baslayan 10 hane olabilir): musterinin hicbir randevusu
-- telegram disi kanaldan degilse VE en az bir telegram randevusu varsa kart Telegram kartidir.
-- Etkilenen kart sayisi NOTICE ile yazilir; kisisel veri yazilmaz. Canlida beklenen 0 (bot canlida kapali).
-- Geri alma: UPDATE customers SET phone = "telegramChatId" WHERE phone IS NULL; telegramChatId'yi temizle.
DO $$
DECLARE moved integer;
BEGIN
  WITH telegram_only AS (
    SELECT c."id"
    FROM "customers" c
    WHERE c."phone" IS NOT NULL
      AND c."telegramChatId" IS NULL
      AND EXISTS (SELECT 1 FROM "appointments" a WHERE a."customerId" = c."id" AND a."bookingChannel" = 'telegram')
      AND NOT EXISTS (SELECT 1 FROM "appointments" a WHERE a."customerId" = c."id" AND a."bookingChannel" <> 'telegram')
  )
  UPDATE "customers" c
  SET "telegramChatId" = c."phone", "phone" = NULL
  FROM telegram_only t
  WHERE c."id" = t."id";
  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'telegram_chat_id_data: % kart tasindi', moved;
END $$;
