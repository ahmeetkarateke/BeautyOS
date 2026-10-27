# beautyos

- **Müşteri:** Şirket ürünü (B2B SaaS: berber, kuaför ve güzellik merkezleri için randevu ve salon yönetimi)
- **Başlangıç:** 2026-04-20 (şirket dışında başladı; şirkete taşınma 2026-10-27)
- **Durum:** canlı (gerçek kullanıcı yok) · Vercel + Railway + Supabase + Upstash'ten şirket sunucusuna **taşınıyor**
- **Depo:** GitHub `ahmeetkarateke/BeautyOS` (özel), ana dal `master`

Şirketin genel kuralları üst klasördeki CLAUDE.md'de ve `kod-standartlari` skill'indedir. Bu dosya yalnız projeye özel kuralları içerir. Taşıma belgeleri: `docs/mevcut-durum.md`, `docs/tasima-plani.md`, `docs/kararlar.md`, `docs/gorevler.md`.

## UYARI: `master` / `staging` push'u = CANLIYA ALMA

- Taşıma tamamlanıp kurucu Railway ve Vercel'in GitHub bağlantısını kesene kadar (tasima-plani §10 adım 1): **`master`'a push prod'u, `staging`'e push staging'i otomatik dağıtır.**
- Bu iki dala birleştirme ve her türlü `git push` yalnız kurucu onayıyla, müdür tarafından yapılır. Ajanlar yalnız yerel commit atar.
- Railway yalnız `apps/api/**` değişikliğini izler ("watch paths"). Kök dosya değişikliği (`Dockerfile`, `railway.json`) push'ta SKIPPED olur ve kurucunun elle Redeploy etmesini gerektirir. Push sonrası GitHub dağıtım durumunu kontrol et. Railway canlısının adresi `api.beautyossapp.com`'dur.
- Taşıma dalları (`tasima/*`) o adımdan önce `master`'a ya da `staging`'e birleştirilmez. Tek istisna canlıdaki açığı kapatan hotfix'lerdir (ör. G4a `/debug`); bunlar bilerek `master` üzerinden Railway'e çıkar.
- Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` eski sisteme geri dönüş yoludur. G18'e kadar değiştirilmez.

## Teknoloji

- **Monorepo:** npm workspaces (`apps/*`), tek `package-lock.json`.
- **API (`apps/api`):** Node 20, Express 4, TypeScript, Prisma 5.22 (PostgreSQL), BullMQ 5 + ioredis, zod, pino, bcryptjs + JWT (erişim 15 dk, yenileme 30 gün, httpOnly çerez), Telegram/WhatsApp kanalları, Gemini, NetGSM SMS, Resend e-posta, Sentry, Cloudflare Turnstile.
- **Web (`apps/web`):** Next.js 14 App Router, React 18, Tailwind, React Query, Zustand. API'ye tarayıcıdan `NEXT_PUBLIC_API_URL` ile gider (derlemede gömülür).
- **Veri:** PostgreSQL 17 (hedef), Redis 7.4 (yalnız BullMQ `reminders` kuyruğu).
- **Hedef barındırma:** `sirket-sunucu-1` (DO FRA1), compose projesi `beautyos` (`/srv/beautyos`), ortak Caddy (`sirket-proxy` ağı), Cloudflare proxy + Full (strict). Canlı hostlar `beautyossapp.com`, `app.`, `www.` (web) ve `api.` (API). Kalıcı staging `yeni.` (web, basic auth) ve `yeni-api.` (ADR-0016); aynı Postgres/Redis örneğinde ayrı veritabanı, rol ve Redis DB 1 kullanır.
- **Dış servis durumu (2026-10-27):** NetGSM SMS kapalı. Telegram yalnız staging'de. WhatsApp kullanılmıyor.
- **Çok kiracılık:** paylaşımlı şema, `tenantId` sütunu, filtre **yalnız uygulama katmanında** (RLS yok, teknik borç T-B1). Kiracı URL yolundan seçilir (`/tenant/[slug]`).

## Komutlar

- Bağımlılık: `npm ci` (kökten)
- Geliştirme: `npm run dev:api`, `npm run dev:web`
- Test: `npm test` (API, Vitest). **Gerçek PostgreSQL + Redis ister.** Supabase/canlı veritabanına bağlanmayı test yardımcısı reddeder; yerelde ya da CI'da geçici `postgres:17` kullanılır.
- Tip ve lint: `npm run type-check`, `npm run lint`
- Migration (yerel): `cd apps/api && npx prisma migrate deploy`. Sunucuda yalnız `docker compose --profile migrate run --rm migrate` ve `[ONAY]` ile.
- İmaj: sunucuda `deploy/betikler/derle.sh <tam-sha>` (ADR-0018, ADR-0019).
  - Sunucu GitHub'dan çekmez. Müdür, denetçi ONAY'lı commit'i `git archive` paketiyle `/srv/beautyos/kaynak/<sha12>/` dizinine aktarır.
  - Betik paketin SHA-256 özetini ve içindeki commit kimliğini doğrulamadan derlemez.
  - Taşıma dalları GitHub'a push edilmez. Vercel her dal push'unda preview açar.
  - Etiket commit'in ilk 12 hanesidir; son 3 sürüm yerelde tutulur. Kayıt defteri (GHCR) yok.
  - CI'daki `imaj.yml` yalnız derleme kontrolüdür; G18 birleştirmesine kadar çalışmaz.
- Yayın: devops yapar. Önce staging: `docker compose up -d api-staging web-staging`. Test GEÇTİ sonrası canlı: `docker compose up -d api web`. Her seferinde imaj etiketi compose'da güncellenir (`docker-yayinlama` skill'i).

## Projeye özel kurallar

1. **Kiracı filtresi:** Kiracıya ait her Prisma sorgusunda `tenantId` koşulu zorunlu ve `req.tenantId`'den gelir (asla gövde/sorgu parametresinden değil). RLS olmadığı için tek savunma budur; denetçi eksik filtreyi Kritik sayar. Her yeni rota için kiracı izolasyonu testi yazılır (`src/__tests__/tenant-isolation.test.ts` örneği).
2. **Tek API kopyası:** BullMQ işçisi API sürecinde; hız sınırları bellekte. `api` servisi ölçeklenmez (ADR-0006).
3. **Saat dilimi:** API konteyneri `TZ=UTC`. Kullanıcıya gösterilen saatler kodda `timeZone: 'Europe/Istanbul'` ile biçimlenir. Cron ve "bugün" hesapları UTC'ye göredir; değiştirmek ADR ister.
4. **Hatırlatma işleri** belirlenimci jobId kullanır (`reminder-24h-<id>`, `reminder-2h-<id>`). Yeni gecikmeli iş eklerken de belirlenimci jobId kullan; çift iş oluşmaz.
5. **Ortam ayrımı:** Bir Telegram bot token'ı yalnız tek ortamda kullanılır. API açılışta webhook'u kendi `PUBLIC_URL`'ine kaydeder; aynı token iki ortamda olursa webhook'u birbirinden çalarlar. Staging ve canlının `JWT_SECRET`'i farklıdır. Staging veritabanına canlı veri kopyalanmaz. SMS açılacaksa (`NETGSM_*`) önce kurucu onayı alınır; staging'de hiçbir zaman açılmaz.
6. **Ortam değişkenleri:** Sunucu düzeni ve tüm adlar kök `.env.example`'da. `MIGRATION_DATABASE_URL` yalnız `.env.migrate`'te; uygulama `app_user` ile bağlanır. Yeni değişken = kök `.env.example`'a açıklamalı satır + (zorunluysa) açılış kontrolüne ekleme.
7. **Log:** pino JSON. Log'a ad, telefon, e-posta, mesaj içeriği yazılmaz; `tenantId` ve kayıt ID'si yazılır. Anamnez (sağlık) verisi özel nitelikli kişisel veridir.
8. **Docker:** Caddy dışında hiçbir servis port yayınlamaz (sunucu-altyapi ADR-0004). Postgres ve Redis `sirket-proxy` ağına girmez.
9. **Türk I'sı:** host ve e-posta karşılaştırmalarında `toLowerCase()` ya da `URL` normalizasyonu; `toLocaleLowerCase` kullanılmaz. Testlere büyük `I` içeren vaka eklenir.
10. **Dal adları:** bu projede ana dal şimdilik `master` (Vercel/Railway bağlı). Görev dalları `gorev/<no>-<kisa-ad>`, taşıma dalları `tasima/<ad>`.
