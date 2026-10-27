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
| 10-28 | `/debug` kapatılsın | Hotfix `master`'a push edildi (`9894212`), Railway dağıtımı başarısız oldu. Asıl neden derleme: `node:20-bullseye-slim` apt deposu kapandı. Kök Dockerfile'ı bookworm'a alan `e68459f` (denetçi ONAY'lı, kayıtlı istisna) bunu düzeltti. Kalan engel: Supabase duraklatılmış (§12) |
| 10-28 | Cloudflare turuncu bulut ve ayarları; token doğrulandı, Caddy çalışıyor | ADR-0008, ADR-0009 kabul edildi |
| 10-28 | Geçiş zamanı serbest; ürün canlıya çıkmadı | §10 |
| 10-28 | **Supabase verisi demo; yalnız tablolar önemli → veri taşınmaz** | ADR-0017 (ADR-0004'ün yerini aldı), §5 |
| 10-28 | Supabase'te iki proje var: `beautyos-dev` ve `beautyos-staging` (eu-west-1). **Canlı proje `beautyos-dev`, kesinleşti:** açılınca canlı `/health` `db: ok`, test API'si `db: error` döndü (`beautyos-staging` kapalı). **7 gün içinde yeniden duraklar.** | §5.1 kurucu komutu; §11 ikisi de imha edilir |
| 10-28 | `e68459f` kurucu onayıyla `master`'a push edildi | Railway bu commit'i "watch paths" yüzünden **SKIPPED** saydı, kurucu elle Redeploy yaptı. **G4a kapandı:** `api.beautyossapp.com/debug` 404, `/health` `{"status":"ok","db":"ok"}`, GitHub durumu "Success - api.beautyossapp.com" |
| 10-28 | Öğrenilen: Railway servisi yalnız `apps/api/**` değişikliğini izliyor; `api.beautyossapp.com` Railway'in özel alan adı | Kök dosya değişikliği (Dockerfile, railway.json) Railway'de **elle Redeploy** ister. `api` DNS kaydı geçişe kadar Railway'de kalır (§3, §10) |
| 10-28 | Test artıklarının silinmesi onaylandı (gelistirici siliyor) | — |
| 10-28 | **D4:** GitHub planı Free; GHCR kotası yetersiz → imajlar sunucuda derlenir (müdür kararı) | ADR-0018 (ADR-0012'nin yerini aldı), §6, G7 |

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
| `web` | `beautyos-web:<sha12>-prod` (yerel imaj, sunucuda derlenir; ADR-0018) | yalnız `sirket-proxy` (takma ad `beautyos-web`) | yok | 384M | `read_only`; `NEXT_PUBLIC_*` derlemede gömülü |
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
/srv/beautyos/   compose.yml, postgres/init/01-roller.sh, postgres/postgresql.conf, betikler/{sema-karsilastir,derle,imaj-temizle}.sh, derleme.conf
                 kaynak/  depo klonu (salt okunur deploy key ile; yalnız derleme için, .env* burada tutulmaz)
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

**Kalıcı staging dahil 4 GB yeter.** İmajlar sunucuda derlenir (ADR-0018). Derleme sırasında geçici olarak ~1,5–2 GB ek bellek gerekir. Önlemler: sıralı derleme, Node heap sınırı, bellek ve CPU sınırlı builder ve düşük trafik saati. Mevcut 2 GB swap güvenlik ağıdır. Ölçüm (D14) yetersiz çıkarsa devops geçici swap için ADR önerir `[ONAY]`. İkinci bir müşteri projesi gelirse ya da bellek kalıcı olarak > %85 olursa droplet büyütülür ya da staging durdurulur (ADR-0016).

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
| Hemen | `yeni`, `yeni-api` → A 209.38.237.171, turuncu (yeni hostlar, eski sisteme dokunmaz). **`api` buna dahil DEĞİL:** `api.beautyossapp.com` şu an Railway canlısının özel alan adı (10-28'de görüldü); geçişe kadar Railway'i gösterir |
| Geçişten ≥ 24 saat önce | `@`, `app`, `www` gri ise TTL 60 sn (turuncu ise gerekmez) |
| Geçiş | `@`, `app`, `www` **ve `api`** → A 209.38.237.171, turuncu (dördü birlikte; Railway'deki özel alan adı kaydı G17'de kaldırılır) |

Dokunulmayacaklar: MX ve Resend SPF/DKIM/DMARC kayıtları. CAA kaydı varsa `letsencrypt.org` izinli olmalı.

## 4. Veritabanı, roller, gizli dosyalar

- **Canlı:** `beautyos` veritabanı, sahibi `app_owner` (migration), uygulama rolü `app_user` (`NOSUPERUSER NOBYPASSRLS`, yalnız DML). **Boş kurulur:** `01-roller.sh` + `migrate` (19 migration). Supabase'ten veri gelmez (ADR-0017).
- **Staging:** `beautyos_staging` veritabanı, roller `stg_owner`/`stg_user`. Çapraz `CONNECT` yok. Boş başlar, test verisi kayıt akışıyla üretilir.
- **Redis:** canlı DB 0, staging DB 1. Ortam ayrımı henüz yok (aynı parola); ilk müşteriden önce G19.
- **İlk süper yönetici:** boş veritabanında `POST /api/v1/admin/seed` (gövdede `ADMIN_SEED_SECRET`) ile bir kez oluşturulur. Ardından kurucu `ADMIN_SEED_SECRET`'ı `.env`'den **boşaltır** ve `api` yeniden başlatılır; değer boşken uç nokta her isteğe 403 döner. Uç noktada hız sınırı yok, açık kalmamalı. Aynı işlem staging için de geçerli.

| Dosya | Yükleyen | İçerik (yalnız adlar; ayrıntı kök `.env.example`) |
|---|---|---|
| `.env` | `api` (+ compose değişkenleri) | Canlı uygulama değişkenleri, `BEAUTYOS_VERSION`, `BEAUTYOS_STAGING_VERSION`, `IMAGE_PREFIX` (sunucuda boş) |
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

**Hangi Supabase projesi:** `beautyos-dev` (2026-10-28'de kesinleşti). Karşılaştırma yalnız bu projeyle yapılır. Proje **7 gün içinde yeniden duraklar**; şema dökümü bu süre içinde alınmalı (§5.1).

### 5.1 Kurucunun çalıştıracağı şema dökümü (zaman sınırlı)

Bu adım yalnız şemayı okur, hiçbir tablodan satır okumaz. Bağlantı salt okunur oturumla açılır.

**1. `.env.supabase` dosyası** (kurucu, sunucuda `/srv/beautyos/.env.supabase`, `chmod 600`). Değerler Supabase panelinde `beautyos-dev` → **Connect** → **Session pooler** bölümünden alınır:

```
PGHOST=<paneldeki pooler adresi, ör. aws-0-eu-west-1.pooler.supabase.com>
PGPORT=5432
PGUSER=<paneldeki kullanıcı, biçim: postgres.<proje-ref>>
PGPASSWORD=<veritabanı parolası>
PGDATABASE=postgres
PGSSLMODE=require
```

- **Değerler TIRNAKSIZ yazılır** (`PGPASSWORD=abc`, `PGPASSWORD='abc'` değil). `docker --env-file` tırnak karakterini değerin parçası sayar. Bu, Caddy'nin `/srv/caddy/.env` dosyasındaki "özet tek tırnak içinde" kuralının tersidir; ikisini karıştırmayın.
- Port 5432 olmalı (Session pooler). 6543 (Transaction pooler) kullanılmaz.
- `PGSSLMODE=require` kabul edildi; `verify-full` seçilmedi. Gerekçe: tek seferlik, yalnız şema okuyan bir bağlantı ve proje G17'de silinecek; `verify-full` Supabase CA dosyasının sunucuya konmasını gerektirir. Bu adım tekrarlanırsa `verify-full` yeniden değerlendirilir.
- **Veritabanı parolasını panelden sıfırlamayın.** Sıfırlanırsa Railway canlı API'sinin bağlantısı kopar ve `/debug` hotfix'inin dağıtımı yeniden bozulur. Parola bilinmiyorsa önce müdüre haber verin; Railway'deki `DATABASE_URL` aynı anda güncellenmelidir.

**2. Betiğin sunucuya konması** (devops, kurucu beklemez). Betik `deploy/betikler/sema-karsilastir.sh` (`tasima/docker` `e3b89f2`), denetçinin kısa incelemesinde.
- ONAY gelince devops betiği **onaylı commit'ten** sunucu-altyapi yöntemiyle yükler (PowerShell 5.1'de doğrudan pipe yok):
  `cmd /c "git -C <tasima/docker worktree> archive <onaylı commit> deploy/betikler/sema-karsilastir.sh | ssh karateke@209.38.237.171 'tar -x -C /srv/beautyos --strip-components=1'"`
- Ardından sunucuda `bash -n /srv/beautyos/betikler/sema-karsilastir.sh` ve `grep -c $'\r'` (0 olmalı) çalıştırılır.
- Commit kimliği `sirket/sunucu.md` işlem günlüğüne yazılır. Devops "yüklendi" bildirimini müdüre yapar.

**3. Kurucunun adımları** (devops "yüklendi" dedikten sonra):
1. Supabase panelinde `beautyos-dev` → **Connect** → **Session pooler**. Host, port (5432), kullanıcı (`postgres.<proje-ref>`) ve veritabanı (`postgres`) değerlerini not edin. Parola projenin veritabanı parolasıdır; **sıfırlamayın**.
2. `ssh karateke@209.38.237.171`, sonra `nano /srv/beautyos/.env.supabase` ile yukarıdaki altı satırı **tırnaksız** yazın. Ardından `chmod 600 /srv/beautyos/.env.supabase`.
3. Çalıştırın: `bash /srv/beautyos/betikler/sema-karsilastir.sh kaynak`
4. Beklenen:
   - Betik kaynak sürümünü yazar.
   - Salt okunur oturumu önce `SELECT 1` ile dener. Pooler `PGOPTIONS`'u reddederse bir **uyarı** basar ve ayarsız devam eder; bu kabul edilebilir, `pg_dump` zaten salt okunur işlemle çalışır.
   - `/srv/beautyos/tasima/` altında `sema-kaynak.sql` ve `migrations-kaynak.txt` (ve sürüm/bilgi dosyası) oluşur. Dosyalar karateke'ye ait ve 600 izinlidir.
5. Müdüre bildirin: "kaynak tamam" ve varsa uyarı metni. **`.env.supabase` içeriğini, parolayı ya da bağlantı satırını hiçbir yere yapıştırmayın.**
6. Hata olursa: bağlantı hatasında betik parola ya da host yazmadan açık bir mesaj verir. Host, port (5432) ve kullanıcı biçimini (`postgres.<ref>`) kontrol edin. Kaynak sürümü 17'den büyükse betik durur, müdüre bildirin.

Denenen durum (gelistirici, sunucuda): Kaynak olarak PG 15 üzerinde 19 migration ve bir işaret satırı kullanıldı.
- `--user` ile izin hatası çıkmadı; çıktılar karateke'ye ait, 600 izinli.
- Dökümde `INSERT`/`COPY` sayısı 0; işaret satırı hiçbir çıktıda görünmüyor.
- Salt okunur oturum `CREATE TABLE`'ı reddetti.
- `PGOPTIONS` reddi benzetimle denendi, uyarı ve yedek yol çalıştı. **Gerçek Supabase pooler'ında henüz doğrulanmadı** (D7).

İmaj `postgres:17.11-bookworm` (compose ile aynı).

**4. Başarı ölçütü ve sonrası:**
- Üç dosya oluşur. `sema-kaynak.sql` içinde `CREATE TABLE` satırları vardır ve `INSERT`/`COPY` satırı **yoktur**. `migrations-kaynak.txt` 19 civarı satır içerir.
- Kurucu "tamam" der; dosyalar kişisel veri içermez, ekip okuyabilir.
- `hedef` ve `karsilastir` adımlarını gelistirici ya da devops çalıştırır (G13-K3). Supabase'in tekrar duraklaması bundan sonra sorun değildir.
- `.env.supabase` dosyası G17'de silinir.

**Supabase açılamazsa:** kaynak karşılaştırması atlanır, yalnız 4. adım (depo içi uyum) yapılır. Kabul edilen risk: Supabase'te migration'a girmemiş elle değişiklik varsa kaybolur. Kod `schema.prisma`'ya göre çalıştığı için etkisi düşük.

**Redis:** taşınmaz (ADR-0005).

## 6. Derleme ve yayın (ADR-0018; GHCR'lı ADR-0012'nin yerini aldı)

- **Neden değişti:** GitHub Free planında özel paket kotası 500 MB depolama / 1 GB aylık aktarım; bir sürümün imajları bunu bir iki sürümde dolduruyor (D4).
- **Kaynak:** sunucu depoyu `/srv/beautyos/kaynak`'a **salt okunur deploy key** ile çeker. Anahtarı kurucu sunucuda üretir ve GitHub'da "Allow write access" işaretsiz ekler `[ONAY]`. Kayıt defteri ve `docker login` yok.
- **Derleme:** `derle.sh <commit-sha>` (devops çalıştırır): `git fetch`, ardından belirli commit'e geçilir, ardından sırayla `docker build` çalışır. Etiketler `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod`, `beautyos-web:<sha12>-staging`. Web derleme değerleri depodaki `deploy/derleme.conf`'tan gelir (`-prod` → `https://api.beautyossapp.com`, `-staging` → `https://yeni-api.beautyossapp.com`).
- Canlıya giden imaj yalnız GitHub'a push edilmiş, denetçi ONAY'lı commit'ten derlenir.
- **Temizlik:** `imaj-temizle.sh` her imaj adı için son 3 sürümü tutar. Kullanımdaki ve `.env`'de yazılı sürümleri silmez. Kural kurucu onayıyla bir kez kabul edilir.
- **Yayın:** devops elle yapar. Önce staging, test GEÇTİ sonrası canlı: `.env`'de `BEAUTYOS_STAGING_VERSION`/`BEAUTYOS_VERSION` değiştirilir, ardından `docker compose up -d <servisler>` çalışır. **Geri alma:** önceki etikete dönülür, imaj yerelde durur.
- **CI derleme kontrolü:** `imaj.yml` (`c82bab8`) GHCR'a itmez. PR ve `workflow_dispatch`'te Dockerfile'ların derlendiğini doğrular; yetki yalnız `contents: read`.
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
| 0. Hemen | `/debug` (G4a, **kapandı 10-28**), DNS dışa aktarımı ve yeni staging hostları (`yeni`, `yeni-api`) | G4a | DNS kayıtları |
| 1. Uygulama | Dockerfile'lar, standalone, CORS, açılış kontrolü + Sentry temizliği, imaj iş akışı, CI + depo içi şema uyumu | G1–G5, G7 | Taşıma dallarının GitHub'a push'u (sunucu commit'i oradan çeker); salt okunur deploy key; imaj temizleme kuralı |
| 2. Altyapı | Caddy, yedek, izleme | G8–G10 | B2 ve Healthchecks hesapları; Caddy yeniden oluşturma saati |
| 3. Yığın | Compose, roller, staging ayakta; şema karşılaştırması (+ gerekirse düzeltici migration); **canlı yığın boş veritabanıyla ayakta** (`api.beautyossapp.com`); kabul testi staging'de | G11–G14 | Canlı ve staging `migrate`; `kaynak` adımı (Supabase'ten şema okuma) |
| 4. Geçiş | §10 (DNS) | G15–G16 | Runbook'un tamamı (tek onay) |
| 5. Kapatma | G16 geçince | G17 | Her silme ayrı; imha tutanağı |
| 6. Sonrası | Node/Next yükseltmesi, temizlik, G19, RLS ve KVKK "ilk müşteriden önce" maddeleri | G18, G19, T-B1 | Ayrı planlama |

## 10. Geçiş (tek oturum, ~30 dk, gün ve saat serbest; 03:00–04:30 hariç)

**Ön koşullar:**
- G1–G5, G7–G14 tamam: denetçi ONAY'ı ve staging'de TEST GEÇTİ.
- Canlı yığın boş veritabanıyla healthy. DNS henüz Railway'i gösterdiği için doğrudan sunucuya sorulur: `curl --resolve api.beautyossapp.com:443:209.38.237.171 https://api.beautyossapp.com/health` → 200. Aynısı `app.beautyossapp.com` için `/login` ile yapılır. Sertifika DNS-01 ile önceden alındığından TLS geçerlidir.
- §8 tamam. Zone dışa aktarıldı.
- Kurucu, `MIGRATION_DATABASE_URL`'in `.env`'de olmadığını ve `.env` canlı değerlerini teyit etti: `NETGSM_*` ve `TELEGRAM_*` boş, `SENTRY_DSN` S7'ye göre, Resend/Turnstile/Gemini dolu, `FRONTEND_URL=https://app.beautyossapp.com`.

| # | Kim | Adım | Doğrulama |
|---|---|---|---|
| 1 | kurucu | Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımını kapat (R1) | Panel |
| 2 | kurucu | Railway prod ve staging API servislerini durdur (silme) | Eski API yanıt vermiyor |
| 3 | kurucu | DNS `@`, `app`, `www`, `api` → 209.38.237.171, turuncu (`api` şu an Railway'de) | `curl -sI https://app.beautyossapp.com` → `server: cloudflare`, 200; `https://api.beautyossapp.com/health` boş veritabanıyla 200 (Railway değil: yanıtta `db: ok` ve sunucu log'unda istek görünür) |
| 4 | kurucu | İlk süper yönetici: `POST /api/v1/admin/seed`; ardından `ADMIN_SEED_SECRET` boşaltılır, devops `docker compose up -d api` | Seed uç noktası artık 403 |
| 5 | test-muhendisi | Canlı duman testi (G16) | Geçti |
| 6 | devops | `sirket/sunucu.md` kaydı, ilk 60 dk izleme | Kayıt yazıldı |

**Geri dönüş (`[ONAY]`):** Yalnız DNS dışa aktarımdaki Vercel değerlerine döndürülür. Taşınmış veri olmadığı için başka adım yok. Eski Railway API'si Supabase olmadan çalışmaz; geri dönüş yalnız eski tanıtım sayfasını geri getirir. Sorun yeni sunucuda, ileriye doğru düzeltilir. Yeni sunucudaki yığın durdurulmaz.

## 11. Eski servislerin kapatılması (G16 geçince, kurucu onayıyla)

Her silme ayrı `[ONAY]`. Her biri için `sirket/` altında **imha tutanağı** tutulur: tarih, ne silindi, kim onayladı; içerik yok. Veri demo olsa da KVKK gereği tutanak tutulur.

1. **Supabase `beautyos-dev`** (canlı proje, 10-28'de kesinleşti) silinir. Önce §5 `kaynak` adımı bitmiş olmalı. Panelin kendi otomatik yedekleri de projeyle birlikte gider; tutanakta yazılır.
2. **Supabase `beautyos-staging`** silinir. Şema karşılaştırmasına girmez, bekletmeye gerek yok.
3. Railway (prod + staging; `api.beautyossapp.com` özel alan adı kaydı dahil), Vercel (dağıtımlar ve alan adı kayıtları dahil) ve Upstash projeleri silinir.
4. GitHub `DATABASE_URL` sırrı silinir. Dış platformlarda saklanmış anahtarlar yenilenir (S5).
5. `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silinir.
6. Depodaki Railway/Vercel kalıntıları temizlenir (G18).

## 12. Risk değerlendirmesi

**Genel: DÜŞÜK.** Veri taşınmıyor, gerçek kullanıcı yok, SMS kapalı. Geçiş, canlı yığın önceden ayağa kalktıktan sonra yalnız DNS değişikliği.

| Risk | Önlem |
|---|---|
| ~~`/debug` Railway'de açık~~ **Kapandı (10-28):** `e68459f` + elle Redeploy; `/debug` 404 | — |
| Railway "watch paths" yalnız `apps/api/**`: kök dosya değişikliği sessizce SKIPPED olur, canlıya çıkmadığı fark edilmeyebilir | Geçişe kadar Railway'e giden her kök dosya değişikliğinden sonra GitHub dağıtım durumu kontrol edilir; gerekirse elle Redeploy (kurucu). Tersi de geçerli: `apps/api/**` değişikliği `master` push'unda Railway'e **otomatik** çıkar (R1) |
| `api.beautyossapp.com` Railway'de; geçişte DNS'i dört kayıtla birlikte değişir | §3 ve §10 adım 3. Geçiş öncesi doğrulama `curl --resolve` ile doğrudan sunucuya yapılır |
| Supabase'te migration'a girmemiş şema değişikliği | §5 karşılaştırması + düzeltici migration; Supabase açılamazsa depo içi uyum + kabul edilen risk |
| `master` push'unun eski API'yi yeniden açması (R1) | Geçiş adım 1 |
| Sunucuda derleme sırasında bellek baskısı (canlı Postgres ile ortak, 4 GB) | ADR-0018: sıralı derleme, Node heap sınırı, sınırlı builder, düşük trafik saati; D14 ölçümü; gerekirse geçici swap ADR'si |
| Seed uç noktasının açık kalması (hız sınırı yok) | Geçiş adım 4: `ADMIN_SEED_SECRET` boşaltılır |
| Cloudflare arkasında yanlış istemci IP'si | ADR-0010 + G14-K7 |
| Staging'in canlıyla aynı Postgres/Redis'i paylaşması | Rol ve `CONNECT` ayrımı; Redis için G19 (ilk müşteriden önce) |
| Kiracı izolasyonunun yalnız uygulama filtresinde olması | T-B1 (ilk müşteriden önce, hukuk-uyum güçlü öneri) |

## 13. Kurucudan beklenenler

**Yanıtlananlar:** Cloudflare (K2), SMS, Telegram, hesaplar, geçiş zamanı, **S6 (veri demo; taşınmayacak)**, test artıklarının silinmesi.

**Hâlâ açık:**
1. **Zaman sınırlı:** `beautyos-dev` 7 gün içinde yeniden duraklar. Bu süre içinde `.env.supabase` yazılıp §5.1 komutu çalıştırılmalı.
2. ~~`/debug`~~ kapandı (10-28).
3. **S1:** `www` kullanılıyor mu, apex'e yönlensin mi? Başka alt alan adı var mı?
4. **S3:** GitHub'daki `DATABASE_URL` sırrı hangi veritabanını gösteriyor (CI)?
5. **S5:** `JWT_SECRET` ve dış servis anahtarları yenilensin mi (öneri: evet)?
6. **S7:** Sentry geçişte kapalı mı kalsın, yoksa G5-K5 + AB bölgesiyle mi açılsın?
7. B2 ve Healthchecks hesapları açılınca devops'a bildirim; hesaplarda 2FA.
8. **Deploy key (ADR-0018):** sunucuda `ssh-keygen -t ed25519` ile anahtar üretilir, açık anahtar GitHub'da depo ayarlarından "Deploy keys" bölümüne **yazma izni olmadan** eklenir. Ayrıca imaj temizleme kuralı onaylanır: son 3 sürüm tutulur, kullanımdakiler hiç silinmez.
