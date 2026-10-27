# BeautyOS — Şirket Sunucusuna Taşıma Planı

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Durum:** taslak, kurucu onayı bekliyor
- **Kurucu kararı:** Veritabanı dahil her şey şirket sunucusuna (`sirket-sunucu-1`, DO FRA1, 209.38.237.171) taşınır. Gerçek kullanıcı yok, ama veritabanındaki veri korunur.
- **Girdi:** `docs/mevcut-durum.md` (bulgular, riskler R1–R14). **Kararlar:** `docs/kararlar.md` (ADR-0002 … ADR-0015). **Görevler:** `docs/gorevler.md` (G1 … G18).
- **İşaretler:** `[ONAY]` = kurucu onayı olmadan yapılmaz (müdür toplar). **VARSAYIM** = doğrulanmamış; doğrulayan görev yanında yazılı.

---

## 1. Hedef mimari

```
İnternet ──▶ Cloudflare (DNS + proxy, Full strict) ──▶ sirket-sunucu-1 :443
                                                         │
                                       ┌─────────────────┴──────────────────┐
                                       │ caddy (ortak, sunucu-altyapi)      │  ağ: proxy (external)
                                       │ DNS-01 sertifika, CF gerçek IP     │
                                       └──────┬──────────────────┬──────────┘
            beautyossapp.com, app., www. ─────┘                  └───── api.beautyossapp.com
                         │                                                    │
               ┌─────────▼─────────┐                              ┌───────────▼───────────┐
               │ web (Next.js 14   │   (tarayıcı API'ye doğrudan  │ api (Express + Prisma │
               │ standalone, :3000)│    api.beautyossapp.com ile  │ + BullMQ işçisi, :3001)│
               └───────────────────┘    gider)                    └─────┬───────────┬─────┘
                                                        ağ: beautyos_icsel  │           │
                                                               ┌────────────▼──┐  ┌─────▼─────┐
                                                               │ postgres 17   │  │ redis 7.4 │
                                                               └───────────────┘  └───────────┘
```

**Compose projesi `beautyos`** (sunucuda `/srv/beautyos/compose.yml`, kaynağı depoda `deploy/compose.yml`; yazımı `gelistirici` tarafından `tasima/docker` dalında sürüyor):

| Servis | İmaj | Ağlar | Port yayını | env dosyası | Not |
|---|---|---|---|---|---|
| `web` | `ghcr.io/ahmeetkarateke/beautyos-web:<sha>` | `icsel`, `sirket-proxy` (takma ad `beautyos-web`) | yok | yok (gizli değer yok; `NEXT_PUBLIC_*` derlemede gömülü) | `read_only`, `tmpfs: /tmp, .next/cache` |
| `api` | `ghcr.io/ahmeetkarateke/beautyos-api:<sha>` | `icsel`, `sirket-proxy` (takma ad `beautyos-api`) | yok | `.env` | BullMQ işçisi aynı süreçte, **tek kopya**, `TZ=UTC` (ADR-0006) |
| `postgres` | `postgres:17.x-alpine` (sabit küçük sürüm) | `icsel` | **yok** | `.env.db` | volume `pgdata`; ilk açılışta `deploy/postgres/init/01-roller.sh` rolleri kurar |
| `redis` | `redis:7.4.x-alpine` | `icsel` | **yok** | `.env.redis` | volume `redisdata`; `appendonly yes`, `maxmemory 128mb`, `maxmemory-policy noeviction` (BullMQ şartı), parola zorunlu |
| `migrate` | api imajı | `icsel` | yok | `.env.migrate` | `profiles: [migrate]`; `prisma migrate deploy`; yalnız elle `[ONAY]` |
| `requeue` | api imajı | `icsel` | yok | `.env` | `profiles: [araclar]`; hatırlatmaları yeniden kuyruğa alır (G6); yalnız elle |

Tüm servislerde `docker-yayinlama` skill'inin kuralları geçerli: `restart: unless-stopped`, `healthcheck`, `depends_on: condition: service_healthy`, `security_opt: no-new-privileges`, `cap_drop: [ALL]` (postgres/redis için gereken en az yetenekle), bellek/cpu sınırı, `logging` (daemon zaten 10m×3). **ADR-0004 (sunucu-altyapi):** Caddy dışında hiçbir servis port yayınlamaz.

**Ayrı worker servisi yok** (ADR-0006). İşçi API sürecinde kalır; ayırmak kod değişikliği ister ve şu yükte gerekmez.

**Ortak Caddy** (kaynağı `projeler/sunucu-altyapi`, sunucuda `/srv/caddy`, sahibi devops; kurulumu sürüyor): özel imaj (`caddy-dns/cloudflare` + `WeidiDeng/caddy-cloudflare-ip` eklentileri, sabit sürüm), `0.0.0.0:80`, `0.0.0.0:443` (tcp+udp), ortak Docker ağı `sirket-proxy`. Site dosyaları `/srv/caddy/siteler/*.caddy` içinden `import` edilir. BeautyOS'unki `beautyos.caddy`: kaynağı bu depoda `deploy/` altında (`gelistirici`), sunucuya devops kopyalar. Taslak:

```
# Genel ayarlar (Caddyfile başı)
{
  email <kurucunun ACME e-postası>
  servers {
    trusted_proxies cloudflare { interval 12h }   # yalnız Cloudflare IP aralıklarına güven
    client_ip_headers CF-Connecting-IP
  }
}
(cf_dns) { tls { dns cloudflare {env.CF_API_TOKEN} } }

# siteler/beautyos.caddy
beautyossapp.com, www.beautyossapp.com, app.beautyossapp.com {
  import cf_dns
  reverse_proxy beautyos-web:3000 { header_up X-Forwarded-For {client_ip} }
}
api.beautyossapp.com {
  import cf_dns
  respond /debug* 404                                   # R3: kod düzeltilene kadar
  reverse_proxy beautyos-api:3001 { header_up X-Forwarded-For {client_ip} }
}
```

`www` yönlendirmesi (apex'e 301 mi, aynı içerik mi) kurucu cevabına bağlı (Soru S1).

**Sunucudaki dosya düzeni:**

```
/srv/beautyos/                  deploy/ içeriği (git archive ile, sunucu-altyapi yöntemiyle)
  compose.yml
  postgres/init/01-roller.sh    postgres/postgresql.conf
  betikler/veri-aktar.sh        betikler/veri-dogrula.sh
  .env  .env.db  .env.migrate  .env.redis  .env.supabase   (kurucu yazar, chmod 600; ajanlar okumaz)
  tasima/                       (chmod 700) döküm dosyaları ve sayım çıktıları; kapatma sonrası silinir [ONAY]
/srv/caddy/                     ortak Caddy (+ .env.caddy: CF_API_TOKEN), siteler/beautyos.caddy
```

Yol düzeni (`/srv`) devops ve gelistirici ile hizalıdır.

## 2. Bellek ve kaynak bütçesi (4 GB RAM + 2 GB swap, 2 vCPU)

| Bileşen | Sınır (compose) | Beklenen kullanım | Ayar |
|---|---|---|---|
| İşletim sistemi, dockerd, containerd, do-agent, fail2ban, journald | — | 450–600 MB | — |
| caddy (ortak) | 128 MB | 30–50 MB | — |
| web (Next.js standalone) | 384 MB | 120–200 MB | `NODE_OPTIONS=--max-old-space-size=256` |
| api + işçi (Node 20, Prisma motoru) | 512 MB | 180–300 MB | `NODE_OPTIONS=--max-old-space-size=320`, cpu 1.0 |
| postgres 17 | 768 MB | 250–400 MB | `shared_buffers=192MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=40`, `shm_size: 128mb` |
| redis | 192 MB | 10–30 MB | `maxmemory 128mb` |
| Gece yedek işi (geçici) | 256 MB | ~100 MB | pg_dump + restic |
| **Toplam** | **~2,0 GB sınır** | **~1,1–1,6 GB** | |

**Sonuç: 4 GB yeter.** BeautyOS sınırlarının toplamı ~2 GB. Geriye ~2 GB kalır: sayfa önbelleği ve gelecekteki 1–2 küçük proje için. Koşullar:
- **İmajlar sunucuda derlenmez** (ADR-0012). `next build` 1,5–2 GB ister; canlı Postgres'le aynı makinede derlemek OOM ve swap riskidir.
- Her yeni müşteri projesi kendi Postgres'iyle gelirse 3. projede 4 GB sıkışır. O zaman ya droplet 8 GB'a büyütülür ya da ortak Postgres (proje başına ayrı veritabanı + rol) için yeni ADR yazılır. İzleme eşiği §9'da.
- Disk: imajlar (eski sürüm dahil) ~2 GB, veritabanı < 1 GB, yerel yedek kopyası (7 gün) küçük. 80 GB fazlasıyla yeter.

## 3. Alan adı, DNS ve SSL (Cloudflare)

Kurucu bilgisi: `beautyossapp.com` Cloudflare'den alındı, DNS Cloudflare'de.

**Joker sertifika gerekmez.** Kiracılar alt alan adıyla değil yolla ayrılıyor (`/tenant/[slug]`, `/book/[slug]`). CORS'taki `*.beautyossapp.com` izni yalnız `app`/`www`/`test` gibi sabit hostlar içindi (commit `9614458` mesajı). Hostlar: `beautyossapp.com`, `app.beautyossapp.com`, `www.beautyossapp.com` (VARSAYIM, S1), yeni `api.beautyossapp.com`, prova için geçici `yeni.beautyossapp.com`. İleride kiracı alt alan adı istenirse aynı DNS-01 düzeniyle `*.beautyossapp.com` sertifikası tek satırla eklenir.

Kararlar (ayrıntı ve alternatifler `docs/kararlar.md`):
- **ADR-0008: Cloudflare proxy açık (turuncu bulut), SSL modu Full (strict).** Origin IP gizlenir, DDoS koruması gelir, statik dosyalar önbelleğe alınır. Full (strict) Vercel için de güvenli; geçişten önce açılabilir. Bot Fight Mode **kapalı** kalır: ücretsiz planda kural ile atlanamaz ve Telegram/NetGSM çağrılarını engelleyebilir. **Koşul:** `hukuk-uyum` Cloudflare'in TLS sonlandırmasını (kişisel veri geçişi) onaylar. Onaylamazsa gri buluta geçilir; Caddy düzeni değişmeden çalışır.
- **ADR-0009: Sertifikalar ACME DNS-01 ile (`caddy-dns/cloudflare`).** Proxy açıkken de çalışır. DNS kaydı henüz Vercel'i gösterirken sertifika alınabilir, bu yüzden geçiş anında sertifika bekleme yok. Token: Cloudflare'de **yalnız `Zone:DNS:Edit` yetkili, yalnız `beautyossapp.com` zonuna sınırlı** API token. Kurucu oluşturur ve `/srv/caddy/.env.caddy` dosyasına `CF_API_TOKEN` olarak yazar.
- **ADR-0010: Gerçek istemci IP'si.** Caddy `CF-Connecting-IP` başlığını yalnız Cloudflare IP aralıklarından gelen bağlantıda kabul eder (`trusted_proxies cloudflare`). Upstream'e `X-Forwarded-For: {client_ip}` olarak tek değer yollar. Express'teki `trust proxy 1` böylece doğru IP'yi görür; kod değişmez. Doğrudan IP'ye gelen istekte başlık yok sayılır, sahte IP enjekte edilemez.
- **ADR-0011: 80/443 güvenlik duvarında Cloudflare'e kısıtlanmaz.** Sunucu ortak; Cloudflare kullanmayan müşteri alan adları da gelecek. İsteğe bağlı sonraki adım: Caddy'de yalnız BeautyOS hostları için "Cloudflare dışı kaynağa 403" kuralı. Geçişten 2 hafta sonra, yeni ADR ile değerlendirilir.

DNS kayıtları (hepsi kurucu tarafından Cloudflare panelinden, `[ONAY]`):

| Ne zaman | Kayıt | Değer | Proxy |
|---|---|---|---|
| Aşama 2 başı | **Zone dışa aktarımı** (DNS > Records > Export) | `sirket/` dışında, kurucunun arşivine | — |
| Aşama 3 | `api` A | 209.38.237.171 | turuncu |
| Aşama 3 | `yeni` A (geçici, prova web) | 209.38.237.171 | turuncu |
| T-48 saat | `@`, `app`, `www` kayıtlarının TTL'i (gri iseler) | 60 sn | — |
| Geçiş günü | `@`, `app`, `www` | A 209.38.237.171 (Vercel kayıtları silinmez, yeni değerle değişir; eski değerler dışa aktarımda) | turuncu |
| Geçiş +14 gün | `yeni` | silinir | — |

Dokunulmayacaklar: MX, Resend SPF/DKIM/DMARC TXT kayıtları, Turnstile. CAA kaydı varsa `letsencrypt.org` (ve Cloudflare'in kendi CA'ları) izinli olmalı (S2).

**TTL notu:** Kayıt zaten turuncu ise Cloudflare değişikliği anında uygular; TTL "Auto" kalır. Kayıt gri ise (Vercel'in önerdiği kurulum budur) istemciler eski Vercel IP'sini TTL süresince önbellekte tutar. Bu yüzden T-48 saatte TTL 60 saniyeye düşürülür.

## 4. Gizli bilgi dosyaları

Şirket kuralı: değerler yalnız `.env` / `.env.<ortam>` dosyalarında. Kurucu yazar, ajanlar okumaz. Adlar ve açıklamalar kökteki `.env.example` dosyasında.

| Dosya | Kim yükler | İçerik (yalnız adlar) |
|---|---|---|
| `.env` | `api`, `requeue` | `DATABASE_URL` + `DIRECT_URL` (ikisi de `app_user`), `REDIS_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `PUBLIC_URL`, `FRONTEND_URL`, Telegram/Gemini/NetGSM/Resend/Turnstile/Sentry anahtarları |
| `.env.db` | `postgres` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `APP_OWNER_PASSWORD`, `APP_USER_PASSWORD` |
| `.env.migrate` | `migrate` | `MIGRATION_DATABASE_URL` (`app_owner`). Migrate komutu bunu Prisma'nın beklediği `DATABASE_URL`/`DIRECT_URL` adlarına yalnız kendi sürecinde aktarır |
| `.env.redis` | `redis` | `REDIS_PASSWORD` (aynı değer `.env` içindeki `REDIS_URL`'de) |
| `.env.supabase` | yalnız `veri-aktar.sh` | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`. Bağlantı bilgisi komut satırına hiç girmez (`ps` çıktısında görünmez). Kapatma sonrası silinir |
| `/srv/caddy/.env.caddy` | caddy | `CF_API_TOKEN` |

`MIGRATION_DATABASE_URL` asla `.env` içine yazılmaz (skill kuralı). Yayın öncesi kontrol listesinde kurucu bunu teyit eder.

`JWT_SECRET`: yeni değer önerilir (S10). Gerçek kullanıcı yok, herkes yeniden giriş yapar. Eski değer üç dış platformda saklanmış oldu.

## 5. Veri taşıma (PostgreSQL)

**Yöntem (ADR-0004):** Bakım penceresinde tek seferlik mantıksal kopya: `pg_dump -Fc` → `pg_restore`. Mantıksal replikasyon ya da sürekli eşitleme yok; veri küçük ve kullanıcı yok, yazmayı durdurup kopyalamak yeter.

**Kim çalıştırır:** Kaynak bağlantı bilgisi gizli; ekip `.env` okuyamaz. Bu yüzden **betiği kurucu çalıştırır.** Betik `deploy/betikler/veri-aktar.sh` (G12, gelistirici yazar, denetçi inceler) sunucuda tek seferlik `postgres:17` konteyneri açar ve `--env-file /srv/beautyos/.env.supabase` ile libpq ortam değişkenlerini alır. Çıktıya yalnız sürüm, tablo adları, satır sayıları ve özetler yazar; bağlantı bilgisi ve satır içeriği yazmaz. Kurucu tek komut çalıştırır:

```
ssh karateke@209.38.237.171 'bash /srv/beautyos/betikler/veri-aktar.sh <alt-komut>'
```

Alt komutlar:

1. **`on-kontrol`** (yalnız okur, kaynakta):
   - `SELECT version()` ile kaynak ana sürümü alınır. Hedef `postgres:17`; kaynak 17'den büyükse durur (ADR-0003).
   - `public` şemasında RLS'i açık tablo ve politika listesi. Varsa durur ve rapor eder.
   - `public` dışı nesnelere bağımlılık: `extensions.`/`auth.`/`storage.` geçen sütun varsayılanları, fonksiyon, trigger ve view. Varsa durur.
   - Tablo başına satır sayısı → `tasima/kaynak-sayim-<zaman>.txt`.
   - Bağlantı yolu: Supabase **Session pooler** (IPv4, 5432) önerilir. Doğrudan host (`db.<ref>.supabase.co`) yalnız IPv6 verir; droplet'te IPv6 kapalı olabilir. **Transaction pooler (6543) kullanılmaz.** (VARSAYIM; `on-kontrol` ilk denemede belli eder.)
2. **`dok`**: `pg_dump --format=custom --schema=public --no-owner --no-privileges --no-publications --no-subscriptions` → `tasima/beautyos-<zaman>.dump` (chmod 600). `_prisma_migrations` tablosu da `public`'te olduğu için dökümde gelir.
3. **`yukle`**: Hedefte `public` boş değilse durur (üzerine yazmaz). `pg_restore -l` listesinden `SCHEMA public` ve `COMMENT ON SCHEMA public` girdileri çıkarılır (hedefte şema zaten var). Ardından:
   ```
   docker compose exec -T postgres pg_restore -U app_owner -d beautyos --no-owner --role=app_owner --exit-on-error --single-transaction -L <liste>
   ```
   Konteyner içi yerel soket kullanılır, parola gerekmez. Nesnelerin sahibi `app_owner` olur. `01-roller.sh`'deki `ALTER DEFAULT PRIVILEGES` sayesinde `app_user` otomatik olarak DML yetkisi alır. Sonra `ANALYZE`.
4. **`dogrula`** (`veri-dogrula.sh`, hedefte; devops da çalıştırabilir, gizli bilgi okumaz):
   - Tablo başına satır sayıları kaynak dosyasıyla birebir eşit olmalı.
   - `tenants`, `users`, `customers`, `appointments` için `md5(string_agg(id::text, ',' ORDER BY id))` özeti eşit olmalı (kaynak özeti `on-kontrol`/`dok` adımında alınır).
   - `docker compose --profile migrate run --rm migrate npx prisma migrate status` → "Database schema is up to date".
   - `app_user` ile `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user` → ikisi de `false`.

**Roller (ADR-0003, `coklu-kiraci-veritabani` §2):**
- `POSTGRES_USER` süper kullanıcıdır; yalnız ilk kurulumda kullanılır.
- `app_owner` tabloların sahibidir, migration'ları çalıştırır.
- `app_user`: `NOSUPERUSER NOBYPASSRLS`, yalnız `SELECT/INSERT/UPDATE/DELETE` + dizi kullanımı.
- Bugün RLS olmadığı için rol ayrımının asıl faydası, uygulamanın DDL ve rol yetkisi taşımamasıdır. RLS projesi (T-B1) geldiğinde zemin hazır olur.

**Supabase sürüm/uyum doğrulaması:** Prisma 5.22 ile PostgreSQL 17 resmî destek listesinde açıkça yazmayabilir. G1, CI testlerini `postgres:17` servis konteynerinde çalıştırarak bunu kanıtlar. Kalırsa hedef 16'ya iner, ama yalnız kaynak ≤ 16 ise (ADR-0003 doğrulama kaydı).

## 6. Redis verisi taşınmaz (ADR-0005)

Upstash'te yalnız BullMQ işleri var: gecikmeli hatırlatmalar ve tekrarlı gece işi. Gerçek kullanıcı olmadığı için veri kopyalanmaz; Upstash TLS/RDB dökümü ile uğraşmaya değmez. Gelecekteki randevuların hatırlatmalarını kaybetmemek için:
- **G6:** `apps/api/scripts/requeue-reminders.ts`. Durumu `pending/confirmed/in_progress` olan ve başlangıcı gelecekte olan randevular için 24 saat ve 2 saat işlerini **aynı belirlenimci jobId'lerle** ekler. Bu yüzden iki kez çalışsa da çift iş oluşmaz. `--dry-run` yalnız sayı yazar.
- Gece no-show işi API açılışında kendiliğinden yeniden kaydolur.
- Prova sonrası Redis volume'u sıfırlanır (§11). Provada eklenen işler canlıya taşınmaz.

## 7. CI/CD (ADR-0012)

- **Derleme:** GitHub Actions, yeni `.github/workflows/imaj.yml` (G7). Tetik `workflow_dispatch` ve `v*` etiketleri. `apps/api/Dockerfile` ile `apps/web/Dockerfile` derlenip `ghcr.io/ahmeetkarateke/beautyos-{api,web}:<sha-12>` olarak **özel** GHCR'a itilir. Web derleme argümanları (`NEXT_PUBLIC_*`) gizli değildir; GitHub **repository variables**'tan gelir. İş akışının yetkisi yalnız `contents: read`, `packages: write`. Sunucuya SSH anahtarı **verilmez**.
- **Yayın:** devops sunucuda compose dosyasındaki imaj etiketini değiştirir, `docker compose pull && docker compose up -d` çalıştırır (skill §4). Önceki etiket geri alma için not edilir. Push = otomatik canlıya alma **artık olmaz**. Canlıya alma denetçi ONAY'ı + test GEÇTİ sonrası, elle yapılır.
- **Sunucunun GHCR erişimi:** kurucu yalnız `read:packages` yetkili bir token ile sunucuda bir kez `docker login ghcr.io` yapar `[ONAY]`. Token `~/.docker/config.json`'da şifrelenmeden (base64) durur. Bu kabul edilen bir risktir; token yalnız okur.
- **Alternatif (yedek plan):** GHCR özel paket ücreti ya da kotası sorun çıkarırsa sunucuda `git pull` + `docker compose build` yapılır. Bu yalnız gece ve web için `--memory` sınırıyla mümkündür; ADR-0012 doğrulama kaydı.
- **CI testleri (G1):** `ci.yml` dış `secrets.DATABASE_URL` yerine `postgres:17` servis konteyneri kullanır, testlerden önce `prisma migrate deploy` çalıştırır. Mevcut `redis` servis konteyneri kalır.
- **Dikkat:** `tasima/sunucu` dalının GitHub'a push'u `[ONAY]`. Vercel varsayılan olarak her dal için preview derlemesi yapar; bu zararsızdır, prod'u etkilemez. Railway yalnız bağlı dalı (`master`/`staging`) dağıtır.

## 8. Staging (ADR-0013)

Sunucuda kalıcı staging **kurulmaz**: bellek bütçesini ikiye katlar, gerçek kullanıcı yokken getirisi düşük. Doğrulama zinciri şöyle:
- Yerelde ya da CI'da testler (gerçek Postgres 17 + Redis).
- Denetçi ONAY'ı.
- Yalnız gerekince, aynı sunucuda **isteğe bağlı** `beautyos-staging` compose projesi: ayrı volume'lar, `staging.beautyossapp.com`, Caddy basic auth, iş bitince durdurulur.

Mevcut Supabase staging projesi, Railway staging ve Vercel preview kapatılır. Staging verisi taşınmaz (VARSAYIM, S3). `staging` dalı yalnız CI için kalır.

## 9. Yedekleme ve izleme: geçişten ÖNCE hazır olmalı

Geçiş günü kontrol listesinde bu üç madde işaretli değilse geçiş yapılmaz.

**Yedekleme (G9, sunucu-altyapi; ADR-0015):**
- Her gece 03:15 (TR; 04:00 otomatik yeniden başlatmadan önce) `docker compose exec -T postgres pg_dump -Fc -U app_owner beautyos` çıktısı `restic` ile **Backblaze B2 AB bölgesine (eu-central)** gider. Şifreleme istemci tarafında yapılır; restic parolası sunucuda `.env.yedek` dosyasında ve kurucunun parola yöneticisinde durur.
- Saklama: 7 günlük, 4 haftalık, 6 aylık (VARSAYIM; `hukuk-uyum` onaylar, `docs/kvkk.md`).
- Redis yedeklenmez (G6 betiğiyle yeniden kurulabilir). Caddy sertifika volume'u yedeklenmez (yeniden alınır).
- **Geri yükleme denemesi zorunlu:** son yedek geçici bir `postgres:17` konteynerine açılır, `veri-dogrula.sh` satır sayıları eşleşir. Sonuç `sirket/sunucu.md` "Çalışan servisler" tablosuna yazılır.
- Başarısız yedek → Telegram uyarısı (aşağıdaki izleme kanalı).
- İsteğe bağlı ek: DigitalOcean haftalık droplet yedeği (+%20 ücret, S8).

**İzleme (G10):**
- UptimeRobot (kurucu hesabı, README'de zaten var), 3 dakikada bir şunları yoklar: `https://api.beautyossapp.com/health` (200 + `"status":"ok"`), `https://app.beautyossapp.com/login`, `https://beautyossapp.com/`. Uyarı Telegram'a + e-postaya gider.
- Yedek işi için "kalp atışı" izlemesi: UptimeRobot heartbeat ya da healthchecks.io. İş bittiğinde ping atar, ping gelmezse uyarı verir.
- DigitalOcean uyarı politikaları: CPU > %80 (10 dk), bellek > %85 (10 dk), disk > %80. Bellekte kalıcı > %85 ya da sürekli swap kullanımı, büyütme kararı demektir (§2).
- Sentry aynen kalır.
- Sertifika bitiş takibi: Caddy kendisi yeniler. UptimeRobot SSL uyarısı açılır.

**KVKK ve yurt dışı aktarım (`hukuk-uyum` doğrulamalı; mimar kararı değil):**
- DigitalOcean FRA1 Almanya'dadır. Bu da yurt dışı aktarımdır; Supabase AB, Vercel, Railway ve Upstash da öyleydi. Taşıma, veri işleyen sayısını azaltır ama aktarımı ortadan kaldırmaz.
- Doğrulanacaklar: (1) DO FRA1 barındırma, (2) B2 AB bölgesine şifreli yedek, (3) Cloudflare proxy'nin TLS sonlandırması, (4) mevcut Gemini/Sentry/Resend/NetGSM akışları.
- Anamnez (sağlık/alerji) verisi özel nitelikli kişisel veridir.
- Döküm dosyaları (`/srv/beautyos/tasima/`) kişisel veri içerir: chmod 700, kapatma sonrası silinir `[ONAY]`.

## 10. Aşamalar ve onay noktaları

| Aşama | İçerik | Görevler | Kurucu onayı gereken noktalar |
|---|---|---|---|
| **0. Karar** | Soruların cevabı, hukuk-uyum görüşü, plan onayı | — | Planın onayı; Cloudflare proxy tercihi; B2/UptimeRobot/DO yedek ücretleri |
| **1. Uygulama hazırlığı** | Dockerfile'lar, standalone web, güvenlik düzeltmeleri, requeue betiği, imaj iş akışı, CI'da Postgres 17 | G1–G7 (gelistirici) → denetci | `tasima/sunucu` dalının GitHub'a push'u; GHCR okuma token'ı |
| **2. Altyapı** | Ortak Caddy, yedekleme, izleme | G8–G10 (devops) → denetci | Cloudflare API token'ı; 80/443'te Caddy'nin açılması; B2 hesabı ve bucket; zone dışa aktarımı |
| **3. Kuru prova** | Compose yığını güvenli kipte, verinin ilk kopyası, kabul testi | G11–G14 | `api`/`yeni` DNS kayıtları; prova veritabanına veri yükleme; migrate çalıştırma |
| **4. Geçiş günü** | §12 adımları | G15–G16 | Tüm runbook: Railway durdurma, son kopya, gerçek kipe geçiş, DNS değişikliği |
| **5. Gözlem + kapatma** | 14 gün izleme, sonra eski servislerin silinmesi | G17 | Her silme ayrı ayrı (Railway, Vercel, Supabase prod/staging, Upstash, GitHub sırları, döküm dosyaları) |
| **6. Sonrası** | Node 22/24, RLS projesi, Next.js yükseltmesi, Railway/Vercel dosyalarının silinmesi | G18 + T-B1 | Ayrı planlama |

## 11. Kuru prova (Aşama 3): güvenli kip

Amaç: geçiş gününden önce yığının, veri kopyasının ve uygulamanın uçtan uca çalıştığını görmek. **Canlı sistemi hiçbir şekilde etkilememeli.**

- `.env` güvenli kipte: `NETGSM_USERCODE`/`NETGSM_PASSWORD` **boş** (Mock SMS sağlayıcısı devreye girer), `TELEGRAM_BOT_TOKEN` **boş** (webhook çalınmaz), `RESEND_API_KEY` **boş**, `WHATSAPP_360DIALOG_API_KEY` boş, `GEMINI_API_KEY` boş. `PUBLIC_URL=https://api.beautyossapp.com`, `FRONTEND_URL=https://yeni.beautyossapp.com`, `ALLOWED_ORIGINS` içinde `https://yeni.beautyossapp.com`.
- Turnstile: gerçek anahtarlar. Kurucu, widget host listesine `yeni.beautyossapp.com`'u ekler (alt alan adlarını kendiliğinden kapsıyor olabilir; VARSAYIM, provada görülür).
- Prova web imajı `NEXT_PUBLIC_API_URL=https://api.beautyossapp.com` ile derlenir. Aynı imaj canlıda da kullanılır; API adresi değişmiyor.
- Sıra: `docker compose up -d postgres redis` → `veri-aktar.sh on-kontrol | dok | yukle` (kurucu) → `veri-dogrula.sh` → `docker compose up -d api web` → `requeue --dry-run` ve gerçek çalıştırma (Mock) → test mühendisi kabul testi (G14).
- **Prova bitince sıfırlama `[ONAY]`:** `api`/`web` durdurulur. `DROP DATABASE beautyos; CREATE DATABASE beautyos OWNER app_owner;` (roller kalır). Redis volume'u silinip yeniden açılır. Bu, provadaki test kayıtlarının ve Mock işlerinin canlıya taşınmamasını sağlar.

## 12. Geçiş günü adımları (runbook)

**Zaman:** düşük trafik saati. 03:00–04:30 arası değil (yedek + otomatik yeniden başlatma), 23:15–23:45 arası değil (gece no-show işi). Tahmini süre 45–60 dk.

**Ön koşullar** (hepsi ✔ olmadan başlanmaz):
- G1–G14 tamam.
- Denetçi ONAY'ı (kod + compose + betikler).
- Test GEÇTİ (prova).
- Yedek işi en az bir kez çalışmış ve geri yükleme denenmiş.
- UptimeRobot ve DO uyarıları açık.
- Zone dışa aktarıldı; TTL 60 sn'ye inmiş (T-48 saat).
- NetGSM IP izni eklenmiş (S6).
- `MIGRATION_DATABASE_URL`'in `.env`'de olmadığı teyit edildi.

| # | Kim | Adım | Doğrulama |
|---|---|---|---|
| 0 | kurucu | **Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımını kapat** (R1) | Panelde "auto deploy" kapalı |
| 1 | kurucu | Railway prod API servisini durdur (aktif dağıtımı kaldır, **silme**). Staging aynı bot token'ını kullanıyorsa onu da durdur | `https://beautyosapi-production.up.railway.app/health` yanıt vermiyor. Kaynakta yazma durdu |
| 2 | devops | Sunucuda `api`/`web` durmuş, hedef veritabanı ve Redis boş (prova sıfırlandı) | `veri-dogrula.sh --bos-mu` |
| 3 | kurucu | `veri-aktar.sh on-kontrol` → `dok` → `yukle` | Çıktıda hata yok |
| 4 | devops | `veri-dogrula.sh` | Satır sayıları ve özetler eşit; migrate status güncel; `app_user` süper değil |
| 5 | kurucu | `.env`'i gerçek kipe al: NetGSM, Telegram, Resend, Gemini, (WhatsApp) değerleri; `FRONTEND_URL=https://app.beautyossapp.com`; `ALLOWED_ORIGINS`'ten `yeni` çıkar | Devops içeriği görmez; kurucu "tamam" der |
| 6 | devops | `docker compose up -d api web` | `docker compose ps` hepsi healthy; log'da "Telegram bot hazır" ve webhook adresi `api.beautyossapp.com` |
| 7 | devops | `requeue --dry-run`, sonra gerçek çalıştırma | Gelecekteki randevu sayısı × 2'ye kadar iş eklendi |
| 8 | kurucu | Cloudflare: `@`, `app`, `www` → A 209.38.237.171, turuncu | `curl -sI https://app.beautyossapp.com` → `server: cloudflare`, 200 |
| 9 | test-muhendisi + kurucu | Canlı duman testi (G16): giriş, takvim, randevu oluşturma, herkese açık randevu (Turnstile), kurucunun kendi numarasına test SMS'i, Telegram bota mesaj, şifre sıfırlama e-postası | Hepsi geçti |
| 10 | devops | İlk 60 dk izleme (skill §6); `sirket/sunucu.md` işlem günlüğü ve "Çalışan servisler" satırı | Kayıt yazıldı |

## 13. Geri dönüş planı (eski sistem 14 gün açık)

Eski sistem silinmez, **durdurulmuş** bekler: Railway servisi durmuş ama silinmemiş; Vercel projesi duruyor, Git bağlantısı kesik; Supabase prod verisi geçiş anındaki haliyle duruyor; Upstash duruyor.

**Geri dönüş ölçütü** (müdür kurucuya önerir, karar kurucunun):
- Giriş ya da randevu akışı 60 dakika içinde düzeltilemeyecek şekilde bozuk, veya
- Veri tutarsızlığı var, veya
- Sunucu kaynağı yetmiyor (kalıcı OOM).

Adımlar, hepsi `[ONAY]`:
1. kurucu: Cloudflare'de `@`/`app`/`www`'yu dışa aktarımdaki Vercel değerlerine geri al.
2. devops: `docker compose stop api web`. İşçi durur, çift SMS olmaz.
3. Geçişten sonra yazılan veri:
   - **(a)** Kayıp kabul edilir (gerçek kullanıcı yokken varsayılan), **veya**
   - **(b)** Ters kopya: aynı betik `--ters` ile yeni `public` dökülür, Supabase `public` boşaltılıp yüklenir. Yıkıcıdır; ayrı onay gerekir. Provada bir kez denenir (G13).
4. kurucu: Railway prod servisini son dağıtımdan yeniden başlat. API açılışta Telegram webhook'unu eski adrese kendisi kaydeder.
5. test: giriş + randevu duman testi. Olay `sirket/sunucu.md`'ye yazılır, ders ekip hafızasına eklenir.

Not: Geri dönüşten sonra yeni sunucudaki veri silinmez; neden araştırılıp ikinci deneme planlanır.

## 14. Eski servislerin kapatılması (Aşama 5, geçiş +14 gün)

Her madde ayrı `[ONAY]`, sırayla:
1. Supabase prod'un son dökümü restic ile B2'ye "arşiv" etiketiyle alınır. Saklama süresi `hukuk-uyum`'dan gelir.
2. Railway projesi (prod + staging) silinir.
3. Vercel projesi silinir; alan adları Vercel'den kaldırılır.
4. Upstash veritabanı silinir.
5. Supabase prod ve staging projeleri silinir.
6. GitHub depo sırrı `DATABASE_URL` silinir (G1 sonrası kullanılmıyor).
7. Dış platformlarda saklanmış anahtarlar yenilenir: NetGSM API şifresi, Telegram bot token'ı (BotFather `/revoke`; yeni değer `.env`'e), Gemini, Resend, Turnstile gizli anahtarı (S10).
8. `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silinir.
9. `yeni` DNS kaydı silinir; Turnstile host listesinden çıkarılır.
10. Depodan Railway/Vercel kalıntıları (`Dockerfile` kökü, `railway.json`, `nixpacks.toml`, `apps/web/vercel.json`) ve README'deki eski adresler temizlenir (G18).

## 15. Toplam risk değerlendirmesi

**Genel: ORTA-DÜŞÜK.** Gerçek kullanıcı yok, veri küçük. Uygulama Supabase'e yalnız Postgres olarak bağlı (auth, storage, realtime yok). Web'de Vercel'e özgü özellik yok. Asıl riskler teknik değil, **iki sistemin aynı anda çalışmasıyla** ilgili ve runbook'la kapatılıyor:

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| Eski API'nin yeniden açılması (otomatik dağıtım) → çift SMS, webhook kapışması | Orta | Yüksek | Adım 0–1; geri dönüşte önce yeni yığın durdurulur |
| Provanın canlıyı etkilemesi (webhook, SMS) | Orta | Yüksek | Güvenli kip (§11) |
| Supabase'de panelden eklenmiş RLS/politika/uzantı bağımlılığı | Düşük | Orta | `on-kontrol` durur ve rapor eder |
| Supabase'e IPv6/pooler bağlantı sorunu | Orta | Düşük | Session pooler; provada görülür |
| Cloudflare arkasında istemci IP'sinin yanlış gelmesi → hız sınırının herkesi kilitlemesi | Orta | Orta | ADR-0010 + test (G14) |
| Yedek/izleme olmadan canlıya çıkmak | Düşük | Yüksek | §9 ön koşulları |
| Bellek yetmezliği | Düşük | Orta | İmajlar dışarıda derlenir; sınırlar; DO uyarıları |
| KVKK (yurt dışı, özel nitelikli veri) | — | Yüksek | `hukuk-uyum` onayı Aşama 0'da |
| Kod tarafında çok kiracılık yalnız uygulama filtresi (RLS yok) | Var olan durum | Yüksek | Taşımadan bağımsız; T-B1 |

## 16. Kurucuya sorular

1. **S1 – Hostlar:** Kullanılan alt alan adları hangileri: `app`, `www`, başka (`test`, `staging`)? `www` apex'e yönlensin mi? Kiracı başına alt alan adı planı var mı? (Kod yol tabanlı; plan joker sertifika gerektirmiyor.)
2. **S2 – Cloudflare:** Mevcut kayıtlar turuncu mu gri mi, SSL modu ne, CAA kaydı var mı? Cloudflare proxy'nin (turuncu) kullanılmasını onaylıyor musunuz (hukuk-uyum görüşüyle)?
3. **S3 – Supabase:** Prod ve staging dışında başka proje ya da şema var mı? Staging verisi korunmalı mı (varsayım: hayır)? Plan (free/pro) ve PostgreSQL sürümü?
4. **S4 – Diğer hesaplar:** Railway/Vercel/Upstash hesaplarında BeautyOS dışında proje var mı? (Yalnız BeautyOS projeleri silinecek.)
5. **S5 – CI:** GitHub'daki `DATABASE_URL` sırrı hangi veritabanını gösteriyor?
6. **S6 – SMS:** NetGSM API'de IP kısıtı var mı (varsa 209.38.237.171 eklenmeli)? Şu an gerçek SMS gidiyor mu?
7. **S7 – Bot:** Prod ve staging aynı Telegram bot token'ını mı kullanıyor? WhatsApp/360dialog aktif mi? Kiracılara özel bot token'ı girilmiş mi?
8. **S8 – Ücretler:** Backblaze B2 (AB) hesabı açılsın mı? DigitalOcean haftalık droplet yedeği (+%20) istiyor musunuz?
9. **S9 – Supabase Data API:** Taşıma süresince kapatılsın mı? (Kullanılmıyor; kapatmak riski sıfırlar.)
10. **S10 – Anahtarlar:** `JWT_SECRET` yenilensin mi (öneri: evet) ve kapatma aşamasında dış servis anahtarları yenilensin mi?
11. **S11 – Zaman:** Geçiş için tercih ettiğiniz gün ve saat aralığı?
