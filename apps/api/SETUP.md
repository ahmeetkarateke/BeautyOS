# BeautyOS API — Kurulum Rehberi

## 1. Bağımlılıkları yükle

```bash
# Proje kökünde çalıştır
cd c:\Users\ahmee\OneDrive\Desktop\Projeler\BeautyOS
npm install
```

## 2. Ortam değişkenlerini ayarla

```bash
cp apps/api/.env.example apps/api/.env
# apps/api/.env dosyasını düzenleyip key'leri doldur
```

## 3. Telegram Bot oluştur (2 dakika)

1. Telegram'da **@BotFather**'a git
2. `/newbot` yaz
3. Bot adı: `BeautyOS Test`
4. Kullanıcı adı: `beautyos_test_bot` (benzersiz olmalı)
5. Gelen **token'ı** `.env` dosyasına yaz: `TELEGRAM_BOT_TOKEN=...`

## 4. Redis başlat

**Seçenek A — Docker (önerilen):**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Seçenek B — Upstash (bulut, ücretsiz tier):**
- upstash.com → Create Database → `REDIS_URL`'i .env'e yaz

## 5. ngrok ile dışa aç (Telegram webhook için şart)

```bash
# ngrok kurulu değilse: https://ngrok.com/download
ngrok http 3001
# Çıkan URL'i .env'e yaz: PUBLIC_URL=https://abc123.ngrok-free.app
```

## 6. Sunucuyu başlat

```bash
npm run dev
```

Konsolda şunu görmelisin:
```
BeautyOS API sunucusu başlatıldı  port=3001
Redis bağlantısı kuruldu
Telegram webhook kaydedildi       webhookUrl=https://abc123.ngrok-free.app/webhook/telegram
Telegram bot hazır                username=beautyos_test_bot
```

## 7. Test et

Telegram'da botunuzu bulun (`@beautyos_test_bot`) ve mesaj gönderin:
- "merhaba" → Karşılama mesajı
- "randevu almak istiyorum" → Hizmet listesi
- "fiyat listesi" → Fiyatlar

## Proje Yapısı

```
apps/api/src/
├── channels/
│   ├── types.ts              — Kanal interface (değiştirme!)
│   ├── telegram.channel.ts  — Telegram implementasyonu
│   ├── whatsapp.channel.ts  — WhatsApp stub (onay gelince doldurulacak)
│   └── channel.factory.ts   — Kanal başlatıcı
├── session/
│   └── session.service.ts   — Redis oturum yönetimi
├── ai/
│   └── intent.service.ts    — GPT-4o hibrit niyet tespiti
├── bot/
│   └── flow.handler.ts      — Ana konuşma akışı
├── routes/
│   └── webhook.route.ts     — Express route'ları
├── lib/
│   ├── logger.ts            — Pino logger
│   └── salon.context.ts     — Salon bilgisi (MVP: sabit, sonra DB'den)
└── index.ts                 — Uygulama başlangıcı
```

## WhatsApp'a Geçiş (Onay Gelince)

`.env` dosyasına şunları ekle:
```
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

Bot mantığı **hiç değişmez.** `channel.factory.ts` her iki kanalı otomatik başlatır.
