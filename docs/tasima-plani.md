# BeautyOS — Şirket Sunucusuna Taşıma Planı

- **Tarih:** 2026-10-27 · **Sürüm:** 4 (2026-10-28) · **Hazırlayan:** mimar
- **Sürüm 4'te değişen:** Kurucu, Supabase verisinin demo olduğunu ve önemli olanın yalnız tablolar olduğunu bildirdi. **Veri taşınmıyor.** Canlı veritabanı sunucuda boş kuruluyor. Veri aktarımı yerine şema uyum kontrolü yapılıyor (§5). Geçiş DNS değişikliğine, geri dönüş DNS'i geri almaya indi.
- **Kurucu kararı:** Her şey şirket sunucusunda (`sirket-sunucu-1`, DO FRA1, 209.38.237.171) çalışır. Eski Supabase, Railway, Vercel ve Upstash kapatılır.
- **Girdiler:** `docs/mevcut-durum.md` (bulgular R1–R14), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum). **Kararlar:** `docs/kararlar.md`. **Görevler:** `docs/gorevler.md`.
- **İşaretler:** `[ONAY]` = kurucu onayı olmadan yapılmaz (müdür toplar). **VARSAYIM** = doğrulanmamış.

### Kurucu kararları (özet)

| Tarih | Karar | Planda karşılığı |
|---|---|---|
| 10-27 | SMS (NetGSM) kapalı, geçişte de kapalı | Canlıda `NETGSM_*` boş. Yeniden kuyruklama gereksiz (G6 iptal) |
| 10-27 | Telegram yalnız test ortamında, WhatsApp yok | Canlıda `TELEGRAM_*` boş; test botu staging'e |
| 10-27 | Başka hesap/proje yok; eski hizmetler doğrudan kapatılır | §11 |
| 10-27 | Geliştirme bu sunucuda sürecek; kalıcı staging | ADR-0016, §7 |
| 10-27 | DO günlük droplet yedeği açık; Backblaze ve Healthchecks hesapları açılıyor | §8 |
| 10-28 | `/debug` kapatılsın | Hotfix `master`'a push edildi (`9894212`); Railway dağıtımı Supabase duraklatıldığı için başarısız (§12) |
| 10-28 | Cloudflare turuncu bulut ve ayarları; token doğrulandı, Caddy çalışıyor | ADR-0008, ADR-0009 kabul edildi |
| 10-28 | Geçiş zamanı serbest; ürün canlıya çıkmadı | §10 |
| 10-28 | **Supabase verisi demo; yalnız tablolar önemli → veri taşınmaz** | ADR-0017 (ADR-0004'ün yerini aldı), §5 |
| 10-28 | Supabase'te iki proje var: `beautyos-dev` ve `beautyos-staging` (ikisi de duraklatılmış, eu-west-1). Kurucu `beautyos-dev`'i açıyor | §5 kaynak seçimi, §11 ikisi de imha edilir |
| 10-28 | Test artıklarının silinmesi onaylandı (gelistirici siliyor) | — |

---

## 1. Hedef mimari

```
İnternet ─▶ Cloudflare (DNS + proxy, Full strict) ─▶ sirket-sunucu-1 :443 ─▶ caddy (ortak, /srv/caddy, ağ sirket-proxy)
   beautyossapp.com, app., www.  ─▶ beautyos-web:3000          (CANLI)
   api.beautyossapp.com          ─▶ beautyos-api:3001          (CANLI)
   yeni.beautyossapp.com         ─▶ beautyos-web-staging:3000  (STAGING, basic auth)
   yeni-api.beautyossapp.com     ─▶ beautyos-api-staging:3001  (STAGING)
                         ağ: beautyos icsel (internal) ─▶ postgres 17 (DB: beautyos, beautyos_staging)
                                                       └▶ redis 7.4    (DB 0: canlı, DB 1: staging)
```

**Compose projesi `beautyos`** (sunucuda `/srv/beautyos/compose.yml`, kaynağı depoda `deploy/compose.yml`; yazan `gelistirici`, `tasima/docker` dalı):

| Servis | İmaj | Ağlar | env dosyası | Sınır | Not |
|---|---|---|---|---|---|
| `web` | `ghcr.io/ahmeetkarateke/beautyos-web:<sürüm>-prod` | yalnız `sirket-proxy` (takma ad `beautyos-web`) | yok | 384M | `read_only`; `NEXT_PUBLIC_*` derlemede gömülü |
| `api` | `…/beautyos-api:<sürüm>` | `icsel`, `sirket-proxy` (`beautyos-api`) | `.env` | 512M | BullMQ işçisi aynı süreçte, **tek kopya**, `TZ=UTC` (ADR-0006) |
| `web-staging` | `…/beautyos-web:<staging sürümü>-staging` | yalnız `sirket-proxy` (`beautyos-web-staging`) | yok | 256M | ADR-0016 |
| `api-staging` | `…/beautyos-api:<staging sürümü>` | `icsel`, `sirket-proxy` (`beautyos-api-staging`) | `.env.staging` | 384M | tek kopya, `TZ=UTC` |
| `postgres` | `postgres:17.x` (sabit küçük sürüm) | `icsel` | `.env.db` | 768M | İki veritabanı, dört rol (§4); port yok |
| `redis` | `redis:7.4.x-alpine` | `icsel` | `.env.redis` | 192M | `appendonly yes`, `maxmemory 128mb`, `noeviction`, parola; port yok |
| `migrate` / `migrate-staging` | api imajı | `icsel` | `.env.migrate` / `.env.migrate-staging` | — | `profiles: [migrate]`; elle, canlı için `[ONAY]` |

**Kurallar** (`docker-yayinlama` skill'i, sunucu-altyapi ADR-0004):
- Caddy dışında hiçbir servis port yayınlamaz.
- `icsel` ağı `internal: true`. Web servisleri bu ağda değil; API'ler dış servislere `sirket-proxy` üzerinden çıkar.
- Her serviste healthcheck, `restart: unless-stopped`, `no-new-privileges`, `cap_drop` ve bellek sınırı var.
- Staging sürüm etiketi `BEAUTYOS_STAGING_VERSION` zorunlu ve ayrı; boşsa compose durur.
- Canlı ve staging yayınları servis adıyla ayrılır.
- Ayrı worker servisi yok (ADR-0006).

**Caddy site parçası** `/srv/caddy/siteler/beautyos.caddy` (kaynağı `deploy/caddy/`, gelistirici; ortak Caddy ayarları devops'ta, sunucu-altyapi ADR-0006..0010):

```
beautyossapp.com, www.beautyossapp.com, app.beautyossapp.com {
  import cf_dns
  reverse_proxy beautyos-web:3000 { header_up X-Forwarded-For {client_ip} }
}
api.beautyossapp.com {
  import cf_dns
  respond /debug* 404
  reverse_proxy beautyos-api:3001 { header_up X-Forwarded-For {client_ip} }
}
yeni.beautyossapp.com {
  import cf_dns
  route {
    @bos expression "{$BEAUTYOS_STAGING_BASIC_HASH}" == ""
    respond @bos 503                                      # özet yoksa şifresiz açılmaz
    basic_auth { {$BEAUTYOS_STAGING_BASIC_USER} {$BEAUTYOS_STAGING_BASIC_HASH} }
    reverse_proxy beautyos-web-staging:3000 { header_up X-Forwarded-For {client_ip} }
  }
}
yeni-api.beautyossapp.com {
  import cf_dns
  respond /debug* 404
  reverse_proxy beautyos-api-staging:3001 { header_up X-Forwarded-For {client_ip} }
}
```

- **Basic auth kurulum sırası** (devops, sunucu-altyapi `c6316d8`):
  1. Kurucu `/srv/caddy/.env`'e kullanıcıyı ve `caddy hash-password` özetini yazar.
  2. Caddy `docker compose up -d` ile yeniden oluşturulur (kısa kesinti, onaylı saat).
  3. `caddy-dogrula.sh` çalışır.
  4. Ancak bundan sonra `beautyos.caddy` kopyalanıp Caddy reload edilir.

  `caddy validate` boş değişkenle de geçtiği için koruma ona bırakılmaz.
- `yeni-api`'de basic auth yok: Bearer token ile çakışır, Telegram webhook'u da erişmeli. API zaten JWT ister.
- `www` yönlendirmesi kurucu yanıtına bağlı (S1).

**Sunucudaki dosya düzeni:**

```
/srv/beautyos/   compose.yml, postgres/init/01-roller.sh, postgres/postgresql.conf, betikler/sema-karsilastir.sh
                 .env .env.staging .env.db .env.migrate .env.migrate-staging .env.redis .env.supabase   (kurucu yazar, 600; ajanlar okumaz)
                 tasima/ (700)  şema dökümleri ve fark raporu (kişisel veri YOK); kapatmada silinir
/srv/caddy/      ortak Caddy (.env: CLOUDFLARE_API_TOKEN, BEAUTYOS_STAGING_BASIC_USER, BEAUTYOS_STAGING_BASIC_HASH), siteler/beautyos.caddy
```

## 2. Bellek bütçesi (4 GB RAM + 2 GB swap, 2 vCPU)

| Bileşen | Sınır | Beklenen | Ayar |
|---|---|---|---|
| İşletim sistemi, Docker, do-agent, fail2ban | — | 450–600 MB | — |
| caddy | 128 MB | 30–50 MB | — |
| web (canlı) | 384 MB | 120–200 MB | `NODE_OPTIONS=--max-old-space-size=256` |
| api + işçi (canlı) | 512 MB | 180–300 MB | `--max-old-space-size=320`, cpu 1.0 |
| web-staging | 256 MB | 100–170 MB | `--max-old-space-size=192` |
| api-staging | 384 MB | 150–250 MB | `--max-old-space-size=256`, cpu 0.5 |
| postgres 17 (iki DB) | 768 MB | 250–420 MB | `shared_buffers=192MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `max_connections=40` |
| redis | 192 MB | 10–40 MB | `maxmemory 128mb` |
| Gece yedek işi (geçici) | 256 MB | ~100 MB | — |
| **Toplam** | **~2,6 GB sınır** | **~1,4–2,1 GB** | |

**Kalıcı staging dahil 4 GB yeter.** Koşul: imajlar sunucuda derlenmez (ADR-0012). İkinci bir müşteri projesi gelirse ya da bellek kalıcı olarak > %85 olursa droplet büyütülür ya da staging durdurulur (ADR-0016).

## 3. Alan adı, DNS, SSL

- DNS Cloudflare'de. Kiracılar URL yoluyla ayrıldığı için **joker sertifika gerekmez** (ADR-0007).
- Canlı hostlar: `beautyossapp.com`, `app.`, `www.` (S1) ve `api.`. Staging hostları: `yeni.` ve `yeni-api.`. İki seviyeli alt alan adı kullanılmaz: Cloudflare'in ücretsiz kenar sertifikası kapsamaz.
- **ADR-0008 (kabul edildi):** turuncu bulut, Full (strict), minimum TLS 1.2, Bot Fight Mode ve Under Attack kapalı. Hukuk-uyum şartları:
  - `api.` ve `yeni-api.` için "Bypass cache".
  - Web Analytics/Zaraz/Logpush/Workers kapalı.
  - Cloudflare hesabında 2FA.
  - İlk gerçek müşteriden önce KVKK m.9 mekanizması kurulur (kurulamazsa `api.` gri buluta alınır).
- **ADR-0009 (kabul edildi):** DNS-01 sertifika. Token tek zonda; `/srv/caddy/.env` içinde `CLOUDFLARE_API_TOKEN`.
- **ADR-0010:** gerçek IP; `trusted_proxies static` + `CF-Connecting-IP` + `header_up X-Forwarded-For {client_ip}`.
- **ADR-0011:** 80/443 güvenlik duvarında kısıtlanmaz.

DNS adımları (kurucu, panelden, `[ONAY]`):

| Ne zaman | İşlem |
|---|---|
| Hemen | Zone dışa aktarımı (DNS > Records > Export), kurucunun arşivine |
| Hemen | `api`, `yeni`, `yeni-api` → A 209.38.237.171, turuncu (yeni hostlar, eski sisteme dokunmaz) |
| Geçişten ≥ 24 saat önce | `@`, `app`, `www` gri ise TTL 60 sn (turuncu ise gerekmez) |
| Geçiş | `@`, `app`, `www` → A 209.38.237.171, turuncu |

Dokunulmayacaklar: MX ve Resend SPF/DKIM/DMARC kayıtları. CAA kaydı varsa `letsencrypt.org` izinli olmalı.

## 4. Veritabanı, roller, gizli dosyalar

- **Canlı:** `beautyos` veritabanı, sahibi `app_owner` (migration), uygulama rolü `app_user` (`NOSUPERUSER NOBYPASSRLS`, yalnız DML). **Boş kurulur:** `01-roller.sh` + `migrate` (19 migration). Supabase'ten veri gelmez (ADR-0017).
- **Staging:** `beautyos_staging` veritabanı, roller `stg_owner`/`stg_user`. Çapraz `CONNECT` yok. Boş başlar, test verisi kayıt akışıyla üretilir.
- **Redis:** canlı DB 0, staging DB 1. Ortam ayrımı henüz yok (aynı parola); ilk müşteriden önce G19.
- **İlk süper yönetici:** boş veritabanında `POST /api/v1/admin/seed` (gövdede `ADMIN_SEED_SECRET`) ile bir kez oluşturulur. Ardından kurucu `ADMIN_SEED_SECRET`'ı `.env`'den **boşaltır** ve `api` yeniden başlatılır; değer boşken uç nokta her isteğe 403 döner. Uç noktada hız sınırı yok, açık kalmamalı. Aynı işlem staging için de geçerli.

| Dosya | Yükleyen | İçerik (yalnız adlar; ayrıntı kök `.env.example`) |
|---|---|---|
| `.env` | `api` (+ compose değişkenleri) | Canlı uygulama değişkenleri, `BEAUTYOS_VERSION`, `BEAUTYOS_STAGING_VERSION`, `IMAGE_PREFIX` |
| `.env.staging` | `api-staging` | Aynı adlar, staging değerleri (ayrı `JWT_SECRET`) |
| `.env.db` | `postgres` | `POSTGRES_*`, `APP_OWNER_PASSWORD`, `APP_USER_PASSWORD`, `STG_OWNER_PASSWORD`, `STG_USER_PASSWORD` |
| `.env.migrate` / `.env.migrate-staging` | `migrate` / `migrate-staging` | `MIGRATION_DATABASE_URL` (sahip rolü); uygulama dosyalarına yazılmaz |
| `.env.redis` | `redis` | `REDIS_PASSWORD` |
| `.env.supabase` | yalnız `sema-karsilastir.sh kaynak` | libpq değişkenleri (`PGHOST` …). Şema karşılaştırması bitince silinir |

## 5. Veri: taşınmaz; şema uyum kontrolü (ADR-0017)

**Neden:** Supabase verisi demo; kurucu için önemli olan tablo yapısı. Uygulamanın gerçek şeması `schema.prisma` ve 19 migration'dır. Sunucuda veritabanı bunlardan kurulur. Tek soru şu: Supabase'te çalışan şema, migration'ların kurduğu şemayla aynı mı? Supabase'te elle ya da `prisma db push` ile yapılmış ve migration'a girmemiş bir değişiklik varsa kaybolur.

**Kontrol** (`deploy/betikler/sema-karsilastir.sh`, gelistirici yazar; G12):

1. **`kaynak`** (yalnız kurucu çalıştırır, `.env.supabase` ile):
   - Komut: `ssh karateke@209.38.237.171 'bash /srv/beautyos/betikler/sema-karsilastir.sh kaynak'`.
   - Geçici `postgres:17` istemci konteyneri açılır, bağlantı bilgisi libpq değişkenleriyle girer. Şunlar alınır:
     - `pg_dump --schema-only --schema=public --no-owner --no-privileges --no-publications --no-subscriptions` → `tasima/sema-kaynak.sql`.
     - `_prisma_migrations` tablosundan yalnız `migration_name`, `checksum`, bitti/geri alındı bilgisi → `tasima/migrations-kaynak.txt`.
     - Sunucu sürümü, `pg_extension` listesi, `public`'te RLS'i açık tablo ve politika listesi → `tasima/kaynak-bilgi.txt`.
   - **Hiçbir tablonun satırı okunmaz.** Çıktılar kişisel veri içermez, ekip okuyabilir.
   - Bağlantı Supabase Session pooler (IPv4, 5432) üzerinden; Transaction pooler kullanılmaz.
2. **`hedef`** (devops ya da gelistirici; gizli bilgi gerekmez):
   - Geçici, yalnız iç ağlı bir `postgres:17` + api imajıyla `prisma migrate deploy` çalıştırılır. Parola betikte rastgele üretilir.
   - Aynı `pg_dump` bayraklarıyla `tasima/sema-hedef.sql` ve `migrations-hedef.txt` üretilir.
   - Konteyner, volume ve ağ silinir.
3. **`karsilastir`:**
   - İki döküm normalleştirilir: yorum, `SET`, `set_config`, `\restrict`/`\unrestrict` satırları ve boş satırlar atılır.
   - `diff -u` → `tasima/sema-fark.txt`. Migration listeleri ad + checksum ile karşılaştırılır.
   - Fark yoksa çıkış 0, varsa 1.
4. **Depo içi uyum** (CI'da, Supabase gerekmez; G1-K6): `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url … --exit-code` boş dönmeli. Kodun beklediği şema (`schema.prisma`) ile migration'lar uyuşmalı.

**Fark çıkarsa karar kuralı.** Referans `schema.prisma`'dır (kod onunla derleniyor).

| Fark | Ne yapılır |
|---|---|
| Supabase'te var, migration'da yok, `schema.prisma`'da **var** | Migration eksik. gelistirici **düzeltici migration** yazar (yeni klasör; mevcut migration'lar değiştirilmez). Denetçi ONAY'ı ile birleşir; canlı ve staging migrate `[ONAY]` |
| Supabase'te var, `schema.prisma`'da **yok** (elle eklenmiş indeks, sütun, tablo) | Mimara bildirilir. Varsayılan: taşınmaz, `docs/mevcut-durum.md`'ye kaydedilir. Gerekiyorsa önce `schema.prisma`'ya, sonra migration'a girer |
| Migration'da var, Supabase'te yok | Supabase geride kalmış. Hedef doğrudur, işlem yok (bilgi) |
| Migration listesi ya da checksum farkı | Rapor mimara; elle düzenlenmiş migration olabilir. Değerlendirilir |
| Supabase'e özgü gürültü (panelden açılmış RLS, `COMMENT ON SCHEMA public`) | Listelenir. RLS varsa not edilir (RLS projesi T-B1 için girdi), taşınmaz |

**Hangi Supabase projesi:** Railway canlısına bağlı olan (müdür `/health` ile tespit ediyor). İpucu: depodaki test yardımcısı (`apps/api/src/__tests__/helpers/setup.ts`) proje referanslarını yazıyor: canlı `kpoqwdamkmdjntbgjbxy`, staging `lnrobattysyfoljalndu`. Referans panelde proje adresinde görünür; kurucu adla eşleştirebilir. Karşılaştırma yalnız canlı projeyle yapılır.

**Supabase açılamazsa:** kaynak karşılaştırması atlanır, yalnız 4. adım (depo içi uyum) yapılır. Kabul edilen risk: Supabase'te migration'a girmemiş elle değişiklik varsa kaybolur. Kod `schema.prisma`'ya göre çalıştığı için etkisi düşük.

**Redis:** taşınmaz (ADR-0005).

## 6. CI/CD (ADR-0012)

- `imaj.yml` (`workflow_dispatch` + `v*`): tek API imajı ve iki web imajı (`-prod` → `https://api.beautyossapp.com`, `-staging` → `https://yeni-api.beautyossapp.com`) özel GHCR'a gider. Sunucuya SSH yok.
- **Yayın:** devops elle yapar. Önce staging, test GEÇTİ sonrası canlı. Sunucu GHCR'a `read:packages` token'ıyla bağlanır `[ONAY]`.
- **CI (G1):** `postgres:17` servis konteyneri + depo içi şema uyumu (`prisma migrate diff`).

## 7. Staging (ADR-0016)

- Kalıcı. Aynı compose projesinde, aynı Postgres/Redis örneğinde ayrı veritabanı, rol ve DB. Kurucu ile geliştirme burada sürer.
- `.env.staging`: `NETGSM_*` boş; test Telegram botu `PUBLIC_URL=https://yeni-api.beautyossapp.com` ile; Sentry boş (S7).
- İlk gerçek müşteriden önce yeniden değerlendirilir: staging'in canlıyla aynı Postgres'te kalması ve Redis ayrımı (G19).

## 8. Yedekleme ve izleme: geçişten ÖNCE hazır

- **Yedek (ADR-0015, devops):**
  - Her gece 03:30 TR: `beautyos` + `beautyos_staging` + rol dökümü → restic → B2 eu-central. Saklama 7/4/6.
  - B2 yaşam döngüsü "yalnız son sürüm". Başarısızlık Healthchecks → Telegram. İkinci katman DO günlük droplet yedeği.
  - **Ön koşul:** en az bir başarılı yedek + `yedek-geri-yukle.sh dene beautyos`. Veritabanı boş olsa da şema ve roller yedeklenir ve geri yükleme denenir. Asıl amaç, ilk gerçek veriden önce zincirin çalıştığını görmek.
- **İzleme:** `api/health`, `app/login`, apex yoklamaları → Telegram. DO uyarıları: CPU %80, bellek %85, disk %85.
- **KVKK geçiş öncesi şartları** (`docs/kvkk-tasima-degerlendirmesi.md` §6.1):
  - Sentry gövde temizliği ya da `SENTRY_DSN` boş (S7).
  - B2 yaşam döngüsü.
  - Cloudflare ayarları.
  - Hesaplarda 2FA.
  - Verinin demo olduğu teyidi: **verildi (10-28)**.
- Veri taşınmadığı için taşıma arşivi yok. Hukuk-uyum'un "arşiv en fazla 30 gün" şartı konusuz kaldı.

## 9. Aşamalar ve onay noktaları

| Aşama | İçerik | Görevler | `[ONAY]` noktaları |
|---|---|---|---|
| 0. Hemen | `/debug` (Railway; §12), DNS dışa aktarımı ve yeni hostlar | G4a | DNS kayıtları; Railway ara önlemi |
| 1. Uygulama | Dockerfile'lar, standalone, CORS, açılış kontrolü + Sentry temizliği, imaj iş akışı, CI + depo içi şema uyumu | G1–G5, G7 | Taşıma dallarının GitHub'a push'u; GHCR token'ı |
| 2. Altyapı | Caddy, yedek, izleme | G8–G10 | B2 ve Healthchecks hesapları; Caddy yeniden oluşturma saati |
| 3. Yığın | Compose, roller, staging ayakta; şema karşılaştırması (+ gerekirse düzeltici migration); **canlı yığın boş veritabanıyla ayakta** (`api.beautyossapp.com`); kabul testi staging'de | G11–G14 | Canlı ve staging `migrate`; `kaynak` adımı (Supabase'ten şema okuma) |
| 4. Geçiş | §10 (DNS) | G15–G16 | Runbook'un tamamı (tek onay) |
| 5. Kapatma | G16 geçince | G17 | Her silme ayrı; imha tutanağı |
| 6. Sonrası | Node/Next yükseltmesi, temizlik, G19, RLS ve KVKK "ilk müşteriden önce" maddeleri | G18, G19, T-B1 | Ayrı planlama |

## 10. Geçiş (tek oturum, ~30 dk, gün ve saat serbest; 03:00–04:30 hariç)

**Ön koşullar:**
- G1–G5, G7–G14 tamam: denetçi ONAY'ı ve staging'de TEST GEÇTİ.
- Canlı yığın boş veritabanıyla healthy: `https://api.beautyossapp.com/health` → 200.
- §8 tamam. Zone dışa aktarıldı.
- Kurucu, `MIGRATION_DATABASE_URL`'in `.env`'de olmadığını ve `.env` canlı değerlerini teyit etti: `NETGSM_*` ve `TELEGRAM_*` boş, `SENTRY_DSN` S7'ye göre, Resend/Turnstile/Gemini dolu, `FRONTEND_URL=https://app.beautyossapp.com`.

| # | Kim | Adım | Doğrulama |
|---|---|---|---|
| 1 | kurucu | Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımını kapat (R1) | Panel |
| 2 | kurucu | Railway prod ve staging API servislerini durdur (silme) | Eski API yanıt vermiyor |
| 3 | kurucu | DNS `@`, `app`, `www` → 209.38.237.171, turuncu | `curl -sI https://app.beautyossapp.com` → `server: cloudflare`, 200 |
| 4 | kurucu | İlk süper yönetici: `POST /api/v1/admin/seed`; ardından `ADMIN_SEED_SECRET` boşaltılır, devops `docker compose up -d api` | Seed uç noktası artık 403 |
| 5 | test-muhendisi | Canlı duman testi (G16) | Geçti |
| 6 | devops | `sirket/sunucu.md` kaydı, ilk 60 dk izleme | Kayıt yazıldı |

**Geri dönüş (`[ONAY]`):** Yalnız DNS dışa aktarımdaki Vercel değerlerine döndürülür. Taşınmış veri olmadığı için başka adım yok. Eski Railway API'si Supabase olmadan çalışmaz; geri dönüş yalnız eski tanıtım sayfasını geri getirir. Sorun yeni sunucuda, ileriye doğru düzeltilir. Yeni sunucudaki yığın durdurulmaz.

## 11. Eski servislerin kapatılması (G16 geçince, kurucu onayıyla)

Her silme ayrı `[ONAY]`. Her biri için `sirket/` altında **imha tutanağı** tutulur: tarih, ne silindi, kim onayladı; içerik yok. Veri demo olsa da KVKK gereği tutanak tutulur.

1. **Supabase `beautyos-dev`** (canlıya bağlı olduğu varsayılıyor) silinir. Önce §5 `kaynak` adımı bitmiş olmalı. Panelin kendi otomatik yedekleri de projeyle birlikte gider; tutanakta yazılır.
2. **Supabase `beautyos-staging`** silinir. Şema karşılaştırmasına girmez, bekletmeye gerek yok.
3. Railway (prod + staging), Vercel (dağıtımlar ve alan adı kayıtları dahil) ve Upstash projeleri silinir.
4. GitHub `DATABASE_URL` sırrı silinir. Dış platformlarda saklanmış anahtarlar yenilenir (S5).
5. `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silinir.
6. Depodaki Railway/Vercel kalıntıları temizlenir (G18).

## 12. Risk değerlendirmesi

**Genel: DÜŞÜK.** Veri taşınmıyor, gerçek kullanıcı yok, SMS kapalı. Geçiş, canlı yığın önceden ayağa kalktıktan sonra yalnız DNS değişikliği.

| Risk | Önlem |
|---|---|
| **`/debug` Railway'de hâlâ açık:** hotfix (`9894212`) dağıtılamadı, çünkü API açılışta veritabanını yokluyor ve Supabase duraklatılmış | (i) `beautyos-dev` açılınca Railway'de "Redeploy" ile hotfix çıkar, ya da (ii) ara önlem `[ONAY]`: Railway servisinin herkese açık adresini kaldırmak ya da servisi şimdi durdurmak. Ürün canlıda değil, kayıp yok. Gemini anahtarı yenilenirse `/debug` ücretli çağrı da yapamaz |
| Supabase'te migration'a girmemiş şema değişikliği | §5 karşılaştırması + düzeltici migration; Supabase açılamazsa depo içi uyum + kabul edilen risk |
| `master` push'unun eski API'yi yeniden açması (R1) | Geçiş adım 1 |
| Seed uç noktasının açık kalması (hız sınırı yok) | Geçiş adım 4: `ADMIN_SEED_SECRET` boşaltılır |
| Cloudflare arkasında yanlış istemci IP'si | ADR-0010 + G14-K7 |
| Staging'in canlıyla aynı Postgres/Redis'i paylaşması | Rol ve `CONNECT` ayrımı; Redis için G19 (ilk müşteriden önce) |
| Kiracı izolasyonunun yalnız uygulama filtresinde olması | T-B1 (ilk müşteriden önce, hukuk-uyum güçlü öneri) |

## 13. Kurucudan beklenenler

**Yanıtlananlar:** Cloudflare (K2), SMS, Telegram, hesaplar, geçiş zamanı, **S6 (veri demo; taşınmayacak)**, test artıklarının silinmesi.

**Hâlâ açık:**
1. `beautyos-dev` açıldığında: canlıya bağlı proje bu mu (müdür `/health` ile tespit ediyor)? Ardından `.env.supabase` yazılıp `sema-karsilastir.sh kaynak` çalıştırılır.
2. Railway'deki `/debug` için: Supabase açılınca "Redeploy" mı, yoksa ara önlem mi?
3. **S1:** `www` kullanılıyor mu, apex'e yönlensin mi? Başka alt alan adı var mı?
4. **S3:** GitHub'daki `DATABASE_URL` sırrı hangi veritabanını gösteriyor (CI)?
5. **S5:** `JWT_SECRET` ve dış servis anahtarları yenilensin mi (öneri: evet)?
6. **S7:** Sentry geçişte kapalı mı kalsın, yoksa G5-K5 + AB bölgesiyle mi açılsın?
7. B2 ve Healthchecks hesapları açılınca devops'a bildirim; hesaplarda 2FA.
