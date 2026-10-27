# BeautyOS Taşıma — Görev Listesi

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Sürüm:** 4 (2026-10-28: veri taşınmıyor; G12/G13 şema uyum kontrolüne dönüştü, geçiş DNS'e indi)
- **Bağlı belgeler:** `docs/tasima-plani.md` (plan), `docs/kararlar.md` (kararlar), `docs/mevcut-durum.md` (bulgular), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum)
- **Durum değerleri:** `bekliyor` | `devam ediyor` | `incelemede` | `tamamlandı` | `iptal`. Bu dosya mimarındır. Görev sahibi durum değişikliğini mesajla bildirir, mimar işler.
- **Kod görevleri** `kod-standartlari`'na göre test önce yazılır. `[İNCELEME HAZIR]` mesajında kabul kriteri → test adı eşlemesi verilir (ör. `G4b-K3: rejects origin evil-beautyossapp.com`). Denetçi ONAY'ı olmadan hiçbir görev "tamamlandı" sayılmaz.
- `[ONAY]` = kurucu onayı (müdür toplar).

## Dallar ve dosya sahipliği

| Dal / yer | Sahibi | Dosyalar |
|---|---|---|
| `tasima/sunucu` (bu dal) | mimar | `docs/*` (`kvkk-tasima-degerlendirmesi.md` hariç: hukuk-uyum), `CLAUDE.md`, kök `.env.example`, `.gitignore` |
| `tasima/docker` (ayrı worktree, master'dan) | gelistirici | `apps/*/Dockerfile`, `.dockerignore`, `.gitattributes`, `apps/web/next.config.mjs`, `deploy/**` (`deploy/.env.example` dahil; adlar kök `.env.example`'a mimar tarafından da yansıtılır), `apps/api/src/**`, `apps/web/src/**`, `.github/workflows/**` |
| hotfix dalı (`gorev/4a-debug-kapat`, master'dan) | gelistirici | `apps/api/src/index.ts` (yalnız `/debug` bloğu) + testi |
| `projeler/sunucu-altyapi` | devops | Caddy, yedek, izleme; `sirket/sunucu.md` kayıtları |
| `raporlar/test/beautyos-tasima-*.md` | test-muhendisi | Test planı ve raporları |

**Kurallar:**
- Taşıma dalları geçiş adım 1'den (Git otomatik dağıtımı kapatma) önce `master`'a ya da `staging`'e birleştirilmez.
- Tek istisna G4a hotfix'idir. Bilerek `master` üzerinden Railway'e çıkar; push'u müdür kurucu onayıyla yapar. Hotfix birleşince `tasima/docker` dalı `master`'dan güncellenir.
- Kök `.env.example` yalnız bu dalda düzenlenir. gelistirici yeni bir değişken adı eklerse adını ve açıklamasını mimara bildirir.
- Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` G18'e kadar değiştirilmez (geri dönüş yolu).
  - **Kayıtlı istisna:** `e68459f` (dal `duzeltme/debug-uc-noktasi`, denetçi ONAY'ı `raporlar/denetim/beautyos-debug-2.md`). Kök Dockerfile'da tek satır değişti: `FROM node:20.20.2-bookworm-slim`.
  - Neden zorunluydu: `node:20-bullseye-slim`'in apt deposu kapandığı için Railway derlemesi 404 / exit 100 ile düşüyor, `/debug` hotfix'i dağıtılamıyordu.
  - Bu commit yalnız `master` tarafında. `tasima/docker` dalında kök Dockerfile eski haliyle duruyor. Birleştirmede kök Dockerfile'da `master`'daki satır alınır. G18'de dosya zaten silineceği için çakışma önemsiz.

## Özet tablo

| No | Görev | Sahibi | Bağımlı | Durum |
|---|---|---|---|---|
| G1 | CI testleri geçici Postgres 17'de | gelistirici | — | bekliyor |
| G2 | API imajı | gelistirici | — | devam ediyor (`tasima/docker`) |
| G3 | Web imajı (standalone) + zorunlu API adresi | gelistirici | — | devam ediyor (Dockerfile + standalone); API adresi kısmı bekliyor |
| G4a | `/debug` uç noktasını canlıda kapat | gelistirici | Supabase'in açılması | **push edildi (`9894212`), Railway dağıtımı başarısız; `/debug` açık.** Derleme hatası (bullseye apt) `e68459f` ile giderildi (denetçi ONAY'lı). Dağıtımın sağlıklı açılması için Supabase'in de açık olması gerekiyor (plan §12) |
| G4b | Tek CORS modülü | gelistirici | — | bekliyor |
| G5 | Açılış kontrolü, düzgün kapanış, log ve Sentry temizliği | gelistirici | — | bekliyor |
| G6 | Hatırlatmaları yeniden kuyruğa alma betiği | — | — | **iptal** (SMS kapalı; kurucu yanıtı 3) |
| G7 | Sunucuda derleme (`derle.sh`) + imaj temizliği + CI derleme kontrolü (ADR-0018) | gelistirici | G2, G3; deploy key (kurucu) | bekliyor (`c82bab8` GHCR iş akışı yeniden tanımlandı) |
| G8 | Ortak Caddy | devops | — | devam ediyor |
| G9 | Yedekleme + geri yükleme denemesi | devops | G11 | devam ediyor |
| G10 | İzleme ve uyarılar | devops | G8 | devam ediyor |
| G11 | `deploy/` yığını (canlı + kalıcı staging), roller, Caddy parçası | gelistirici | G2, G3, G8 | incelemede (`tasima/docker` 62d9ca7; ilk inceleme RED, düzeltildi) |
| G12 | Şema uyum kontrolü betiği (`sema-karsilastir.sh`) | gelistirici | G11 | devam ediyor (eski kapsam `d3d6df0`'da yazıldı, sadeleştirilecek) |
| G13 | Canlı yığını boş DB ile kurma + şema karşılaştırmasını çalıştırma (+ gerekirse düzeltici migration) | kurucu + devops + gelistirici | G12 | bekliyor |
| G14 | Kabul test planı + staging'de kabul testi | test-muhendisi | G11 (plan hemen başlayabilir) | bekliyor |
| G15 | Geçiş (Railway durdurma + DNS) | kurucu + devops | G1–G5, G7–G14 | bekliyor |
| G16 | Canlı duman testi + 48 saat gözlem | test-muhendisi + devops | G15 | bekliyor |
| G17 | Eski servislerin kapatılması ve imha tutanakları | kurucu + devops | G16 (Supabase için G13) | bekliyor |
| G18 | Taşıma sonrası temizlik ve yükseltmeler | gelistirici | G17 | bekliyor |
| G19 | Redis'te ortam ayrımı: ACL kullanıcıları + BullMQ öneki | gelistirici + devops | G11 | bekliyor (ilk gerçek müşteriden önce) |

---

## Aşama 0–1 — Uygulama (gelistirici)

### G1 — CI testleri geçici Postgres 17'de
- **Dosyalar:** `.github/workflows/ci.yml`
- **Kabul kriterleri:**
  - K1: `test` işinde `postgres:17.x` servis konteyneri var. `secrets.DATABASE_URL` hiçbir adımda geçmez.
  - K2: Testlerden önce `prisma migrate deploy` 19 migration'ın tamamını uygular.
  - K3: Test takımı PG 17'de yeşil. Kalan test bulgu olarak raporlanır; testi silmek ya da atlamak yok.
  - K4: `quality` işi sır olmadan çalışır (`prisma generate` sahte URL ile).
  - K6 (depo içi şema uyumu, plan §5 adım 4): `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <servis konteyneri> --exit-code` CI adımı olarak çalışır ve boş döner. Fark varsa adım kırmızıdır; düzeltme G13'teki düzeltici migration kuralıyla yapılır.
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

### G7 — Sunucuda derleme ve imaj temizliği (ADR-0018; GHCR yolu D4 kararıyla bırakıldı)
- **Dosyalar:**
  - `deploy/betikler/derle.sh`
  - `deploy/betikler/imaj-temizle.sh`
  - `deploy/derleme.conf` (gizli olmayan web derleme değerleri)
  - `.github/workflows/imaj.yml` (`c82bab8`, derleme kontrolüne dönüşür)
  - `deploy/README.md` ya da `deploy/` altında kurulum notu (deploy key adımları)
- **Kabul kriterleri:**
  - K1 (girdi): `derle.sh` yalnız onaltılık commit kimliği kabul eder (≥ 12 hane). Dal adı, etiket ya da `HEAD` → kullanım hatası, çıkış 2. Her durum ayrı negatif deneme.
  - K2 (kaynak): `/srv/beautyos/kaynak`'ta `git fetch origin`, ardından `git cat-file -e <sha>^{commit}`, ardından `git checkout --detach <sha>`. Çalışma ağacı temiz değilse durur. Bulunamayan commit → anlaşılır hata, sıfır dışı çıkış. Bağlantı deploy key takma adıyla yapılır; betikte anahtar yolu yazmaz.
  - K3 (etiket): Üretilen imajlar `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod` ve `beautyos-web:<sha12>-staging`. Hepsi `org.opencontainers.image.revision=<tam sha>` etiketi taşır. `latest` yok.
  - K4 (yük, D14): Derlemeler sırayla çalışır; `flock` ile aynı anda tek derleme. Web aşamasında `NODE_OPTIONS=--max-old-space-size=1536`. Bellek ve CPU sınırlı buildx builder (`--driver-opt memory=…`) denenir. Ölçüm raporu her imaj için tepe bellek, süre ve swap kullanımını verir; derleme boyunca canlı `/health` 200 kalır. Sonuç mimara iletilir, ADR-0018'e işlenir. Sınırlı builder çalışmazsa gerekçesiyle bildirilir.
  - K5 (değerler): `NEXT_PUBLIC_*` yalnız `deploy/derleme.conf`'tan gelir. Betik `.env*` okumaz, `set -x` kullanmaz.
  - K6 (temizlik): `imaj-temizle.sh` her imaj adı için son 3 sürümü tutar. Şunları **asla silmez**: herhangi bir konteynerin (çalışan ya da durmuş) kullandığı imajı, `.env`'deki `BEAUTYOS_VERSION`/`BEAUTYOS_STAGING_VERSION` imajlarını. Testler:
    - 5 sahte etiketle 3'ü kalır.
    - Kullanımdaki en eski etiket silinmez.
    - `--dry-run` hiçbir şey silmez.

    Silinen etiketler log'a yazılır. Kuralın kurucu onayı müdür üzerinden alınmadan betik otomatik çağrılmaz.
  - K7 (CI): `imaj.yml` GHCR'a itmez (`push: false`), yetkisi yalnız `contents: read`, giriş adımı yok. PR ve `workflow_dispatch`'te iki Dockerfile'ın derlendiğini doğrular. `packages: write` kaldırılır.
  - K8 (belge): Deploy key kurulum adımları yazılı: anahtarı kurucu üretir; "Allow write access" işaretsiz; `~/.ssh/config` takma adı `IdentitiesOnly yes` ile. `ssh -T` ile yalnız okuma erişimi doğrulanır.
  - K9: `bash -n` ve `shellcheck` temiz, LF satır sonu; `pipefail` tuzağına dikkat (sunucu-altyapi CLAUDE.md).

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
- K4: `yedek-geri-yukle.sh dene beautyos` başarılı: geçici, ağsız konteyner. Tablo listesi, `_prisma_migrations` kayıtları ve (varsa) satır sayıları eşleşir. Canlı DB boşken de denenir; amaç zincirin ilk gerçek veriden önce çalıştığını görmek. Deneme bitince konteyner ve volume silinir. Sonuç `deneme-gunlugu.txt` ve `sirket/sunucu.md`'ye yazılır.

### G10 — İzleme — *devam ediyor*
- K1: Yoklamalar: `api/health` (anahtar kelime `"status":"ok"`), `app/login`, apex (son ikisi geçişte açılır). Uyarılar Telegram'a.
- K2: Yedek kalp atışı izlemesi (G9-K3).
- K3: DO uyarıları: CPU %80, bellek %85, disk %85. Bir test uyarısı Telegram'a ulaştı.

## Aşama 3 — Yığın, staging, veri, test

### G11 — `deploy/` yığını — *devam ediyor (`tasima/docker`)*
- **Dosyalar:** `deploy/compose.yml`, `deploy/postgres/init/01-roller.sh`, `deploy/postgres/postgresql.conf`, `deploy/caddy/beautyos.caddy`
- **Kabul kriterleri:**
  - K1: Servisler, ağlar, takma adlar ve bellek sınırları plan §1–§2 ile birebir. Hiçbir serviste `ports:` yok. Postgres ve Redis `sirket-proxy`'de değil; `icsel` `internal: true`; web servisleri `icsel`'de değil.
  - K1b: `01-roller.sh` yalnız boş veri dizininde çalışır ve `POSTGRES_DB` `beautyos` değilse durur. Rol parolası sonradan değişirse elle `ALTER ROLE` yapılır (`[ONAY]`, işlem günlüğüne yazılır).
  - K2: `api` ve `api-staging` için `TZ=UTC`, tek kopya. Her serviste healthcheck, `restart: unless-stopped`, `no-new-privileges`, `cap_drop`.
  - K3: `01-roller.sh` dört rol ve iki veritabanı oluşturur. Yetkiler `ALTER DEFAULT PRIVILEGES` ile verilir. Doğrulama:
    - `app_user` ve `stg_user` için `rolsuper` ve `rolbypassrls` `false`; `CREATE TABLE` yetki hatası verir.
    - **`app_user` `beautyos_staging`'e, `stg_user` `beautyos`'a bağlanamaz** (iki ayrı negatif deneme).
  - K4: `migrate`/`migrate-staging` `profiles: [migrate]` altında. Sahip rolünün URL'si yalnız kendi env dosyasından gelir. `api` ortamında `MIGRATION_DATABASE_URL` adı geçmez.
  - K5: Redis `noeviction`, `appendonly`, parolalı. Staging `REDIS_URL`'i DB 1'i gösterir.
  - K6: `beautyos.caddy` plan §1 ile aynı: `/debug*` 404, `header_up X-Forwarded-For {client_ip}`, basic auth yalnız `yeni` hostunda. Kullanıcı adı ve hash Caddy ortam değişkenlerinden (`{$BEAUTYOS_STAGING_BASIC_USER}`, `{$BEAUTYOS_STAGING_BASIC_HASH}`) gelir. Değerleri kurucu `/srv/caddy/.env`'e yazar ve devops `caddy-dogrula.sh` ile denetler; depoda gerçek hash yok. İkinci emniyet olarak `route` içinde `basic_auth`'tan önce `@bos expression "{$BEAUTYOS_STAGING_BASIC_HASH}" == ""` → `respond @bos 503`. Hash boşken `yeni` 503 döner, şifresiz açılmaz (G14-K6'da denenir).
  - K8: Staging servisleri `${BEAUTYOS_STAGING_VERSION:?}` ile zorunlu ve ayrı sürüm etiketi kullanır. Değişken boşken `docker compose config` hata verir; canlı etikete düşmez.
  - K7: Staging `.env.staging` ile açılır. SMS'in kapalı olduğu açılış log'undan görünür. Not: "SMS provider: Mock" satırı bugün yalnız ilk SMS denemesinde yazılıyor (`lib/sms/index.ts` tembel başlatma); açılışta yazılması G5-K2'ye bağlı. G5 birleşmeden önce bu kriter kurucunun `.env.staging`'de `NETGSM_*` boş teyidiyle karşılanır. `JWT_SECRET`'i canlıdan farklıdır (kurucu teyidi). Staging token'ıyla canlı API'ye istek atılınca 401 döner.

### G12 — Şema uyum kontrolü betiği (ADR-0017, plan §5)
- **Dosyalar:** `deploy/betikler/sema-karsilastir.sh`. Önceki `veri-aktar.sh` ve `veri-dogrula.sh` (`d3d6df0`) **kaldırılır**; libpq env-file bağlantısı, RLS/politika/bağımlılık denetimi ve kapanış `trap`'i yeniden kullanılır. Veri döküm/yükleme kodu kalmaz.
- **Kabul kriterleri:**
  - K1: `set -euo pipefail`; `bash -n` ve `shellcheck` temiz; LF satır sonu. `pipefail` + `grep -q` tuzağından kaçınır (sunucu-altyapi CLAUDE.md).
  - K2: Alt komutlar `kaynak`, `hedef`, `karsilastir`. Bilinmeyen alt komut kullanım mesajı yazar ve 2 koduyla çıkar.
  - K3 (`kaynak`): Bağlantı yalnız `docker run --env-file /srv/beautyos/.env.supabase` ile gelir. Betikte, argümanlarda ve çıktıda bağlantı bilgisi yok; `set -x` yok. Üretilenler:
    - `sema-kaynak.sql`: `pg_dump --schema-only --schema=public --no-owner --no-privileges --no-publications --no-subscriptions`.
    - `migrations-kaynak.txt`: `_prisma_migrations` tablosundan yalnız ad, checksum, bitti/geri alındı bilgisi.
    - `kaynak-bilgi.txt`: sunucu sürümü, `pg_extension` listesi, `public`'te RLS'i açık tablolar ve politikalar, `auth.`/`storage.`/`extensions.` bağımlılıkları.
  - K4: **Hiçbir uygulama tablosundan satır okunmaz.** Test: betik metninde `pg_dump` yalnız `--schema-only` ile geçer; `SELECT` sorguları yalnız `_prisma_migrations` ve katalog tablolarını (`pg_*`, `information_schema`) hedefler.
  - K5 (`hedef`): Geçici `postgres:17` ve yalnız iç ağlı (`--internal`) geçici bir Docker ağında api imajıyla `prisma migrate deploy` çalışır. Parola betikte rastgele üretilir. Aynı `pg_dump` bayraklarıyla `sema-hedef.sql` ve `migrations-hedef.txt` üretilir. Konteyner, volume ve ağ `trap` ile her durumda silinir. Gizli bilgi gerekmez.
  - K6 (`karsilastir`): İki döküm normalleştirilir: yorumlar, `SET`, `set_config`, `\restrict`/`\unrestrict`, boş satırlar ve kaynak ana sürüm farkından gelen satırlar (ör. PG 15 kaynakta olmayan varsayılan ifadeler) atılır. `diff -u` → `sema-fark.txt`. Migration listeleri ad + checksum ile karşılaştırılır. Fark yoksa çıkış 0, varsa 1. Normalleştirme kuralları betikte yorumla gerekçelendirilir.
  - K7: Negatif denemeler, her biri tek farkı içerir; her biri fark olarak raporlanmalı:
    - (a) kaynakta fazladan bir indeks,
    - (b) kaynakta eksik bir sütun,
    - (c) kaynakta fazladan bir migration kaydı,
    - (d) aynı ad farklı checksum.

    Olumlu deneme: migration'larla kurulmuş sahte bir kaynak (PG 15 ve PG 17 sürümlerinde) → fark 0.
  - K8: Çıktılar `/srv/beautyos/tasima/` (700) altında 600 izinli. Kişisel veri içermez; ekip okuyabilir.

### G13 — Canlı yığını boş DB ile kurma + şema karşılaştırması — kurucu + devops + gelistirici
- **Ön koşul:** G11 ve G12 denetçi ONAY'lı. Canlı Supabase projesi açık ve tespit edildi (müdür). `.env.supabase` kurucu tarafından yazıldı.
- **Kabul kriterleri:**
  - K1: Canlı `beautyos` veritabanı boş kurulur: `01-roller.sh` + `docker compose --profile migrate run --rm migrate` `[ONAY]`. `prisma migrate status` "up to date". `app_user` için `rolsuper`/`rolbypassrls` `false`.
  - K2: `api` ve `web` (canlı) ayağa kalkar. `https://api.beautyossapp.com/health` Cloudflare üzerinden 200 döner. `@`/`app`/`www` DNS'i henüz değişmez.
  - K3: Kurucu `sema-karsilastir.sh kaynak` çalıştırır. devops ya da gelistirici `hedef` ve `karsilastir` adımlarını çalıştırır. `sema-fark.txt` ve `kaynak-bilgi.txt` mimara bildirilir (D1, D7, D8, D13).
  - K4: Fark varsa plan §5 karar tablosu uygulanır.
    - Gerekiyorsa gelistirici **düzeltici migration** yazar: yeni klasör, mevcut migration'lar değiştirilmez. Test önce: `karsilastir` kırmızı → migration → yeşil.
    - Düzeltici migration denetçi ONAY'ından sonra canlı ve staging'e `migrate` ile uygulanır `[ONAY]`.
    - `karsilastir` yeniden 0 döner. Bilinçli olarak taşınmayan farklar mimarın kaydıyla `docs/mevcut-durum.md`'de durur.
  - K5: Supabase açılamazsa K3 atlanır, bu durum müdüre bildirilir. Yalnız G1-K6 (depo içi uyum) yeşil olmalıdır; risk planda kayıtlı.
  - K6: İş bitince `.env.supabase` silinmek üzere G17'ye bırakılır; `tasima/` yalnız şema dosyalarını içerir.

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

### G15 — Geçiş (Railway durdurma + DNS) — kurucu + devops
- **Ön koşul:** plan §10 listesi tamam (G13 dahil: canlı yığın healthy). Müdür runbook için tek `[ONAY]` alır.
- **Kabul kriterleri:**
  - K1: Railway/Vercel Git otomatik dağıtımı kapalı ve Railway API'leri durmuş (kurucu ekran teyidi).
  - K2: Canlı `.env`'de `NETGSM_*`, `TELEGRAM_*` ve (S7'ye göre) `SENTRY_DSN` boş (kurucu teyidi).
  - K3: `@`, `app`, `www` ve `api` Cloudflare üzerinden 200 ve geçerli sertifikayla yanıt verir.
  - K4: İlk süper yönetici `POST /api/v1/admin/seed` ile oluşturuldu. Ardından `ADMIN_SEED_SECRET` boşaltıldı ve `api` yeniden oluşturuldu. Aynı istek artık 403 döner (test mühendisi doğrular).
  - K5: `sirket/sunucu.md`'de "Çalışan servisler" satırı (hostlar, port yok, yedek yöntemi) ve işlem günlüğünde geri alma adımı (yalnız DNS, plan §10) yazılı.

### G16 — Canlı duman testi + 48 saat — test-muhendisi + devops
- **Çıktı:** `raporlar/test/beautyos-tasima-2.md`
- K1: Canlıda (boş veritabanı): yeni kiracı kaydı, giriş, takvim, randevu, herkese açık randevu (Turnstile) ve şifre sıfırlama e-postası çalışır. Test kiracısının slug'ı `tst-`/`test-` önekli olur ve test sonunda kurucu onayıyla silinir.
- K2: İlk gece no-show işi 23:30 TR'de ve yedek işi 03:30'da çalıştı.
- K3: 48 saatte kalıcı bellek > %85 yok, yeniden başlama döngüsü yok.

## Aşama 5 — Kapatma

### G17 — Eski servislerin kapatılması ve imha tutanakları (kurucu onayıyla)
- **Sıra:** Supabase projeleri G13 (şema karşılaştırması) bitince silinebilir. Railway, Vercel ve Upstash G16 geçince silinir; DNS geri dönüşü için Vercel o zamana kadar durur. Taşıma arşivi **yok** (veri taşınmadı).
- K1: Supabase `beautyos-dev` ve `beautyos-staging` projeleri silindi. Silinmeden önce, panelin kendi otomatik yedeklerinin de projeyle birlikte gittiği tutanağa yazıldı.
- K2: Railway (prod + staging), Vercel ve Upstash projeleri silindi.
- K3: **Her silme için `sirket/` altında imha tutanağı var** (demo veri de olsa, KVKK): tarih, hizmet/proje adı, bölge (Supabase eu-west-1), veri türü ("demo/deneme"), yöntem, onaylayan kurucu. İçerik yazılmaz.
- K4: GitHub `DATABASE_URL` sırrı silindi. S5'e göre anahtarlar yenilendi.
- K5: `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silindi.

## Aşama 6 — Sonrası

### G18 — Temizlik ve yükseltmeler (her alt madde ayrı görev numarasıyla)
- a) Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` silinir; README ve `apps/api/.env.example` güncellenir.
- b) Node 22/24 LTS (yeni ADR).
- c) Next.js güncel sürüm.
- d) `Sentry.setupExpressErrorHandler` sırası; `tsconfig.tsbuildinfo` depodan çıkarılır.
- e) `master` → `main` (kurucu kararı).
### G19 — Redis'te ortam ayrımı (denetim bulgusu, `raporlar/denetim/beautyos-tasima-1.md`)
- **Dosyalar:** `apps/api/src/lib/queue.ts` (gelistirici), `deploy/compose.yml` + Redis ACL dosyası ya da başlatma betiği (gelistirici), `.env.redis` adları (mimar `.env.example`'a yazar)
- **Kabul kriterleri:**
  - K1: Redis'te `default` kullanıcı kapalı. Canlı ve staging için ayrı ACL kullanıcıları ve ayrı parolalar var. `REDIS_URL` kullanıcı adı içerir.
  - K2: BullMQ kuyrukları ortam önekiyle açılır (ör. `prefix: 'bull:prod'` / `'bull:stg'`). Önek ortam değişkeninden gelir; tek kod yolu.
  - K3: Staging kullanıcısı yalnız kendi önekindeki anahtarlara erişir. Staging kimliğiyle canlı önekine `GET`/`KEYS`/`FLUSHDB` → yetki hatası (negatif test, her biri tek kuralı bozar). Tehlikeli komutlar (`FLUSHALL`, `CONFIG`, `KEYS`) staging kullanıcısında kapalı.
  - K4: Canlı kullanıcının kendi kuyruğunda iş ekleme ve işleme testi yeşil (mutlu yol).
  - K5: ACL parolaları yalnız `.env.redis`/`.env`/`.env.staging`'de; depoda yok.

- **İlk gerçek müşteriden önce** (KVKK değerlendirmesi §6.2):
  - RLS projesi (T-B1).
  - Müşteri silme/anonimleştirme uç noktası ve gece imha işi.
  - Staging'in canlı Postgres'inden ayrılması değerlendirilir (ADR-0016).
