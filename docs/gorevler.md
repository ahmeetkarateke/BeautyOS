# BeautyOS Taşıma — Görev Listesi

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Sürüm:** 4 (2026-10-28: veri taşınmıyor; G12/G13 şema uyum kontrolüne dönüştü, geçiş DNS'e indi)
- **Bağlı belgeler:** `docs/tasima-plani.md` (plan), `docs/kararlar.md` (kararlar), `docs/mevcut-durum.md` (bulgular), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum)
- **Durum değerleri:** `bekliyor` | `devam ediyor` | `incelemede` | `tamamlandı` | `iptal`. Bu dosya mimarındır. Görev sahibi durum değişikliğini mesajla bildirir, mimar işler.
- **Kod görevleri** `kod-standartlari`'na göre test önce yazılır. `[İNCELEME HAZIR]` mesajında kabul kriteri → test adı eşlemesi verilir (ör. `G4b-K3: rejects origin evil-beautyossapp.com`). Denetçi ONAY'ı olmadan hiçbir görev "tamamlandı" sayılmaz.
- `[ONAY]` = kurucu onayı (müdür toplar).
- **Kalıcı izin (kurucu, 2026-10-28; şirket `CLAUDE.md` "Kalıcı izinler"):** Bu listedeki denetçi ONAY'lı teknik adımları (kurulum, derleme, migrate, Caddy, sertifika, sunucu temizliği) müdür kurucuya sormadan yapar ya da yaptırır. Kurucuya hâlâ sorulanlar:
  - DNS değişiklikleri.
  - Eski servislerin kapatılması/silinmesi.
  - Taşıma dallarının `master`'a birleştirilmesi.
  - Gerçek veri silme ve para gerektiren işler.

  Ekip üyesi bu izne dayanarak kendisi push ya da silme yapmaz; müdürden ister. Ayrıntı: plan §9.

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
| G4a | `/debug` uç noktasını canlıda kapat | gelistirici | Supabase'in açılması | **push edildi (`9894212`), Railway dağıtımı başarısız; `/debug` açık.** Derleme hatası (bullseye apt) `e68459f` ile giderildi (denetçi ONAY'lı). **tamamlandı (10-28):** `e68459f` push edildi, Railway "watch paths" yüzünden SKIPPED saydı, kurucu elle Redeploy yaptı. `api.beautyossapp.com/debug` 404, `/health` `db: ok` |
| G4b | Tek CORS modülü | gelistirici | — | bekliyor |
| G5 | Açılış kontrolü, düzgün kapanış, log ve Sentry temizliği | gelistirici | — | bekliyor |
| G6 | Hatırlatmaları yeniden kuyruğa alma betiği | — | — | **iptal** (SMS kapalı; kurucu yanıtı 3) |
| G7 | Sunucuda derleme (`derle.sh`, kaynak `git archive` paketinden) + imaj/kaynak temizliği + CI derleme kontrolü (ADR-0018, ADR-0019) | gelistirici | G2, G3 | incelemede (`tasima/docker` `5c3d8b3`; D14 ve D15 olumlu; paketleme `git -c core.autocrlf=false archive`, D16) |
| G8 | Ortak Caddy | devops | — | devam ediyor |
| G9 | Yedekleme + geri yükleme denemesi | devops | G11 | devam ediyor |
| G10 | İzleme ve uyarılar | devops | G8 | devam ediyor |
| G11 | `deploy/` yığını (canlı + kalıcı staging), roller, Caddy parçası | gelistirici | G2, G3, G8 | incelemede (`tasima/docker` 62d9ca7; ilk inceleme RED, düzeltildi) |
| G12 | Şema uyum kontrolü betiği (`sema-karsilastir.sh`) | gelistirici | G11 | **ONAY** (`e3b89f2`, `raporlar/denetim/beautyos-tasima-4.md`). Denetçi önerileri sonraki turda (yeniden incelemeye girer): bağlantı hatasında psql iletisinin ilk satırının gösterilmesi. `verify-full` önerisi mimar kararıyla reddedildi (`require` yeterli, plan §5.1) |
| G13 | Canlı yığını boş DB ile kurma + şema karşılaştırmasını çalıştırma (+ gerekirse düzeltici migration) | kurucu + devops + gelistirici | G12 | **K3 tamam (10-28)**, K4 kararı verildi: düzeltici migration yok; iki migration kurucu kararıyla terk edildi (K7 iptal). K8 (LF) incelemede (`5c3d8b3`; renormalize sonrası diff boş). `sema-karsilastir.sh`'deki `COLLATE "C"` düzeltmesi aynı turda; ONAY sonrası sunucudaki betik onaylı paketten güncellenir. K1/K2 (canlı yığın) bekliyor |
| G14 | Kabul test planı + staging'de kabul testi | test-muhendisi | G11 (plan hemen başlayabilir) | **TEST GEÇTİ** |
| G15a | DNS çevirme betiği (`dns-cevir.sh`) + ortam kontrolü (ADR-0020, sunucu-altyapi) | devops (müdür atadı) | G8 | atandı (10-28) |
| G15 | Geçiş (DNS; müdür yürütür, kurucunun koşullu onayı) | müdür (devops yürütür) | plan §10.1: G13 + denetçi son sunucu ONAY'ı, G14 TEST GEÇTİ, G15 doğrulamaları; G15a | **tamamlandı: DNS 04:47'de çevrildi (gri)** |
| G16 | Canlı duman testi + 48 saat gözlem | test-muhendisi + devops | G15 | **TEST GEÇTİ** |
| G17 | Eski servislerin kapatılması ve imha tutanakları | kurucu + devops | G16 (Supabase için G13) | **K0 tamam** (Railway/Vercel GitHub bağlantısı kesildi; `master` push yasağı kalktı). Kalanlar birkaç gün sonra kurucuya sorulacak; eski DNS artıkları (K6) dahil |
| G18 | Taşıma sonrası temizlik ve yükseltmeler | gelistirici | G17 | bekliyor |
| G19 | Redis'te ortam ayrımı: ACL kullanıcıları + BullMQ öneki | gelistirici + devops | G11 | bekliyor (ilk gerçek müşteriden önce) |
| G20 | Cloudflare turuncu buluta geçiş (ADR-0008, ADR-0021) | kurucu (panel) + devops | G16 | bekliyor (ilk gerçek müşteriden önce; DNS değişikliği, kurucuya sorulur) |

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

### G7 — Sunucuda derleme ve imaj temizliği (ADR-0018 + ADR-0019; GHCR yolu D4 kararıyla bırakıldı, deploy key ADR-0019 ile kalktı)
- **Dosyalar:**
  - `deploy/betikler/derle.sh`
  - `deploy/betikler/imaj-temizle.sh`
  - `deploy/derleme.conf` (gizli olmayan web derleme değerleri)
  - `.github/workflows/imaj.yml` (`c82bab8`, derleme kontrolüne dönüşür)
  - `deploy/README.md` ya da `deploy/` altında kurulum notu (müdürün paketleme ve aktarım adımları)
- **Kabul kriterleri:**
  - K1 (girdi): `derle.sh` yalnız **40 haneli** onaltılık commit kimliği kabul eder. Dal adı, etiket, `HEAD`, kısa kimlik ya da büyük harf/boşluk içeren kimlik → kullanım hatası, çıkış 2. Her durum ayrı negatif deneme. Karşılaştırma `LC_ALL=C` ile yapılır.
  - K2 (kaynak, ADR-0019): Kaynak `/srv/beautyos/kaynak/<sha12>/` dizinidir, GitHub'a erişilmez. Betik `git fetch`/`clone` içermez. Sırasıyla:
    - (a) `kaynak.tar`, `commit.txt` ve `kaynak.tar.sha256` dosyaları var.
    - (b) `sha256sum -c` geçer.
    - (c) `git get-tar-commit-id < kaynak.tar` = `commit.txt` = argüman.
    - (d) `agac/` yoksa ya da boşsa paket oraya açılır; doluysa durur, üzerine yazmaz.

    Negatif denemeler, her biri tek kuralı bozar: değiştirilmiş tar (özet tutmaz), başka commit'in tar'ı (kimlik tutmaz), `commit.txt` farklı, `commit.txt` eksik, dolu `agac/`. Her biri sıfır dışı çıkış verir ve hiçbir `docker build` çalışmaz.
  - K2b: Sunucuda `git` yoksa (D15) betik anlaşılır bir hatayla durur.
  - K3 (etiket): Üretilen imajlar `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod` ve `beautyos-web:<sha12>-staging`. Hepsi `org.opencontainers.image.revision=<tam sha>` etiketi taşır. `latest` yok.
  - K4 (yük, D14): Derlemeler sırayla çalışır; `flock` ile aynı anda tek derleme. Web aşamasında `NODE_OPTIONS=--max-old-space-size=1536`. Bellek ve CPU sınırlı buildx builder (`--driver-opt memory=…`) denenir. Ölçüm raporu her imaj için tepe bellek, süre ve swap kullanımını verir; derleme boyunca canlı `/health` 200 kalır. Sonuç mimara iletilir, ADR-0018'e işlenir. Sınırlı builder çalışmazsa gerekçesiyle bildirilir.
  - K5 (değerler): `NEXT_PUBLIC_*` yalnız `deploy/derleme.conf`'tan gelir. Betik `.env*` okumaz, `set -x` kullanmaz.
  - K6 (temizlik): `imaj-temizle.sh` her imaj adı için son 3 sürümü tutar. Şunları **asla silmez**: herhangi bir konteynerin (çalışan ya da durmuş) kullandığı imajı, `.env`'deki `BEAUTYOS_VERSION`/`BEAUTYOS_STAGING_VERSION` imajlarını. Testler:
    - 5 sahte etiketle 3'ü kalır.
    - Kullanımdaki en eski etiket silinmez.
    - `--dry-run` hiçbir şey silmez.

    Silinen etiketler log'a yazılır. Kuralın kurucu onayı müdür üzerinden alınmadan betik otomatik çağrılmaz.
  - K7 (CI): `imaj.yml` GHCR'a itmez (`push: false`), yetkisi yalnız `contents: read`, giriş adımı yok. PR ve `workflow_dispatch`'te iki Dockerfile'ın derlendiğini doğrular. `packages: write` kaldırılır.
  - K8 (belge): Müdürün aktarım adımları yazılı. Windows'ta `git archive --format=tar -o …`, ardından `certutil -hashfile … SHA256`, ardından `scp` (paket dosyası, boru hattı yok). Sunucuda dizin 700, dosyalar 600. `commit.txt` ve `.sha256` dosyalarının biçimi (`sha256sum -c` uyumlu) ve ONAY raporu yolunun `sirket/sunucu.md`'ye yazılması da belgede.
  - K10 (temizlik): `kaynak/<sha12>/` dizinleri imajlarla aynı kuralla tutulur: son 3 sürüm, ayrıca kullanımdaki ve `.env`'deki sürümler asla silinmez (K6 testleriyle aynı yapıda).
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
- **Ön koşul:** G11 ve G12 denetçi ONAY'lı (yalnız `kaynak` adımı için G12 beklenmez: plan §5.1 yedek komutu). Canlı Supabase projesi `beautyos-dev` (kesinleşti; **7 gün içinde yeniden duraklar**, kaynak dökümü öncelikli). `.env.supabase` kurucu tarafından yazıldı.
- **Kabul kriterleri:**
  - K1: Canlı `beautyos` veritabanı boş kurulur: `01-roller.sh` + `docker compose --profile migrate run --rm migrate` `[ONAY]`. `prisma migrate status` "up to date". `app_user` için `rolsuper`/`rolbypassrls` `false`.
  - K2: `api` ve `web` (canlı) ayağa kalkar. `api.beautyossapp.com` DNS'i geçişe kadar Railway'i gösterdiği için doğrulama doğrudan sunucuya yapılır: `curl --resolve api.beautyossapp.com:443:209.38.237.171 https://api.beautyossapp.com/health` → 200 ve geçerli sertifika; `app` için `/login` aynı yolla. `@`/`app`/`www`/`api` DNS'i henüz değişmez.
  - K3: Kurucu `sema-karsilastir.sh kaynak` çalıştırır. devops ya da gelistirici `hedef` ve `karsilastir` adımlarını çalıştırır. `sema-fark.txt` ve `kaynak-bilgi.txt` mimara bildirilir (D1, D7, D8, D13).
  - K4: Fark varsa plan §5 karar tablosu uygulanır.
    - Gerekiyorsa gelistirici **düzeltici migration** yazar: yeni klasör, mevcut migration'lar değiştirilmez. Test önce: `karsilastir` kırmızı → migration → yeşil.
    - Düzeltici migration denetçi ONAY'ından sonra canlı ve staging'e `migrate` ile uygulanır `[ONAY]`.
    - `karsilastir` yeniden 0 döner. Bilinçli olarak taşınmayan farklar mimarın kaydıyla `docs/mevcut-durum.md`'de durur.
  - K5: Supabase açılamazsa K3 atlanır, bu durum müdüre bildirilir. Yalnız G1-K6 (depo içi uyum) yeşil olmalıdır; risk planda kayıtlı.
  - K6: İş bitince `.env.supabase` silinmek üzere G17'ye bırakılır; `tasima/` yalnız şema dosyalarını içerir.
  - ~~K7~~ **İptal (10-28, kurucu kararı):** Depoda olmayan iki migration (`20260624000000_whatsapp_phone_number_id`, `20260624010000_subscription_billing`) terk edildi; push edilecek dal yok. Esas olan depodaki 19 migration. Bu özellikler (WhatsApp numara alanı, iyzico abonelik) ileride gelirse **yeni migration'larla** yazılır. iyzico geldiğinde hukuk-uyum değerlendirmesi gerekir. Eski adlar yeniden kullanılmaz.
  - K8: `.gitattributes`'a `apps/api/prisma/migrations/** text eol=lf` eklenir (gelistirici, `tasima/docker`). Windows'ta yapılan çıkışlar da LF olur, böylece checksum farkı (CRLF) bir daha oluşmaz. Mevcut dosyalarda içerik değişmez. `git add --renormalize` sonrası diff boş olmalı.

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

### G15a — DNS çevirme betiği + ortam kontrolü — devops (ADR-0020)
- **Atama (müdür, 2026-10-28):** devops. **Dosyalar** sunucu-altyapi'de: `betikler/dns-cevir.sh` ve BeautyOS ortam kontrolü (ör. `betikler/ortam-kontrol.sh`). O deponun `docs/kararlar.md`'sine ADR-0020'ye atıfla kısa bir kayıt düşülür. BeautyOS deposunda dosya yazılmaz.
- **Kabul kriterleri:**
  - K1: Token yalnız `docker run --env-file /srv/caddy/.env` ile konteynere girer. Komut satırı argümanlarında (`ps`), log'da ve çıktıda token yok. `curl` başlığı dosyadan ya da standart girdiden okunur; `set -x` yok.
  - K2: Ad listesi sabittir: `@`, `app`, `www`, `api`. Liste dışı ad → çıkış 2. MX/TXT'ye dokunulmaz. Aynı ada birden fazla kayıt varsa betik durur.
  - K3: `plan` yalnız okur ve `tasima/dns-oncesi.json` (tür, değer, proxy, TTL, kimlik) ile `tasima/zone-oncesi.txt` dosyalarını üretir. Gerçek zonda çalıştırılıp çıktısı denetçiye gösterilir.
  - K4: `uygula <ip>` her kaydı A yapar. **`proxied` değerini ve TTL'i `dns-oncesi.json`'daki gibi korur** (ADR-0021; bugün dört kayıt `proxied=false`). Proxy açma ya da kapama bu alt komutun işi değildir. Her kaydı geri okuyarak doğrular; tür değişimini (CNAME → A) ele alır. Sahte API testine (h) eklenir: gri kayıt `uygula` sonrası gri kalır. `geri-al`, `dns-oncesi.json`'a birebir döner ve geri okuyarak doğrular.
  - K4b (müdür kararı, sınama yöntemi): **Gerçek Cloudflare API'sinde yalnız `plan` çalışır.** `uygula`, `geri-al` ve `ttl-dusur` yerel bir HTTP taklidine (sahte Cloudflare API; taban adres ortam değişkeniyle verilir, varsayılanı gerçek API) karşı sınanır; deneme kaydı (`dnstest`) açılmaz. Taklit testleri:
    - (a) A → A değer değişimi.
    - (b) CNAME → A tür değişimi, oluşturmaya izin veren ve vermeyen iki API davranışıyla.
    - (c) Geri okumada farklı değer dönmesi → betik hata verir.
    - (d) `geri-al` sonrası durum `dns-oncesi.json`'la birebir.
    - (e) Aynı ada iki kayıt → durur.
    - (f) API 4xx/5xx → token ya da başlık yazmadan hata.
    - (g) Gri kayıtta `ttl-dusur` çalışır, turuncuda değişiklik yapmaz.

    Her negatif test tek kuralı bozar. Taklidin taban adresi yalnız test için değişir; canlı çalıştırmada adresin gerçek API olduğu çıktıda yazılır.
  - K5: `ttl-dusur` yalnız gri kayıtlarda çalışır.
  - K6 (ortam kontrolü): Değer yazdırmadan, yalnız var/yok bilgisini veren bir kontrol (plan §10.1 listesi). Çıktı yalnız değişken adı + `var`/`yok`. Beklenenden sapma varsa çıkış 1.
  - K7: `bash -n` ve `shellcheck` temiz; LF satır sonu; `pipefail` tuzağına dikkat.

### G15 — Geçiş — müdür yürütür (kurucunun koşullu onayı, plan §10)
- **Ön koşul:** plan §10.1 K-A, K-B ve K-C'nin üçü de ✔. Biri eksikse geçiş yapılmaz, kurucuya sorulur.
- **Kabul kriterleri:**
  - K1: `dns-cevir.sh plan` çıktısı (`dns-oncesi.json`, `zone-oncesi.txt`) geçişten önce alındı.
  - K2: Ortam kontrolü (G15a-K6) geçti: `NETGSM_*`, `TELEGRAM_*`, `ADMIN_SEED_SECRET`, `MIGRATION_DATABASE_URL` ve (G5-K5 yoksa) `SENTRY_DSN` canlı `api` ortamında **yok**.
  - K3: `uygula` sonrası `@`, `app`, `www` ve `api` Cloudflare üzerinden 200 ve geçerli sertifikayla yanıt verir. `api` yanıtının sunucudan geldiği Caddy/API log'undan doğrulanır.
  - K4: `sirket/sunucu.md`'de "Çalışan servisler" satırı ve işlem günlüğünde geçiş kaydı var: K-A/K-B/K-C kanıt yolları, `dns-oncesi.json`, geri alma komutu (`dns-cevir.sh geri-al`).
  - K5: Geçiş sonrası `master`'a push yasağı kayda geçti. Yasak, kurucu Railway/Vercel Git bağlantısını kesene kadar sürer (plan §10.3).
  - K6: Kurucuya rapor gitti; G17-K0 (Git bağlantısının kesilmesi, Railway'in durdurulması) ve plan §10.4 (ilk süper yönetici) kurucu işi olarak listelendi.
  - (Eski K4, ilk süper yönetici: geçişten ayrıldı, plan §10.4.)

### G16 — Canlı duman testi + 48 saat — test-muhendisi + devops
- **Çıktı:** `raporlar/test/beautyos-tasima-2.md`
- K1: Canlıda (boş veritabanı): yeni kiracı kaydı, giriş, takvim, randevu, herkese açık randevu (Turnstile) ve şifre sıfırlama e-postası çalışır. Test kiracısının slug'ı `tst-`/`test-` önekli olur ve test sonunda kurucu onayıyla silinir.
- K2: İlk gece no-show işi 23:30 TR'de ve yedek işi 03:30'da çalıştı.
- K3: 48 saatte kalıcı bellek > %85 yok, yeniden başlama döngüsü yok.

## Aşama 5 — Kapatma

### G17 — Eski servislerin kapatılması ve imha tutanakları (kurucu onayıyla)
- **Sıra:** Supabase projeleri G13 (şema karşılaştırması, 10-28'de tamamlandı) sonrası silinebilir. Her silme kurucu onayına bağlıdır; kalıcı izin eski servisleri kapsamaz. Railway, Vercel ve Upstash G16 geçince silinir; DNS geri dönüşü için Vercel o zamana kadar durur. Taşıma arşivi **yok** (veri taşınmadı).
- K0 (geçişten hemen sonra, kurucu paneli): Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımı kapatıldı, Railway servisleri durduruldu. Müdürün `master` push yasağı ancak bundan sonra kalkar. **Durum: GitHub bağlantısı kesildi, push yasağı kalktı.** Railway servislerinin durdurulması K2'ye bağlı.
- K6 (eski DNS artıkları): `test`, `api-test`, `_railway-verify` ve `_vercel` TXT kayıtları silindi.
  - Kurucuya sorulur; G17'nin geri kalanıyla birlikte yapılır.
  - Öncesinde zon dışa aktarımı alınır, imha tutanağına yazılır.
  - `dns-cevir.sh`'in sabit ad listesi bu adları kapsamaz; panelden ya da ayrı, denetlenmiş bir komutla yapılır.
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

### G20 — Cloudflare turuncu buluta geçiş (ADR-0008, ADR-0021) — kurucu + devops
- **Ön koşul:** G16 geçti. Kurucu onayı gerekir (DNS değişikliği; geçiş onayının dışında).
- **Kabul kriterleri:**
  - K1 (kurucu, panel): SSL/TLS modu **Full (strict)**, minimum TLS 1.2, Always Use HTTPS açık. Bot Fight Mode ve Under Attack kapalı. Ekran görüntüsüyle teyit.
  - K2 (kurucu, panel; hukuk-uyum şartları): `api` ve `yeni-api` için Cache Rule "Bypass cache". Web Analytics/RUM, Zaraz, Logpush ve Workers kapalı. Cloudflare hesabında 2FA.
  - K3 (devops): Proxy durumu yalnız ayrı, açık bir komutla değişir (ör. `dns-cevir.sh proxy-ac <ad>`; G15a'ya sonradan eklenir, denetçi inceler). Önce staging (`yeni`, `yeni-api`), sonra canlı hostlar. Her adımda `server: cloudflare`, 200 ve yönlendirme döngüsü olmadığı doğrulanır.
  - K4: Gerçek istemci IP'si (ADR-0010) turuncu bulutta da doğru: G14-K7 testi tekrarlanır.
  - K5: Geri alma: `proxy-kapat` ile griye dönüş denenmiş.

- **İlk gerçek müşteriden önce** (KVKK değerlendirmesi §6.2):
  - RLS projesi (T-B1).
  - Müşteri silme/anonimleştirme uç noktası ve gece imha işi.
  - Staging'in canlı Postgres'inden ayrılması değerlendirilir (ADR-0016).
