# BeautyOS Taşıma — Görev Listesi

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Plan:** `docs/tasima-plani.md` · **Kararlar:** `docs/kararlar.md` · **Bulgular:** `docs/mevcut-durum.md`
- Durum: `bekliyor` | `devam ediyor` | `incelemede` | `tamamlandı`. Sahibi durumu kendisi günceller (bu dosya mimarındır; durum değişikliğini sahibi mesajla bildirir, mimar işler).
- Kod görevleri `kod-standartlari`'na göre test önce yazılır. `[İNCELEME HAZIR]` mesajında kabul kriteri → test adı listesi verilir (ör. `G4-K2: rejects origin evil-beautyossapp.com`). Denetçi ONAY'ı olmadan hiçbir görev "tamamlandı" sayılmaz.
- `[ONAY]` = kurucu onayı (müdür toplar).

## Dallar ve dosya sahipliği

| Dal | Sahibi | Dosyalar |
|---|---|---|
| `tasima/sunucu` (bu dal) | mimar | `docs/*`, `CLAUDE.md`, `.env.example` (kök), `.gitignore` |
| `tasima/docker` (ayrı worktree, master'dan) | gelistirici | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`, `apps/web/next.config.mjs`, `deploy/**` (compose, postgres init, Caddy site parçası, betikler), `apps/api/src/**`, `apps/api/scripts/**`, `apps/web/src/**`, `.github/workflows/**` |
| `projeler/sunucu-altyapi` (`main`) | devops | `caddy/**`, yedekleme ve izleme betikleri, `sirket/sunucu.md` kayıtları |
| `raporlar/test/beautyos-tasima-*.md` | test-muhendisi | test planı ve raporları |

**Kurallar:**
- İki dal sonradan birleştirilir: önce `tasima/sunucu` → `tasima/docker`. **Hiçbir taşıma dalı Aşama 4 adım 0'dan önce `master`'a ya da `staging`'e birleştirilmez ve push edilmez** (R1).
- Taşıma dallarının GitHub'a push'u (imaj derlemesi için) `[ONAY]`; Vercel bu dallar için yalnız preview derler.
- Kök `Dockerfile`, `railway.json`, `nixpacks.toml` ve `apps/web/vercel.json` G18'e kadar **değiştirilmez** (geri dönüş yolu).

## Özet tablo

| No | Görev | Sahibi | Bağımlı | Durum |
|---|---|---|---|---|
| G1 | CI testleri geçici Postgres 17'de | gelistirici | — | bekliyor |
| G2 | API imajı (`apps/api/Dockerfile`) | gelistirici | — | devam ediyor (`tasima/docker`) |
| G3 | Web imajı (standalone) + API adresinin zorunlu yapılması | gelistirici | — | devam ediyor (Dockerfile + standalone); API adresi kısmı bekliyor |
| G4 | `/debug` kaldırma + tek CORS modülü | gelistirici | — | bekliyor |
| G5 | Açılışta ortam kontrolü, SIGTERM ile düzgün kapanış, log'dan telefonun çıkarılması | gelistirici | — | bekliyor |
| G6 | Hatırlatmaları yeniden kuyruğa alma betiği | gelistirici | — | bekliyor |
| G7 | İmaj derleme iş akışı (GHCR) | gelistirici | G2, G3 | bekliyor |
| G8 | Ortak Caddy (Cloudflare DNS-01 + gerçek IP) | devops | — | devam ediyor |
| G9 | Yedekleme (pg_dump + restic → B2) + geri yükleme denemesi | devops | G11 (beautyos postgres ayakta) | devam ediyor |
| G10 | Dış izleme ve uyarılar | devops | G8 | devam ediyor |
| G11 | `deploy/` compose yığını + Postgres rolleri + Caddy site parçası + sunucuda kapalı test ortamı | gelistirici | G2, G3, G8 | devam ediyor (`tasima/docker`) |
| G12 | Veri aktarım ve doğrulama betikleri | gelistirici | G11 | bekliyor |
| G13 | Kuru prova (güvenli kip, gerçek veri kopyası) | devops + kurucu | G4–G7, G9–G12 | bekliyor |
| G14 | Kabul test planı ve prova testi | test-muhendisi | G13 (plan yazımı hemen başlayabilir) | bekliyor |
| G15 | Geçiş günü | devops + kurucu | G14 TEST GEÇTİ | bekliyor |
| G16 | Canlı duman testi + 48 saat gözlem | test-muhendisi + devops | G15 | bekliyor |
| G17 | Eski servislerin kapatılması (+14 gün) | kurucu + devops | G16 | bekliyor |
| G18 | Taşıma sonrası temizlik ve yükseltmeler | gelistirici | G17 | bekliyor |

---

## Aşama 1 — Uygulama hazırlığı (gelistirici)

### G1 — CI testleri geçici Postgres 17'de
- **Dosyalar:** `.github/workflows/ci.yml`
- **Amaç:** Testler dış veritabanına (`secrets.DATABASE_URL`) bağlanmasın. Prisma 5.22 + PG 17 uyumu kanıtlansın (D2).
- **Kabul kriterleri:**
  - K1: `test` işinde `postgres:17.x-alpine` servis konteyneri var. `DATABASE_URL`/`DIRECT_URL` bu konteyneri gösterir; `secrets.DATABASE_URL` hiçbir adımda geçmez.
  - K2: Testlerden önce `npx prisma migrate deploy` çalışır ve 19 migration'ın tamamı uygulanır.
  - K3: Mevcut test takımı PG 17'de yeşil. Kalan test varsa ayrı bulgu olarak raporlanır, testi silmek ya da atlamak yok.
  - K4: `quality` işinde `prisma generate` sahte bir URL ile çalışır, sır gerekmez.
  - K5: Sonuç `docs/kararlar.md` doğrulama kaydı D2'ye mimar tarafından işlenmek üzere mesajla bildirilir.

### G2 — API imajı — *devam ediyor*
- **Dosyalar:** `apps/api/Dockerfile`, `.dockerignore`
- **Kabul kriterleri:**
  - K1: Çok aşamalı. Taban `node:20.x-bookworm-slim` (sabit küçük sürüm). Bağımlılık kurulumu kök `package-lock.json` ile `npm ci` (workspace `apps/api`). Son imajda dev bağımlılıkları, test ve kaynak `.ts` yok.
  - K2: `prisma generate`, çalışma imajıyla aynı tabanlı aşamada çalışır. Konteyner açılışında Prisma motoru hatası yok.
  - K3: `USER node` (root değil). `docker run --rm <imaj> id -u` → 0 değil.
  - K4: `.dockerignore` şunları dışlar: `.git`, `**/.env*` (`!**/.env.example` hariç), `**/node_modules`, `docs`, `**/__tests__`, `*.md`. İmajda `.env` dosyası yok (`find / -name ".env*"` boş).
  - K5: `HEALTHCHECK` Node `fetch` ile `http://127.0.0.1:3001/health`'i yoklar (imajda curl/wget beklenmez).
  - K6: `ENV TZ=UTC`, `NODE_ENV=production`. `CMD ["node","dist/index.js"]`.
  - K7: D3 doğrulaması: `DIRECT_URL` yokken açılış davranışı denenir, sonuç mesajla bildirilir.
  - K8: Kök `Dockerfile`'a dokunulmaz.

### G3 — Web imajı ve zorunlu API adresi — *Dockerfile kısmı devam ediyor*
- **Dosyalar:** `apps/web/Dockerfile`, `apps/web/next.config.mjs`, `apps/web/src/lib/config.ts` (yeni), `apps/web/src/lib/api.ts`, `apps/web/src/lib/admin-api.ts`, `apps/web/src/app/admin/login/page.tsx`, `apps/web/src/app/book/[slug]/page.tsx`
- **Kabul kriterleri:**
  - K1: `next.config.mjs`: `output: 'standalone'` (+ monorepo için `outputFileTracingRoot`). Başka davranış değişikliği yok.
  - K2: Çok aşamalı imaj; çalışma aşaması `node server.js`, `USER node`, port 3000, `HOSTNAME=0.0.0.0`. `HEALTHCHECK` `/`'u yoklar.
  - K3: Derleme argümanları `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_BOT_FEATURES_ENABLED`. Gizli değer argüman olarak geçmez.
  - K4: `https://beautyosapi-production.up.railway.app` sabiti kaynakta hiçbir yerde kalmaz; API adresi tek modülden (`config.ts`) okunur.
  - K5: `NEXT_PUBLIC_API_URL` tanımsızken üretim derlemesi anlaşılır bir hatayla durur (test: derleme betiği ya da birim testi; K5 adıyla).
  - K6: `read_only` kök dosya sistemiyle çalışır (`/tmp` ve `.next/cache` tmpfs).

### G4 — `/debug` kaldırma ve tek CORS modülü
- **Dosyalar:** `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/lib/cors.ts` (yeni), `apps/api/src/__tests__/cors.test.ts` (yeni)
- **Kabul kriterleri:**
  - K1: `GET /debug` 404 döner; Gemini çağrısı ve ortam bilgisi döndüren kod silinir.
  - K2: `index.ts` ile `app.ts` aynı `isOriginAllowed` fonksiyonunu kullanır. Kaynak `ALLOWED_ORIGINS` (virgüllü tam eşleşme) + `beautyossapp.com` ve `*.beautyossapp.com` + geliştirmede localhost. `CORS_ORIGIN` adı da geriye uyum için okunur ve `.env.example`'da "eski ad" olarak işaretlenir.
  - K3: Negatif testler, her biri tek kuralı bozar: `https://evil-beautyossapp.com` (sonek hilesi), `https://beautyossapp.com.evil.com`, `http://app.beautyossapp.com` (üretimde http). Hepsi reddedilir; reddin nedeni CORS başlığının yokluğuyla doğrulanır.
  - K4: Olumlu testler: `https://app.beautyossapp.com`, `https://beautyossapp.com`, `https://APP.beautyossapp.com` (büyük harf, Türk I'sı dahil; `URL` hostname'i küçültür; `toLocaleLowerCase` kullanılmaz).
  - K5: `beauty-os*.vercel.app` deseni kaldırılır.

### G5 — Açılış kontrolü, düzgün kapanış, log temizliği
- **Dosyalar:** `apps/api/src/index.ts`, `apps/api/src/lib/env.ts` (yeni), `apps/api/src/lib/queue.ts`, ilgili testler
- **Kabul kriterleri:**
  - K1: Üretimde zorunlu değişkenler eksikse API anlaşılır mesajla durur (değer yazmadan, yalnız ad): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (≥ 32), `ALLOWED_ORIGINS`, `PUBLIC_URL`, `FRONTEND_URL`.
  - K2: Güvenli kip desteklenir: `TELEGRAM_BOT_TOKEN`, `NETGSM_*`, `RESEND_API_KEY` boşken API açılır ve log'a tek satır "… kapalı" uyarısı yazar.
  - K3: `SIGTERM`/`SIGINT` geldiğinde sırasıyla HTTP sunucusu yeni bağlantı almayı keser, BullMQ işçisi `close()` ile mevcut işi bitirir, Redis ve Prisma bağlantıları kapanır. Süreç 10 sn içinde 0 koduyla çıkar (test: işçi kapatma fonksiyonu birim testi).
  - K4: Log'larda telefon numarası yok (`queue.ts`'teki "Telefon normalize edilemedi" uyarısı yalnız `appointmentId` yazar). Kod tabanında `logger.*({ … phone` araması boş döner.

### G6 — Hatırlatmaları yeniden kuyruğa alma betiği
- **Dosyalar:** `apps/api/scripts/requeue-reminders.ts`, `apps/api/src/__tests__/requeue-reminders.test.ts`, `apps/api/package.json` (betik komutu)
- **Kabul kriterleri:**
  - K1: Durumu `pending`, `confirmed` ya da `in_progress` olan, silinmemiş (soft delete alanına göre) ve başlangıcı gelecekte olan randevular için gecikmesi > 0 olan `reminder_24h` ve `reminder_2h` işlerini ekler. jobId'ler `reminder-24h-<id>` ve `reminder-2h-<id>` (rotalarla birebir aynı).
  - K2: İdempotent: iki kez çalıştırılınca kuyruktaki iş sayısı değişmez (test).
  - K3: İptal edilmiş randevu, geçmiş randevu ve gecikmesi geçmiş 24 saat hatırlatması atlanır; her biri ayrı negatif test.
  - K4: `--dry-run` hiçbir iş eklemez, yalnız sayıları yazar. Çıktıda müşteri adı ya da telefon yok; yalnız sayılar ve `tenantId` başına sayılar.
  - K5: Compose'daki `requeue` servisiyle çalışır: `docker compose --profile araclar run --rm requeue [--dry-run]`.

### G7 — İmaj derleme iş akışı
- **Dosyalar:** `.github/workflows/imaj.yml`
- **Kabul kriterleri:**
  - K1: Tetik `workflow_dispatch` (girdi: ref) ve `v*` etiketi. `master`/`staging` push'unda **çalışmaz**.
  - K2: `permissions: contents: read, packages: write`; başka izin yok. Sunucuya SSH ya da dağıtım adımı yok.
  - K3: `ghcr.io/ahmeetkarateke/beautyos-api:<sha-12>` ve `…/beautyos-web:<sha-12>` itilir (+ etiket varsa sürüm etiketi). `latest` kullanılmaz.
  - K4: Web derleme argümanları `vars.NEXT_PUBLIC_API_URL`, `vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `vars.NEXT_PUBLIC_BOT_FEATURES_ENABLED` değişkenlerinden gelir; `secrets.*` kullanılmaz.
  - K5: D4 (GHCR kota/ücret) sonucu mesajla bildirilir.

## Aşama 2 — Altyapı (devops, sunucu-altyapi)

### G8 — Ortak Caddy — *devam ediyor*
- **Dosyalar:** `projeler/sunucu-altyapi/caddy/**` (+ o deponun `docs/kararlar.md`'sine ADR)
- **Kabul kriterleri:**
  - K1: Özel imaj sabit sürümlerle derlenir: Caddy 2.x + `caddy-dns/cloudflare`. `caddy list-modules` modülü gösterir.
  - K2: `0.0.0.0` üzerinde yalnız 22/80/443 dinler (`sudo ss -tlnp`). Ortak ağ `sirket-proxy`. Postgres/Redis bu ağda değil.
  - K3: Genel ayarlar: `trusted_proxies static` (Cloudflare listesi, aylık `11-caddy.sh --ip-kontrol`), `client_ip_headers CF-Connecting-IP`, `import /srv/caddy/siteler/*.caddy`. `caddy validate` geçer.
  - K4: `CLOUDFLARE_API_TOKEN` yalnız `/srv/caddy/.env`'den gelir. Token kurucu tarafından yalnız `Zone:DNS:Edit` + `Zone:Zone:Read` ve yalnız `beautyossapp.com` kapsamıyla oluşturulur (kurucu teyit eder).
  - K5: DNS kaydı henüz Vercel'i gösterirken `api.beautyossapp.com` için sertifika DNS-01 ile alınır (log kanıtı).
  - K6: Caddy sertifika ve veri dizini adlandırılmış volume'da; yeniden başlatmada sertifika yeniden istenmez.

### G9 — Yedekleme — *devam ediyor*
- **Kabul kriterleri:**
  - K1: Her gece 03:30 TR: `pg_dump -Fc -U app_owner beautyos` (+ rol dökümü) → restic → B2 AB bölgesi. `projeler.conf`'taki BeautyOS satırının konteyner adı gelistirici'nin `deploy/compose.yml`'ıyla teyit edilir. Ara dosya diske şifresiz yazılmaz ya da 600 izinle yazılıp hemen silinir.
  - K2: Saklama `--keep-daily 7 --keep-weekly 4 --keep-monthly 6` (hukuk-uyum teyidine kadar VARSAYIM). `restic check` haftada bir.
  - K3: İş başarısızsa Telegram/heartbeat uyarısı gelir. Bilerek bozulmuş bir çalıştırmayla denenir.
  - K4: **Geri yükleme denemesi** (`yedek-geri-yukle.sh dene beautyos`, sonuç `deneme-gunlugu.txt`): son snapshot geçici, ağsız bir `postgres:17` konteynerine açılır; `veri-dogrula.sh` satır sayıları canlıyla eşleşir. Tarih ve sonuç `sirket/sunucu.md` "Çalışan servisler" satırına yazılır.
  - K5: restic parolası ve B2 anahtarları yalnız `.env.yedek` dosyasında; kurucu parolayı parola yöneticisinde de saklar (teyit).
  - K6: Yurt dışı depolama için hukuk-uyum onayı alındı (müdür üzerinden).

### G10 — İzleme — *devam ediyor*
- **Kabul kriterleri:**
  - K1: UptimeRobot monitörleri: `https://api.beautyossapp.com/health` (anahtar kelime `"status":"ok"`), `https://app.beautyossapp.com/login`, `https://beautyossapp.com/`. Aralık ≤ 5 dk. Uyarı Telegram + e-posta. Geçişten önce yalnız `api` aktif, diğerleri geçiş günü açılır.
  - K2: Yedek işi kalp atışı monitörü (G9-K3).
  - K3: DO uyarı politikaları: CPU > %80 / 10 dk, bellek > %85 / 10 dk, disk > %80.
  - K4: Bir test uyarısı Telegram'a ulaştı (ekran görüntüsü ya da kurucu teyidi).

## Aşama 3 — Yığın, veri betikleri, prova

### G11 — `deploy/` compose yığını — *devam ediyor (`tasima/docker`)*
- **Dosyalar:** `deploy/compose.yml`, `deploy/postgres/init/01-roller.sh`, `deploy/postgres/postgresql.conf`, `deploy/caddy/beautyos.caddy`. Kök `.env.example` mimarındır; gelistirici yeni bir değişken adı eklerse adı ve açıklamasını mimara bildirir (iki dalda aynı dosya düzenlenmez)
- **Kabul kriterleri:**
  - K1: Servisler ve özellikler `docs/tasima-plani.md` §1 tablosuyla birebir. `api` ve `web` dışında hiçbir servis `sirket-proxy` ağında değil. **Hiçbir serviste `ports:` yok** (ADR-0004 sunucu-altyapi).
  - K2: Her serviste healthcheck, `restart: unless-stopped`, bellek/cpu sınırı (§2), `no-new-privileges`, `cap_drop`. `api` için `TZ=UTC` ve tek kopya.
  - K3: `01-roller.sh` `app_owner` ve `app_user` rollerini parolalarıyla (`.env.db`'den) oluşturur. `beautyos` veritabanının sahibi `app_owner`. `ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public` ile tablolarda DML, dizilerde `USAGE, SELECT` yetkisi `app_user`'a verilir. Kontrol: `app_user` ile `SELECT rolsuper, rolbypassrls …` → `false,false`; `CREATE TABLE` → yetki hatası.
  - K4: `migrate` servisi `profiles: [migrate]`, yalnız `.env.migrate` yükler, `MIGRATION_DATABASE_URL`'i yalnız kendi komutunda `DATABASE_URL`/`DIRECT_URL`'e aktarır. `docker compose config` çıktısında `api` servisinin ortamında `MIGRATION_DATABASE_URL` geçmez (çıktı paylaşılmaz, yalnız ad aranır).
  - K5: Redis: `appendonly yes`, `maxmemory 128mb`, `maxmemory-policy noeviction`, parola zorunlu. `redis-cli CONFIG GET maxmemory-policy` → `noeviction`.
  - K6: `beautyos.caddy`: plan §1 taslağı; `/debug*` 404, `header_up X-Forwarded-For {client_ip}`.
  - K7: Sunucudaki kapalı test ortamı **güvenli kipte** (tasima-plani §11): Telegram, NetGSM, Resend, WhatsApp ve Gemini anahtarları boş. Kanıt: API log'unda "webhook kaydedilmedi" ve "SMS provider: Mock" satırları.

### G12 — Veri aktarım ve doğrulama betikleri
- **Dosyalar:** `deploy/betikler/veri-aktar.sh`, `deploy/betikler/veri-dogrula.sh`, `deploy/betikler/ortak.sh` (gerekirse)
- **Davranış:** `docs/tasima-plani.md` §5. Kurucu çalıştırır; devops yalnız `veri-dogrula.sh`'yi çalıştırabilir.
- **Kabul kriterleri:**
  - K1: `set -euo pipefail`; `bash -n` ve `shellcheck` temiz. LF satır sonu. sunucu-altyapi CLAUDE.md'deki `pipefail` + `grep -q` tuzağından kaçınır.
  - K2: Kaynak bağlantısı yalnız `docker run --env-file /srv/beautyos/.env.supabase` ile libpq değişkenlerinden (`PGHOST` …) gelir. Betik metninde, komut satırı argümanlarında ve çıktıda bağlantı bilgisi ya da parola geçmez. `set -x` yok.
  - K3: Alt komutlar `on-kontrol`, `dok`, `yukle`, `ters` (geri dönüş için yeni→Supabase; yalnız açık onay bayrağıyla) ve `veri-dogrula.sh` (`--bos-mu` dahil). Bilinmeyen alt komut → kullanım mesajı + çıkış 2.
  - K4: `on-kontrol` şu durumlarda **sıfır dışı kodla durur** ve nedenini yazar: kaynak ana sürümü > 17; `public`'te RLS'si açık tablo ya da politika; sütun varsayılanında, fonksiyonda ya da view'da `auth.`/`storage.`/`extensions.` bağımlılığı. Her durum için sahte kaynakla (yerel `postgres:17` + elle kurulan nesne) bir deneme yapılır. Her deneme yalnız tek koşulu bozar.
  - K5: `yukle`, hedef `public`'te tablo varsa yazmadan durur. `SCHEMA public` ve `COMMENT ON SCHEMA public` girdileri liste dosyasından çıkarılır. `--single-transaction --exit-on-error --no-owner --role=app_owner` ile yükler, ardından `ANALYZE` çalıştırır.
  - K6: `veri-dogrula.sh` tablo başına satır sayısını ve `tenants`/`users`/`customers`/`appointments` kimlik özetini kaynak dosyasıyla karşılaştırır. Fark varsa tabloyu adlandırıp sıfır dışı kodla çıkar. Ayrıca `prisma migrate status` "up to date" ve `app_user` süper/bypass değil kontrollerini yapar.
  - K7: Döküm dosyaları `/srv/beautyos/tasima/` (700) altında, 600 izinli. Çıktıda satır içeriği (ad, telefon) yok.
  - K8: Yerel uçtan uca deneme: örnek veriyle doldurulmuş bir `postgres:17` "kaynak" konteynerinden hedef yığına aktarım geçer ve doğrulama yeşil olur. Test mühendisi G14'te tekrarlar.

### G13 — Kuru prova — devops + kurucu
- **Ön koşul:** G4–G7, G9–G12 denetçi ONAY'lı. Hukuk-uyum görüşü alındı. `[ONAY]`: `api` + `yeni` DNS kayıtları, prova veritabanına veri yükleme, `migrate`.
- **Adımlar:** `docs/tasima-plani.md` §11.
- **Kabul kriterleri:**
  - K1: Güvenli kip kanıtı: `.env`'de Telegram/NetGSM/Resend/WhatsApp/Gemini boş (kurucu teyit eder). Log'da "Mock" ve "webhook kaydedilmedi" satırları var. `getWebhookInfo` hâlâ Railway adresini gösteriyor (kurucu kontrol eder).
  - K2: `veri-aktar.sh on-kontrol | dok | yukle` hatasız. D1, D7, D8 sonuçları mimara bildirilir.
  - K3: `veri-dogrula.sh` yeşil.
  - K4: `https://yeni.beautyossapp.com` ve `https://api.beautyossapp.com/health` Cloudflare üzerinden 200 döner, sertifika geçerli (Full strict).
  - K5: `requeue --dry-run` sayıları makul (gelecek randevu × 2'yi aşmaz), gerçek çalıştırma Mock'la yapılır.
  - K6: Ters kopya (`ters`) provanın sonunda **Supabase'e değil**, geçici bir `postgres:17` konteynerine karşı bir kez denenir.
  - K7: Prova sonunda sıfırlama `[ONAY]`: veritabanı yeniden oluşturulur, Redis volume'u yenilenir; `veri-dogrula.sh --bos-mu` yeşil.
  - K8: Toplam süre ve sorunlar `sirket/sunucu.md` işlem günlüğüne yazılır.

### G14 — Kabul test planı ve prova testi — test-muhendisi
- **Çıktı:** `raporlar/test/beautyos-tasima-1.md` (plan + sonuç). Plan yazımı hemen başlayabilir; yürütme G13 K1–K5 sonrası.
- **Kabul kriterleri (test planında en az bu vakalar):**
  - K1: Veri eşliği: `veri-dogrula.sh` çıktısı rapora eklenir. Ayrıca 3 rastgele kiracıda müşteri sayısı ve son 5 randevu web arayüzünde görülür (değerler rapora yazılmaz, yalnız "eşleşti").
  - K2: Kimlik: kayıt (yeni kiracı), giriş, 15 dk sonrası `refreshToken` çerezi ile sessiz yenileme (ya da test için kısa süreli token), çıkış. Yanlış şifrede tek tip mesaj.
  - K3: Kiracı izolasyonu: A kiracısının token'ıyla B'nin slug'ına istek → 403. B'nin müşteri ID'siyle A bağlamında okuma → 404. Önce B'de kaydın var olduğu doğrulanır.
  - K4: Randevu: panelden oluşturma → Redis'te `reminder-24h-<id>`/`reminder-2h-<id>` işleri var. Mock SMS kaydı oluşmuyor, çünkü gecikme dolmadı (yalnız iş varlığı kontrol edilir).
  - K5: Herkese açık randevu (`/book/<slug>`), Turnstile ile geçer (D6).
  - K6: CORS: `https://yeni.beautyossapp.com`'dan istek kabul edilir; `https://evil-beautyossapp.com` Origin'li istek CORS başlığı almaz.
  - K7: Gerçek IP (D5): iki farklı ağdan (ör. mobil + ev) giriş denemesi; API log'unda iki farklı IP görülür, Cloudflare IP'si görülmez. Giriş hız sınırı bir IP'de dolunca diğer IP etkilenmez.
  - K8: `/debug` → 404; `/health` → 200; doğrudan IP'ye (`https://209.38.237.171`) istek uygulamayı sunmaz.
  - K9: Dayanıklılık: `docker compose restart api` → 60 sn içinde healthy; sunucu yeniden başlatma simülasyonu (`docker compose down && up -d`, volume silmeden) sonrası veri yerinde.
  - K10: Güvenli kip: test süresince gerçek SMS, e-posta ya da Telegram mesajı gitmedi (kurucu teyidi).
  - Sonuç `[TEST GEÇTİ]` ya da `[TEST KALDI]` (CLAUDE.md protokolü).

## Aşama 4 — Geçiş

### G15 — Geçiş günü — devops + kurucu
- **Ön koşul:** G14 TEST GEÇTİ. Plan §12'deki ön koşul listesinin tamamı ✔. Müdür kurucudan runbook için tek seferde `[ONAY]` alır.
- **Adımlar:** `docs/tasima-plani.md` §12 (0–10).
- **Kabul kriterleri:**
  - K1: Adım 0: Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımı kapalı (kurucu ekran teyidi).
  - K2: Adım 1 sonrası Railway prod `/health` yanıt vermiyor; yazma durdu.
  - K3: `veri-dogrula.sh` yeşil (son kopya).
  - K4: API log'unda Telegram webhook adresi `https://api.beautyossapp.com/webhook/telegram`; "SMS provider: Netgsm".
  - K5: `requeue` sonrası iş sayısı `--dry-run` çıktısıyla aynı.
  - K6: Üç host Cloudflare üzerinden 200 ve geçerli sertifika döner.
  - K7: `sirket/sunucu.md`: "Çalışan servisler"e BeautyOS satırı (alan adları, port yok, yedek yöntemi ve sıklığı) ve işlem günlüğüne geçiş kaydı (geri alma: plan §13).
  - K8: Toplam yazma kesintisi ≤ 60 dk, aksi halde müdüre bildirilir.

### G16 — Canlı duman testi + 48 saat gözlem — test-muhendisi + devops
- **Çıktı:** `raporlar/test/beautyos-tasima-2.md`
- **Kabul kriterleri:**
  - K1: Canlıda: giriş, takvim, randevu oluşturma, herkese açık randevu, kurucunun kendi numarasına test SMS'i, bota mesaj ve yanıt, şifre sıfırlama e-postası. Hepsi geçti.
  - K2: İlk gece no-show işi 23:30 TR'de çalıştı (log). Yedek işi 03:30'da çalıştı.
  - K3: 48 saatte kalıcı bellek > %85 yok, yeniden başlama döngüsü yok, 5xx oranı ihmal edilebilir.
  - K4: Sorun varsa geri dönüş ölçütü (plan §13) müdüre raporlanır.

## Aşama 5 — Kapatma

### G17 — Eski servislerin kapatılması (+14 gün) — kurucu + devops
- **Her madde ayrı `[ONAY]`; adımlar plan §14.**
- **Kabul kriterleri:**
  - K1: Supabase prod son dökümü restic'te "arsiv" etiketiyle var ve `restic snapshots` listesinde görünüyor; saklama süresi `docs/kvkk.md`'de.
  - K2: Railway, Vercel, Upstash ve Supabase (prod + staging) BeautyOS projeleri silindi. Hesaplarda başka proje varsa dokunulmadı (S4).
  - K3: GitHub `DATABASE_URL` sırrı silindi. Dış servis anahtarları yenilendi ve yeni değerler `.env`'de (S10).
  - K4: `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silindi; `yeni` DNS kaydı silindi.
  - K5: `sirket/sunucu.md` ve `sirket/` abonelik/finans kayıtları güncellendi (müdür).

## Aşama 6 — Sonrası

### G18 — Temizlik ve yükseltmeler — gelistirici (her alt madde ayrı oturum ve ayrı görev numarasıyla açılır)
- a) Kök `Dockerfile`, `railway.json`, `nixpacks.toml`, `apps/web/vercel.json` silinir; README ortamlar ve dağıtım bölümü yeni düzene göre yazılır; `apps/api/.env.example` kök `.env.example`'a yönlendirilir.
- b) Node 22/24 LTS yükseltmesi (ADR-0014'ün yerine yeni ADR).
- c) Next.js 14 → güncel destekli sürüm.
- d) `Sentry.setupExpressErrorHandler` rotalardan sonra; `apps/web/tsconfig.tsbuildinfo` depodan çıkarılır.
- e) `master` → `main` dal adı (şirket standardı), Git entegrasyonları kalktıktan sonra; kurucu kararı.
- **T-B1 (ayrı proje):** RLS ile ikinci kat kiracı izolasyonu (`coklu-kiraci-veritabani`). Mimar önce ADR ve tasarım yazar.
