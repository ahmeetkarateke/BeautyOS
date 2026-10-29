# beautyos

- **Müşteri:** Şirket ürünü (B2B SaaS: berber, kuaför ve güzellik merkezleri için randevu ve salon yönetimi)
- **Başlangıç:** 2026-04-20 (şirket dışında başladı; şirkete taşınma 2026-10-27)
- **Durum:** canlı (gerçek kullanıcı yok) · şirket sunucusuna **taşındı** (DNS geçişi 2026-10-29). Eski servislerin kapatılması bekliyor (G17).
- **Depo:** GitHub `ahmeetkarateke/BeautyOS` (özel). Yeni arayüz ve güvenlik işinin ana hattı yerel `gelistirme` dalıdır (ADR-0022). `master` taşıma öncesinden kaldı.

Şirketin genel kuralları üst klasördeki CLAUDE.md'de ve `kod-standartlari` skill'indedir. Bu dosya yalnız projeye özel kuralları içerir. Belgeler: `docs/kodlama-plani.md` (yeni arayüz + güvenlik), `docs/kararlar.md`, `docs/tasarim.md`, taşıma için `docs/tasima-plani.md` ve `docs/gorevler.md`.

## Push ve dallar

- **Push artık hiçbir yere yayın yapmaz.** Kurucu Railway ve Vercel'in GitHub bağlantısını kesti (G17-K0, 2026-10-29). Yayın yalnız sunucuda yapılır (bkz. Komutlar).
- Her türlü `git push` ve `master`'a birleştirme yine yalnız kurucu onayıyla, müdür tarafından yapılır. Ajanlar yalnız yerel commit atar.
- Görev dalları `gelistirme`'den açılır. Müdür denetçinin ONAY verdiği dalı yerelde `gelistirme`'ye birleştirir (ADR-0022). `tasima/docker` donduruldu.
- Railway servisleri G17'de kapatılana kadar çalışmayı sürdürüyor ama trafik almıyor. Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` G18'de silinecek.

## Teknoloji

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`), tek `package-lock.json`. Paylaşılan kod `packages/shared`'de (izinler, terimler, işletme türleri; ADR-0030, ADR-0031).
- **API (`apps/api`):** Node 20 (Node 22'ye geçiş S9'da, ADR-0024), Express 4, TypeScript, Prisma 5.22 (PostgreSQL), BullMQ 5 + ioredis, zod, pino, bcryptjs + JWT (erişim 15 dk, yenileme 30 gün, httpOnly çerez), Telegram/WhatsApp kanalları, Gemini, NetGSM SMS, Resend e-posta, Sentry, Cloudflare Turnstile.
- **Web (`apps/web`):** Next.js 16 App Router (Turbopack, `proxy.ts`), React 19, Tailwind v4 (tek sürüm, `tailwind.config.ts` yok), React Query, Zustand. API'ye tarayıcıdan `NEXT_PUBLIC_API_URL` ile gider (derlemede gömülür). ADR-0024, ADR-0025.
  - **Yeni arayüz (v2)** eskisiyle aynı uygulamada iki kök düzende durur: `app/(legacy)` ve `app/(v2)`. Hangi yüzeyin yeni olduğunu derleme anındaki `NEXT_PUBLIC_UI_V2` bayrağı belirler; canlıda boş, staging'de dolu (ADR-0023).
  - v2 kodu eski klasörlerden içe aktarma yapmaz.
  - v2 teknolojileri: Radix Primitives + kendi `src/ui` bileşenlerimiz (ADR-0026), depodan Hanken Grotesk (ADR-0027), lucide-react (ADR-0028), kendi takvimimiz + `@dnd-kit/core` + `date-fns`/`@date-fns/tz` (ADR-0029).
  - Web testleri: Vitest + RTL, Playwright + axe (ADR-0033).
- **Veri:** PostgreSQL 17 (hedef), Redis 7.4 (yalnız BullMQ `reminders` kuyruğu).
- **Barındırma:** `sirket-sunucu-1` (DO FRA1), compose projesi `beautyos` (`/srv/beautyos`), ortak Caddy (`sirket-proxy` ağı). Cloudflare DNS bugün gri (proxy kapalı, ADR-0021); turuncu bulut ve Full (strict) G20'de. Canlı hostlar `beautyossapp.com`, `app.`, `www.` (web) ve `api.` (API). Kalıcı staging `yeni.` (web, basic auth) ve `yeni-api.` (ADR-0016); aynı Postgres/Redis örneğinde ayrı veritabanı, rol ve Redis DB 1 kullanır.
- **Dış servis durumu (2026-10-27):** NetGSM SMS kapalı. Telegram yalnız staging'de. WhatsApp kullanılmıyor.
- **Çok kiracılık:** paylaşımlı şema, `tenantId` sütunu, filtre **yalnız uygulama katmanında** (RLS yok, teknik borç T-B1). Kiracı URL yolundan seçilir: eski arayüzde `/tenant/[slug]`, yenisinde `/panel/[slug]`.

## Komutlar

- Bağımlılık: `npm ci` (kökten)
- Geliştirme: `npm run dev:api`, `npm run dev:web`
- Test: `npm test` (API, Vitest). **Gerçek PostgreSQL + Redis ister.** Supabase/canlı veritabanına bağlanmayı test yardımcısı reddeder; yerelde ya da CI'da geçici `postgres:17` kullanılır.
- Tip ve lint: `npm run type-check`, `npm run lint`
- Migration (yerel): `cd apps/api && npx prisma migrate deploy`. Sunucuda yalnız `deploy/betikler/yayinla.sh --migrate …` ile (migration yeni imajla, api'den önce çalışır; canlıda `--onayli`).
- İmaj: sunucuda `deploy/betikler/derle.sh <tam-sha>` (ADR-0018, ADR-0019).
  - Sunucu GitHub'dan çekmez. Müdür, denetçi ONAY'lı commit'i `git archive` paketiyle `/srv/beautyos/kaynak/<sha12>/` dizinine aktarır.
  - Betik paketin SHA-256 özetini ve içindeki commit kimliğini doğrulamadan derlemez.
  - Push yalnız kurucu onayıyla yapılır; Vercel/Railway bağlantısı kesildiği için push dağıtım ya da preview tetiklemez (G17-K0).
  - Etiket commit'in ilk 12 hanesidir; son 3 sürüm yerelde tutulur. Kayıt defteri (GHCR) yok.
  - CI'daki `imaj.yml` yalnız derleme kontrolüdür; G18 birleştirmesine kadar çalışmaz.
- Yayın: devops yapar, **yalnız** `deploy/betikler/yayinla.sh [--kuru] [--migrate] [--onayli] <staging|canli> <sha12>` ile (önce api sonra web, sağlık kontrolü, hata olursa ikisi birlikte geri alınır). Sürüm etiketleri gizli olmayan `/srv/beautyos/surum.conf`'ta; compose elle çalıştırılacaksa her zaman `docker compose -p beautyos --env-file .env --env-file surum.conf …`. `.env`'de `BEAUTYOS_*VERSION` satırı kalırsa betik durur. Düz `docker compose up` canlıyı eski sürüme döndürebilir; kullanılmaz. Canlı yayın kurucunun açık onayıyla.

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
10. **Dal adları:** ana hat `gelistirme` (ADR-0022); `master`'a birleştirme kurucu kararıdır. Görev dalları `gorev/<no>-<kisa-ad>`, taşıma dalları `tasima/<ad>` (donduruldu).
