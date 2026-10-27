# BeautyOS Taşıma — Görev Listesi

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Sürüm:** 2 (kurucu yanıtlarıyla sadeleştirildi)
- **Bağlı belgeler:** `docs/tasima-plani.md` (plan), `docs/kararlar.md` (kararlar), `docs/mevcut-durum.md` (bulgular), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum)
- **Durum değerleri:** `bekliyor` | `devam ediyor` | `incelemede` | `tamamlandı` | `iptal`. Bu dosya mimarındır. Görev sahibi durum değişikliğini mesajla bildirir, mimar işler.
- **Kod görevleri** `kod-standartlari`'na göre test önce yazılır. `[İNCELEME HAZIR]` mesajında kabul kriteri → test adı eşlemesi verilir (ör. `G4b-K3: rejects origin evil-beautyossapp.com`). Denetçi ONAY'ı olmadan hiçbir görev "tamamlandı" sayılmaz.
- `[ONAY]` = kurucu onayı (müdür toplar).

## Dallar ve dosya sahipliği

| Dal / yer | Sahibi | Dosyalar |
|---|---|---|
| `tasima/sunucu` (bu dal) | mimar | `docs/*` (`kvkk-tasima-degerlendirmesi.md` hariç: hukuk-uyum), `CLAUDE.md`, kök `.env.example`, `.gitignore` |
| `tasima/docker` (ayrı worktree, master'dan) | gelistirici | `apps/*/Dockerfile`, `.dockerignore`, `apps/web/next.config.mjs`, `deploy/**`, `apps/api/src/**`, `apps/web/src/**`, `.github/workflows/**` |
| hotfix dalı (`gorev/4a-debug-kapat`, master'dan) | gelistirici | `apps/api/src/index.ts` (yalnız `/debug` bloğu) + testi |
| `projeler/sunucu-altyapi` | devops | Caddy, yedek, izleme; `sirket/sunucu.md` kayıtları |
| `raporlar/test/beautyos-tasima-*.md` | test-muhendisi | Test planı ve raporları |

**Kurallar:**
- Taşıma dalları geçiş adım 1'den (Git otomatik dağıtımı kapatma) önce `master`'a ya da `staging`'e birleştirilmez.
- Tek istisna G4a hotfix'idir. Bilerek `master` üzerinden Railway'e çıkar; push'u müdür kurucu onayıyla yapar. Hotfix birleşince `tasima/docker` dalı `master`'dan güncellenir.
- Kök `.env.example` yalnız bu dalda düzenlenir. gelistirici yeni bir değişken adı eklerse adını ve açıklamasını mimara bildirir.
- Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` G18'e kadar değiştirilmez (geri dönüş yolu).

## Özet tablo

| No | Görev | Sahibi | Bağımlı | Durum |
|---|---|---|---|---|
| G1 | CI testleri geçici Postgres 17'de | gelistirici | — | bekliyor |
| G2 | API imajı | gelistirici | — | devam ediyor (`tasima/docker`) |
| G3 | Web imajı (standalone) + zorunlu API adresi | gelistirici | — | devam ediyor (Dockerfile + standalone); API adresi kısmı bekliyor |
| G4a | `/debug` uç noktasını canlıda kapat | gelistirici | — | **devam ediyor (ayrı hotfix)** |
| G4b | Tek CORS modülü | gelistirici | — | bekliyor |
| G5 | Açılış kontrolü, düzgün kapanış, log ve Sentry temizliği | gelistirici | — | bekliyor |
| G6 | Hatırlatmaları yeniden kuyruğa alma betiği | — | — | **iptal** (SMS kapalı; kurucu yanıtı 3) |
| G7 | İmaj derleme iş akışı (GHCR; web canlı + staging) | gelistirici | G2, G3 | bekliyor |
| G8 | Ortak Caddy | devops | — | devam ediyor |
| G9 | Yedekleme + geri yükleme denemesi | devops | G11 | devam ediyor |
| G10 | İzleme ve uyarılar | devops | G8 | devam ediyor |
| G11 | `deploy/` yığını (canlı + kalıcı staging), roller, Caddy parçası | gelistirici | G2, G3, G8 | devam ediyor (`tasima/docker`) |
| G12 | Veri aktarım ve doğrulama betikleri | gelistirici | G11 | bekliyor |
| G13 | Veri betiğinin ön denemesi (geçici, ağsız konteyner) | kurucu + devops | G12 | bekliyor |
| G14 | Kabul test planı + staging'de kabul testi | test-muhendisi | G11 (plan hemen başlayabilir) | bekliyor |
| G15 | Geçiş | kurucu + devops | G1–G5, G7–G14 | bekliyor |
| G16 | Canlı duman testi + 48 saat gözlem | test-muhendisi + devops | G15 | bekliyor |
| G17 | Eski servislerin kapatılması (+3 gün) | kurucu + devops | G16 | bekliyor |
| G18 | Taşıma sonrası temizlik ve yükseltmeler | gelistirici | G17 | bekliyor |

---

## Aşama 0–1 — Uygulama (gelistirici)

### G1 — CI testleri geçici Postgres 17'de
- **Dosyalar:** `.github/workflows/ci.yml`
- **Kabul kriterleri:**
  - K1: `test` işinde `postgres:17.x` servis konteyneri var. `secrets.DATABASE_URL` hiçbir adımda geçmez.
  - K2: Testlerden önce `prisma migrate deploy` 19 migration'ın tamamını uygular.
  - K3: Test takımı PG 17'de yeşil. Kalan test bulgu olarak raporlanır; testi silmek ya da atlamak yok.
  - K4: `quality` işi sır olmadan çalışır (`prisma generate` sahte URL ile).
  - K5: D2 sonucu mimara bildirilir.

### G2 — API imajı — *devam ediyor*
- **Dosyalar:** `apps/api/Dockerfile`, `.dockerignore`
- **Kabul kriterleri:**
  - K1: Çok aşamalı imaj. Taban `node:20.x-bookworm-slim` (sabit küçük sürüm). Kurulum kök kilit dosyasıyla `npm ci`. Son imajda dev bağımlılığı, test ve `.ts` kaynağı yok.
  - K2: `prisma generate`, çalışma imajıyla aynı tabanlı aşamada çalışır. Açılışta Prisma motoru hatası yok.
  - K3: `USER node`; `id -u` 0 değil.
  - K4: `.dockerignore` şunları dışlar: `.git`, `**/.env*` (`!**/.env.example`), `node_modules`, `docs`, testler. İmajda `.env*` dosyası yok.
  - K5: `HEALTHCHECK` Node `fetch` ile `/health`'i yoklar. `ENV TZ=UTC`, `NODE_ENV=production`.
  - K6: D3 (`DIRECT_URL` çalışma anında gerekiyor mu) sonucu bildirilir.

### G3 — Web imajı ve zorunlu API adresi — *Dockerfile kısmı devam ediyor*
- **Dosyalar:** `apps/web/Dockerfile`, `apps/web/next.config.mjs`, `apps/web/src/lib/config.ts` (yeni), `apps/web/src/lib/api.ts`, `apps/web/src/lib/admin-api.ts`, `apps/web/src/app/admin/login/page.tsx`, `apps/web/src/app/book/[slug]/page.tsx`
- **Kabul kriterleri:**
  - K1: `output: 'standalone'` (+ `outputFileTracingRoot`); başka davranış değişikliği yok.
  - K2: Çalışma aşaması `node server.js`, `USER node`, port 3000. `HEALTHCHECK` var. `read_only` kök dosya sistemiyle çalışır (`/tmp` ve `.next/cache` tmpfs).
  - K3: Derleme argümanları yalnız `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ve `NEXT_PUBLIC_BOT_FEATURES_ENABLED`.
  - K4: `beautyosapi-production.up.railway.app` sabiti kaynakta kalmaz; API adresi tek modülden okunur.
  - K5: `NEXT_PUBLIC_API_URL` tanımsızken üretim derlemesi anlaşılır bir hatayla durur (K5 adlı test).

### G4a — `/debug` uç noktasını canlıda kapat — *devam ediyor, ayrı hotfix*
- **Dal:** `gorev/4a-debug-kapat` (`master`'dan). **Dosyalar:** `apps/api/src/index.ts`, yeni test.
- **Kabul kriterleri:**
  - K1: `GET /debug` 404 döner. Gemini çağrısı ve ortam bilgisi döndüren kod silinir. Test önce kırmızı görülür.
  - K2: Başka davranış değişikliği yok (diff yalnız bu blok + test).
  - K3: Denetçi ONAY'ından sonra müdür, kurucu onayıyla `master`'a push eder `[ONAY]`. Railway dağıtımından sonra canlı `/debug` 404 döner (kurucu ya da devops `curl` ile doğrular).
  - K4: Hotfix `tasima/docker` dalına da alınır.

### G4b — Tek CORS modülü
- **Dosyalar:** `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/lib/cors.ts` (yeni), `apps/api/src/__tests__/cors.test.ts` (yeni)
- **Kabul kriterleri:**
  - K1: `index.ts` ve `app.ts` aynı `isOriginAllowed`'ı kullanır. Kaynaklar: `ALLOWED_ORIGINS` (tam eşleşme), `beautyossapp.com` ve `*.beautyossapp.com` (https), geliştirmede localhost. `CORS_ORIGIN` geriye uyum için okunur.
  - K2: Negatif testler, her biri tek kuralı bozar: `https://evil-beautyossapp.com`, `https://beautyossapp.com.evil.com`, üretimde `http://app.beautyossapp.com`. Ret, CORS başlığının yokluğuyla doğrulanır.
  - K3: Olumlu testler: `https://app.beautyossapp.com`, `https://yeni.beautyossapp.com`, `https://APP.beautyossapp.com` (büyük harf; `toLocaleLowerCase` yok).
  - K4: `beauty-os*.vercel.app` deseni kaldırılır.

### G5 — Açılış kontrolü, düzgün kapanış, log ve Sentry temizliği
- **Dosyalar:** `apps/api/src/index.ts`, `apps/api/src/lib/env.ts` (yeni), `apps/api/src/lib/queue.ts`, `apps/api/src/instrument.ts`, testler
- **Kabul kriterleri:**
  - K1: Üretimde `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (≥ 32), `ALLOWED_ORIGINS`, `PUBLIC_URL` ve `FRONTEND_URL` eksikse API, eksik değişkenin yalnız adını yazarak durur.
  - K2: `TELEGRAM_BOT_TOKEN`, `NETGSM_*` ve `RESEND_API_KEY` boşken API açılır ve her biri için tek satır "kapalı" uyarısı yazar.
  - K3: `SIGTERM` gelince HTTP sunucusu kapanır, BullMQ işçisi `close()` ile durur, Redis ve Prisma bağlantıları kesilir; süreç 10 sn içinde 0 koduyla çıkar.
  - K4: Log'larda telefon yok (`queue.ts` uyarısı yalnız `appointmentId` yazar).
  - K5 (KVKK G-1): Sentry `beforeSend` istek gövdesini, sorgu dizgisini ve çerezleri tümden siler; testte sahte bir olayla doğrulanır. Bu birleşmeden canlıda `SENTRY_DSN` boş kalır (S7).

### G7 — İmaj derleme iş akışı
- **Dosyalar:** `.github/workflows/imaj.yml`
- **Kabul kriterleri:**
  - K1: Tetik `workflow_dispatch` + `v*`. `master`/`staging` push'unda çalışmaz.
  - K2: `permissions: contents: read, packages: write`. SSH ya da dağıtım adımı yok.
  - K3: Çıktılar `beautyos-api:<sha-12>`, `beautyos-web:<sha-12>-prod` ve `beautyos-web:<sha-12>-staging`. `latest` yok.
  - K4: Web değerleri `vars.*`'tan gelir (canlı ve staging için ayrı değişkenler); `secrets.*` kullanılmaz.
  - K5: D4 (GHCR kota/ücret) bildirilir.

## Aşama 2 — Altyapı (devops, sunucu-altyapi)

### G8 — Ortak Caddy — *devam ediyor*
- K1: Özel imaj sabit sürümle derlenir (`caddy-dns/cloudflare`). Sunucu yalnız 22/80/443'te dinler. Ağ `sirket-proxy`.
- K2: Genel ayarlar: `trusted_proxies static` (Cloudflare listesi, aylık `--ip-kontrol`), `client_ip_headers CF-Connecting-IP`, `import /srv/caddy/siteler/*.caddy`. `caddy validate` geçer.
- K3: `CLOUDFLARE_API_TOKEN` yalnız `/srv/caddy/.env`'de. Token `Zone:DNS:Edit` + `Zone:Zone:Read` yetkili ve tek zonda (kurucu teyidi).
- K4: `api`, `yeni` ve `yeni-api` sertifikaları DNS-01 ile alınır; `app`/apex/`www` sertifikaları DNS geçişinden önce hazır.
- K5: Cloudflare (kurucu panelden, devops kontrol eder): Full (strict), min TLS 1.2, `api` ve `yeni-api` için "Bypass cache", Web Analytics/Zaraz/Logpush kapalı, Bot Fight Mode kapalı.

### G9 — Yedekleme — *devam ediyor*
- K1: 03:30 TR: `beautyos` + `beautyos_staging` + rol dökümü → restic → B2 eu-central. `projeler.conf` satırı compose ile teyit edilir.
- K2: B2 kova yaşam döngüsü "yalnız son sürüm". Gece `forget` (7/4/6), haftalık `prune`. `--keep-tag arsiv` yok.
- K3: Başarısız iş Healthchecks üzerinden Telegram'a uyarı yollar; bilerek bozulan bir çalıştırmayla denenir.
- K4: `yedek-geri-yukle.sh dene beautyos` başarılı: geçici, ağsız konteyner; satır sayıları eşleşir; deneme bitince konteyner ve volume silinir. Sonuç `deneme-gunlugu.txt` ve `sirket/sunucu.md`'ye yazılır.

### G10 — İzleme — *devam ediyor*
- K1: Yoklamalar: `api/health` (anahtar kelime `"status":"ok"`), `app/login`, apex (son ikisi geçişte açılır). Uyarılar Telegram'a.
- K2: Yedek kalp atışı izlemesi (G9-K3).
- K3: DO uyarıları: CPU %80, bellek %85, disk %85. Bir test uyarısı Telegram'a ulaştı.

## Aşama 3 — Yığın, staging, veri, test

### G11 — `deploy/` yığını — *devam ediyor (`tasima/docker`)*
- **Dosyalar:** `deploy/compose.yml`, `deploy/postgres/init/01-roller.sh`, `deploy/postgres/postgresql.conf`, `deploy/caddy/beautyos.caddy`
- **Kabul kriterleri:**
  - K1: Servisler, ağlar, takma adlar ve bellek sınırları plan §1–§2 ile birebir. Hiçbir serviste `ports:` yok. Postgres ve Redis `sirket-proxy`'de değil.
  - K2: `api` ve `api-staging` için `TZ=UTC`, tek kopya. Her serviste healthcheck, `restart: unless-stopped`, `no-new-privileges`, `cap_drop`.
  - K3: `01-roller.sh` dört rol ve iki veritabanı oluşturur. Yetkiler `ALTER DEFAULT PRIVILEGES` ile verilir. Doğrulama:
    - `app_user` ve `stg_user` için `rolsuper` ve `rolbypassrls` `false`; `CREATE TABLE` yetki hatası verir.
    - **`app_user` `beautyos_staging`'e, `stg_user` `beautyos`'a bağlanamaz** (iki ayrı negatif deneme).
  - K4: `migrate`/`migrate-staging` `profiles: [migrate]` altında. Sahip rolünün URL'si yalnız kendi env dosyasından gelir. `api` ortamında `MIGRATION_DATABASE_URL` adı geçmez.
  - K5: Redis `noeviction`, `appendonly`, parolalı. Staging `REDIS_URL`'i DB 1'i gösterir.
  - K6: `beautyos.caddy` plan §1 ile aynı: `/debug*` 404, `header_up X-Forwarded-For {client_ip}`, basic auth yalnız `yeni` hostunda.
  - K7: Staging `.env.staging` ile açılır. Log'da "SMS provider: Mock" görünür. `JWT_SECRET`'i canlıdan farklıdır (kurucu teyidi). Staging token'ıyla canlı API'ye istek atılınca 401 döner.

### G12 — Veri aktarım ve doğrulama betikleri
- **Dosyalar:** `deploy/betikler/veri-aktar.sh`, `deploy/betikler/veri-dogrula.sh`
- **Kabul kriterleri:**
  - K1: `set -euo pipefail`; `bash -n` ve `shellcheck` temiz; LF satır sonu. `pipefail` + `grep -q` tuzağından kaçınır (sunucu-altyapi CLAUDE.md).
  - K2: Kaynak bağlantısı yalnız `docker run --env-file /srv/beautyos/.env.supabase` ile gelir. Betikte, argümanlarda ve çıktıda bağlantı bilgisi yok; `set -x` yok.
  - K3: Alt komutlar `on-kontrol`, `dok`, `yukle <hedef>`, ayrıca `veri-dogrula.sh [--bos-mu]`. `<hedef>` canlı yığın ya da G13'teki geçici konteyner olabilir. Bilinmeyen alt komut kullanım mesajıyla 2 kodunda çıkar.
  - K4: `on-kontrol` şu durumlarda sıfır dışı kodla durur: kaynak > 17; `public`'te RLS ya da politika var; `auth.`/`storage.`/`extensions.` bağımlılığı var. Her durum yerel sahte bir kaynakla, yalnız tek koşul bozularak denenir.
  - K5: `yukle` hedef boş değilse durur. `SCHEMA public` girdisi listeden çıkarılır. `--single-transaction --exit-on-error --no-owner --role=<sahip>` ile yükler, ardından `ANALYZE` çalıştırır.
  - K6: `veri-dogrula.sh` satır sayısını ve 4 tablonun kimlik özetini karşılaştırır; fark varsa tabloyu adlandırarak sıfır dışı kodla çıkar. `prisma migrate status` ve rol kontrolü de yapar.
  - K7: Dökümler `/srv/beautyos/tasima/` (700) altında 600 izinle. Çıktıda satır içeriği yok.
  - K8: Örnek veriyle doldurulmuş yerel bir "kaynak" `postgres:17`'den uçtan uca aktarım yeşil.

### G13 — Veri betiğinin ön denemesi — kurucu + devops
- **Ön koşul:** G12 denetçi ONAY'lı. `.env.supabase` kurucu tarafından yazıldı.
- **Kabul kriterleri:**
  - K1: Kurucu `on-kontrol` ve `dok` çalıştırır. D1, D7 ve D8 sonuçları mimara bildirilir.
  - K2: `yukle`, **geçici, ağsız** bir `postgres:17` konteynerine (rolleri `01-roller.sh` ile kurulmuş) yapılır. Canlı `beautyos` veritabanına dokunulmaz.
  - K3: `veri-dogrula.sh` geçici hedefte yeşil.
  - K4: Deneme bitince geçici konteyner, volume'u ve döküm dosyası silinir (`ls /srv/beautyos/tasima` yalnız sayım dosyalarını gösterir).
  - K5: Sorun çıkarsa (sürüm, RLS, bağlantı) müdüre ve mimara bildirilir; geçiş planlanmaz.

### G14 — Kabul test planı + staging'de kabul testi — test-muhendisi
- **Çıktı:** `raporlar/test/beautyos-tasima-1.md`. Ortam `https://yeni.beautyossapp.com` (canlıyla aynı API imajı; web staging varyantı).
- **Kabul kriterleri (planda en az bunlar):**
  - K1: Kayıt (yeni kiracı), giriş, `refreshToken` çereziyle sessiz yenileme, çıkış. Yanlış şifrede tek tip mesaj.
  - K2: Kiracı izolasyonu: A'nın token'ıyla B'nin slug'ı → 403. B'nin müşteri ID'si A bağlamında → 404. Önce kaydın B'de var olduğu doğrulanır.
  - K3: Panelden randevu oluşturma, takvim, müşteri kartı, anamnez kaydı.
  - K4: Herkese açık randevu (`/book/<slug>`) Turnstile ile geçer (D6).
  - K5: CORS: `yeni` kaynağı kabul edilir, `https://evil-beautyossapp.com` CORS başlığı almaz.
  - K6: `/debug` 404, `/health` 200. Doğrudan IP'ye istek uygulamayı sunmaz. `yeni` basic auth ister, `yeni-api` istemez.
  - K7: Gerçek IP (D5): iki ayrı ağdan giriş denemesi yapılır. Log'da iki farklı IP görülür, Cloudflare IP'si görülmez. Bir IP'nin hız sınırı diğerini etkilemez.
  - K8: Dayanıklılık: `docker compose restart api-staging` → 60 sn içinde healthy. `down` ve `up` (volume silmeden) sonrası veri yerinde.
  - K9: Telegram test botu staging'e bağlı ise bota mesaj atılır ve yanıt gelir (S4).
  - Sonuç `[TEST GEÇTİ]` ya da `[TEST KALDI]`.

## Aşama 4 — Geçiş

### G15 — Geçiş — kurucu + devops
- **Ön koşul:** plan §10 listesi tamam. Müdür runbook için tek `[ONAY]` alır.
- **Kabul kriterleri:**
  - K1: Railway/Vercel Git otomatik dağıtımı kapalı ve Railway API'leri durmuş (kurucu ekran teyidi).
  - K2: `veri-dogrula.sh` canlı `beautyos` üzerinde yeşil.
  - K3: Canlı `.env`'de `NETGSM_*`, `TELEGRAM_*` ve (S7'ye göre) `SENTRY_DSN` boş (kurucu teyidi). Log'da "SMS provider: Mock".
  - K4: Üç canlı host ve `api` Cloudflare üzerinden 200 ve geçerli sertifikayla yanıt verir.
  - K5: `sirket/sunucu.md`'de "Çalışan servisler" satırı (hostlar, port yok, yedek yöntemi) ve işlem günlüğünde geri alma adımı (plan §10) yazılı.
  - K6: Yazma kesintisi ≤ 60 dk; aşılırsa müdüre bildirilir.

### G16 — Canlı duman testi + 48 saat — test-muhendisi + devops
- **Çıktı:** `raporlar/test/beautyos-tasima-2.md`
- K1: Canlıda giriş, takvim, randevu, herkese açık randevu ve şifre sıfırlama e-postası çalışır. Supabase'ten gelen 3 kiracının verisi arayüzde görünür (değerler rapora yazılmaz).
- K2: İlk gece no-show işi 23:30 TR'de ve yedek işi 03:30'da çalıştı.
- K3: 48 saatte kalıcı bellek > %85 yok, yeniden başlama döngüsü yok.

## Aşama 5 — Kapatma

### G17 — Eski servislerin kapatılması (geçiş + 3 gün, kurucu onayıyla)
- K1: Supabase son dökümü restic'te `arsiv` etiketiyle duruyor; silinme tarihi (≤ 30 gün) `sirket/sunucu.md`'de yazılı.
- K2: Railway, Vercel, Upstash ve Supabase (prod + staging) silindi. Her silme için `sirket/` altında imha tutanağı var.
- K3: GitHub `DATABASE_URL` sırrı silindi. S5'e göre anahtarlar yenilendi.
- K4: `.env.supabase` ve `tasima/` silindi.

## Aşama 6 — Sonrası

### G18 — Temizlik ve yükseltmeler (her alt madde ayrı görev numarasıyla)
- a) Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` silinir; README ve `apps/api/.env.example` güncellenir.
- b) Node 22/24 LTS (yeni ADR).
- c) Next.js güncel sürüm.
- d) `Sentry.setupExpressErrorHandler` sırası; `tsconfig.tsbuildinfo` depodan çıkarılır.
- e) `master` → `main` (kurucu kararı).
- **İlk gerçek müşteriden önce** (KVKK değerlendirmesi §6.2):
  - RLS projesi (T-B1).
  - Müşteri silme/anonimleştirme uç noktası ve gece imha işi.
  - Staging'in canlı Postgres'inden ayrılması değerlendirilir (ADR-0016).
