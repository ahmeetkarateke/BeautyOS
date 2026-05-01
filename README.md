# BeautyOS

Berber, kuaför ve güzellik merkezi sahipleri için çok kiracılı (multi-tenant) SaaS randevu & salon yönetim sistemi.

---

## Servisler

| Ortam | Servis | URL |
|---|---|---|
| Production | API (Railway) | `https://beautyosapi-production.up.railway.app` |
| Production | Web (Vercel) | Vercel production URL |
| Staging | API (Railway) | `https://beautyos-api-staging-production.up.railway.app` |
| Staging | Web (Vercel) | Vercel preview — staging branch push'unda otomatik |

---

## Stack

```
apps/api      — Node.js 20 + Express + TypeScript + Prisma 5 + PostgreSQL (Supabase)
apps/web      — Next.js 14 App Router + TypeScript + Tailwind CSS v4
Redis         — Upstash (BullMQ kuyrukları + key-value cache)
Bot           — Telegram + Gemini 2.5 Flash (doğal dil randevu akışı)
```

---

## Branch Stratejisi

```
master          → Production (Railway prod + Vercel prod)
staging         → Staging ortamı (Railway staging + Vercel preview)
feature/*       → Geliştirme branch'leri
```

**Çalışma akışı:**
```
feature/xyz → staging (test et) → master (production'a geç)
```

Her `staging` ve `master` push'unda CI otomatik çalışır: type-check → lint → Vitest testleri.

---

## Geliştirme Ortamı

### Gereksinimler
- Node.js 20+
- PostgreSQL (veya Supabase bağlantısı)
- Redis (veya Upstash bağlantısı)

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# API env dosyasını oluştur
cp apps/api/.env.example apps/api/.env
# .env içindeki değerleri doldur

# Prisma migration'ları uygula
cd apps/api && npx prisma migrate deploy

# API'yi başlat
npm run dev --workspace=apps/api

# Web'i başlat (ayrı terminal)
npm run dev --workspace=apps/web
```

### Testler

```bash
# API testleri (Vitest — gerçek Supabase DB üzerinde çalışır)
cd apps/api && npm run test
```

---

## Ortam Değişkenleri

### apps/api

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Supabase pooler bağlantısı |
| `DIRECT_URL` | Supabase direct bağlantısı (migration için) |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `REDIS_URL` | Upstash Redis URL (TLS) |
| `REDIS_KEY_PREFIX` | Staging: `staging:` / Production: boş |
| `SENTRY_DSN` | Sentry proje DSN |
| `ALLOWED_ORIGINS` | CORS — virgülle ayrılmış origin listesi |
| `TELEGRAM_BOT_TOKEN` | Global fallback bot token |
| `GEMINI_API_KEY` | Google Gemini API anahtarı |
| `API_BASE_URL` | Kendi API'nin public URL'si (bot slot sorgusu için) |

### apps/web

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL |

---

## Monitoring

- **UptimeRobot** → `/health` endpoint'ini her 3 dakikada ping'ler; down olursa Telegram + e-posta alert
- **Sentry** → unhandled exception'lar otomatik yakalanır
- **Health endpoint:** `GET /health` → `{ status, db, redis, uptime }`

---

## Proje Yapısı

```
BeautyOS/
├── apps/
│   ├── api/                  — Express API
│   │   ├── prisma/           — Schema + migration'lar
│   │   └── src/
│   │       ├── __tests__/    — Vitest test suite (42+ test)
│   │       ├── bot/          — Telegram + Gemini bot
│   │       ├── lib/          — Queue, Sentry, yardımcılar
│   │       ├── middleware/   — Auth, error handler
│   │       └── routes/       — Tenant + public route'lar
│   └── web/                  — Next.js frontend
│       └── src/
│           ├── app/          — App Router sayfaları
│           ├── components/   — UI bileşenleri
│           ├── hooks/        — Custom hook'lar
│           ├── lib/          — apiFetch, sector-data
│           └── store/        — Zustand auth store
├── agents/                   — Agent brief'leri ve README
└── ilerleme.md               — Tüm agent'ların ortak ilerleme kaydı
```
