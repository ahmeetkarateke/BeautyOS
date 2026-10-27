# BeautyOS — Şirket Sunucusuna Taşıma Planı

- **Tarih:** 2026-10-27 (sürüm 3: 2026-10-28) · **Hazırlayan:** mimar · **Sürüm:** 3 (kurucu kararları işlendi; Supabase duraklatma riski ve iki veri kaynağı seçeneği eklendi) · **Durum:** kurucu kararları alındı; veri kaynağı seçimi (§5.1) bekliyor
- **Kurucu kararı:** Veritabanı dahil her şey şirket sunucusuna (`sirket-sunucu-1`, DO FRA1, 209.38.237.171) taşınır. Yalnız **canlı** Supabase verisi taşınır.
- **Girdiler:** `docs/mevcut-durum.md` (bulgular R1–R14), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum). **Kararlar:** `docs/kararlar.md`. **Görevler:** `docs/gorevler.md`.
- **İşaretler:** `[ONAY]` = kurucu onayı olmadan yapılmaz (müdür toplar). **VARSAYIM** = doğrulanmamış.

### Kurucu yanıtlarının plana etkisi (2026-10-27)

| Yanıt | Etki |
|---|---|
| `/debug` canlıda hemen kapatılıyor (ayrı hotfix) | G4a ayrı hotfix dalında, `master` push'u müdür + kurucu onayıyla. Caddy'deki `/debug*` 404 ikinci katman olarak kalır |
| Alt alan adları kullanılıyor; Cloudflare ayrıntıları ekran görüntüsüyle gelecek | Host listesi ve TTL adımı açık (S1, S2) |
| NetGSM SMS **kapalı**, geçişte de kapalı | Çift SMS riski (R2) düşük. Hatırlatma yeniden kuyruklama betiği **gereksiz**; G6 iptal |
| Telegram yalnız test ortamında, WhatsApp yok | Canlıda Telegram boş; mevcut bot staging'e (VARSAYIM, S4). Webhook kapışması riski düşük |
| Yalnız canlı Supabase verisi; staging taşınmaz | Değişiklik yok (planla aynı) |
| Başka proje yok; doğrulandıktan sonra doğrudan kapatılacak | Paralel bekleme 14 günden **3 güne** iner (kurucu onayıyla). Kapatmada "başka proje" kontrolü yok |
| Gerçek kullanıcı yok; geçiş her an yapılabilir | Ayrı kuru prova kaldırıldı. Veri betiği atılabilir bir veritabanında önceden denenir (G13); geçiş tek oturumda yapılır |
| Geliştirme bu sunucuda sürecek; kalıcı staging (`yeni`) | ADR-0016: aynı compose projesinde kalıcı staging, ortak Postgres/Redis örneğinde ayrı veritabanı/rol/Redis DB. Bellek bütçesi içinde |
| DO günlük droplet yedeği açık (7 gün); Backblaze ve Healthchecks hesapları açılıyor | Yedek düzenine ikinci katman olarak eklendi (§8) |

### Kurucu kararları (2026-10-28)

| No | Karar | Durum ve etki |
|---|---|---|
| K1 | Canlı `/debug` kapatılsın: EVET | Hotfix `master`'a push edildi (`9894212`), ama **Railway dağıtımı başarısız**; `/debug` hâlâ açık (müdür takipte). Muhtemel neden: API açılışta `SELECT 1` başarısız olursa `process.exit(1)` yapıyor (`src/index.ts`). Supabase duraklatılmışsa yeni dağıtım hiç ayağa kalkamaz, eski dağıtım çalışmaya devam eder. Bkz. §5.1 ve §12 |
| K2 | Cloudflare turuncu bulut ve ayarları: EVET | ADR-0008 ve ADR-0009 **kabul edildi**. Token oluşturuldu ve sunucuda doğrulandı; ortak Caddy çalışıyor |
| K3 | SMS kapalı | Plan v2 ile aynı |
| K4 | Telegram yalnız test ortamında | Canlıda `TELEGRAM_*` boş; bot staging'e bağlanır |
| K5 | Yalnız canlı veritabanı taşınır; kurucu uygulamayı ekiple birlikte bitirecek | Kalıcı staging (ADR-0016) doğrulandı |
| K6 | Başka hesap yok; eski hizmetler doğrudan kapatılır | §11 aynen; "başka proje" kontrolü yok |
| K7 | Geçiş zamanı serbest; ürün canlıya çıkmadı | §10 gün/saat serbest (03:00–04:30 hariç) |

---

## 1. Hedef mimari

```
İnternet ─▶ Cloudflare (DNS + proxy, Full strict) ─▶ sirket-sunucu-1 :443 ─▶ caddy (ortak, /srv/caddy, ağ sirket-proxy)
   beautyossapp.com, app., www.  ─▶ beautyos-web:3000          (CANLI)
   api.beautyossapp.com          ─▶ beautyos-api:3001          (CANLI)
   yeni.beautyossapp.com         ─▶ beautyos-web-staging:3000  (STAGING, basic auth)
   yeni-api.beautyossapp.com     ─▶ beautyos-api-staging:3001  (STAGING)
                         ağ: beautyos icsel ─▶ postgres 17 (DB: beautyos, beautyos_staging)
                                            └▶ redis 7.4    (DB 0: canlı, DB 1: staging)
```

**Compose projesi `beautyos`** (sunucuda `/srv/beautyos/compose.yml`, kaynağı depoda `deploy/compose.yml`; yazan `gelistirici`, `tasima/docker` dalı):

| Servis | İmaj | Ağlar | env dosyası | Sınır | Not |
|---|---|---|---|---|---|
| `web` | `ghcr.io/ahmeetkarateke/beautyos-web:<sha>-prod` | yalnız `sirket-proxy` (takma ad `beautyos-web`); veritabanı ağına erişimi yok | yok | 384M | `read_only`; `NEXT_PUBLIC_*` derlemede gömülü |
| `api` | `ghcr.io/ahmeetkarateke/beautyos-api:<sha>` | `icsel`, `sirket-proxy` (`beautyos-api`) | `.env` | 512M | BullMQ işçisi aynı süreçte, **tek kopya**, `TZ=UTC` (ADR-0006) |
| `web-staging` | `…/beautyos-web:<sha>-staging` | yalnız `sirket-proxy` (`beautyos-web-staging`) | yok | 256M | ADR-0016 |
| `api-staging` | `…/beautyos-api:<sha>` | `icsel`, `sirket-proxy` (`beautyos-api-staging`) | `.env.staging` | 384M | tek kopya, `TZ=UTC` |
| `postgres` | `postgres:17.x` (sabit küçük sürüm) | `icsel` | `.env.db` | 768M | İki veritabanı, dört rol (§4); port yok |
| `redis` | `redis:7.4.x-alpine` | `icsel` | `.env.redis` | 192M | `appendonly yes`, `maxmemory 128mb`, `noeviction`, parola; port yok |
| `migrate` / `migrate-staging` | api imajı | `icsel` | `.env.migrate` / `.env.migrate-staging` | — | `profiles: [migrate]`; elle, canlı için `[ONAY]` |

Kurallar (`docker-yayinlama` skill'i ve sunucu-altyapi ADR-0004):
- Caddy dışında hiçbir servis port yayınlamaz.
- `icsel` ağı `internal: true` (internete çıkışı yok). Web servisleri bu ağda değil; API'ler dış servislere (Gemini, Resend, Turnstile, Telegram) `sirket-proxy` ağı üzerinden çıkar (gelistirici, `tasima/docker` bf124e4).
- Her serviste healthcheck, `restart: unless-stopped`, `no-new-privileges`, `cap_drop`, bellek sınırı.
- Canlı ve staging yayınları servis adıyla ayrı yapılır: `docker compose up -d api web` ya da `… api-staging web-staging`.
- **Ayrı worker servisi yok** (ADR-0006).

**Caddy site parçası** `/srv/caddy/siteler/beautyos.caddy` (kaynağı `deploy/` altında, gelistirici; ortak Caddy ayarları devops'ta, sunucu-altyapi ADR-0006..0010):

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
  basic_auth { <kullanıcı> <bcrypt hash> }      # hash gizli değildir ama parola kurucuda
  reverse_proxy beautyos-web-staging:3000 { header_up X-Forwarded-For {client_ip} }
}
yeni-api.beautyossapp.com {
  import cf_dns
  respond /debug* 404
  reverse_proxy beautyos-api-staging:3001 { header_up X-Forwarded-For {client_ip} }
}
```

- `yeni-api`'de basic auth **yok**. Tarayıcı `Authorization: Bearer` gönderir, basic auth bununla çakışır. Telegram webhook'u da erişebilmelidir. API zaten JWT ister.
- `www` yönlendirmesi kurucu yanıtına bağlı (S1).

**Sunucudaki dosya düzeni:**

```
/srv/beautyos/   compose.yml, postgres/init/01-roller.sh, postgres/postgresql.conf, betikler/veri-aktar.sh, betikler/veri-dogrula.sh
                 .env .env.staging .env.db .env.migrate .env.migrate-staging .env.redis .env.supabase   (kurucu yazar, 600; ajanlar okumaz)
                 tasima/ (700)  döküm ve sayım çıktıları; kapatmada silinir [ONAY]
/srv/caddy/      ortak Caddy (.env: CLOUDFLARE_API_TOKEN), siteler/beautyos.caddy
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

**Sonuç: kalıcı staging dahil 4 GB yeter.** Geriye ~1,5 GB + swap kalır. Koşullar:
- İmajlar sunucuda derlenmez (ADR-0012).
- Sunucuya ikinci bir müşteri projesi gelirse ya da kalıcı bellek > %85 olursa droplet 8 GB'a büyütülür, ya da staging durdurulur (ADR-0016).

## 3. Alan adı, DNS, SSL

- DNS Cloudflare'de. Kiracılar URL yoluyla ayrılıyor, bu yüzden **joker sertifika gerekmez** (ADR-0007).
- Canlı hostlar: `beautyossapp.com`, `app.`, `www.` (tam liste kurucudan bekleniyor, S1) ve yeni `api.`.
- Staging hostları: `yeni.` ve `yeni-api.` (ADR-0016). **İki seviyeli alt alan adı (ör. `api.yeni.beautyossapp.com`) kullanılmaz:** Cloudflare'in ücretsiz kenar sertifikası yalnız tek seviyeyi (`*.beautyossapp.com`) kapsar.
- **ADR-0008 (hukuk-uyum ŞARTLI ONAY verdi):** turuncu bulut, Full (strict), minimum TLS 1.2. Bot Fight Mode ve Under Attack kapalı. Şartlar:
  - `api.` ve `yeni-api.` için Cache Rule "Bypass cache".
  - Web Analytics/RUM, Zaraz, Logpush ve Workers kapalı.
  - Cloudflare hesabında 2FA.
  - İlk gerçek müşteriden önce Cloudflare için KVKK m.9 mekanizması kurulur. Kurulamazsa yalnız `api.` gri buluta alınır.
- **ADR-0009:** sertifikalar DNS-01 ile alınır. Token yalnız `beautyossapp.com` zonunda `Zone:DNS:Edit` + `Zone:Zone:Read` yetkili, `/srv/caddy/.env` içinde `CLOUDFLARE_API_TOKEN`. Sertifika DNS geçişinden önce alınır.
- **ADR-0010:** gerçek IP. Caddy `trusted_proxies static` (Cloudflare listesi, aylık kontrol) + `client_ip_headers CF-Connecting-IP` + `header_up X-Forwarded-For {client_ip}` kullanır; Express'te `trust proxy 1` kalır.
- **ADR-0011:** 80/443 güvenlik duvarında Cloudflare'e kısıtlanmaz.

DNS adımları (kurucu, panelden, `[ONAY]`):

| Ne zaman | İşlem |
|---|---|
| Hemen | Zone dışa aktarımı (DNS > Records > Export), kurucunun arşivine. Ekran görüntüleri (turuncu/gri, SSL modu, CAA) mimara (S2) |
| Hemen | `api`, `yeni`, `yeni-api` → A 209.38.237.171, turuncu (yeni hostlar, mevcut sisteme dokunmaz) |
| Geçişten ≥ 24 saat önce | `@`, `app`, `www` gri ise TTL 60 sn. Turuncu ise gerekmez (değişiklik anında yayılır) |
| Geçiş | `@`, `app`, `www` → A 209.38.237.171, turuncu |

Dokunulmayacaklar: MX ve Resend SPF/DKIM/DMARC kayıtları. CAA varsa `letsencrypt.org` izinli olmalı.

## 4. Veritabanı, roller, gizli dosyalar

- Canlı: veritabanı `beautyos`, sahibi `app_owner` (migration), uygulama rolü `app_user` (`NOSUPERUSER NOBYPASSRLS`, yalnız DML).
- Staging: veritabanı `beautyos_staging`, roller `stg_owner` / `stg_user`. **Çapraz erişim yok:** iki veritabanında `REVOKE CONNECT … FROM PUBLIC`; her rol yalnız kendi veritabanına `CONNECT` yetkisi alır.
- Staging verisi boş başlar. Canlı veri staging'e **kopyalanmaz** (KVKK: kişisel veri gereksiz çoğaltılmaz). Test verisi kayıt akışıyla üretilir.
- Redis: canlı DB 0, staging DB 1 (`REDIS_URL=…/1`); aynı parola.

| Dosya | Yükleyen | İçerik (yalnız adlar; ayrıntı kök `.env.example`) |
|---|---|---|
| `.env` | `api` | Canlı uygulama değişkenleri |
| `.env.staging` | `api-staging` | Aynı adlar, staging değerleri (**ayrı `JWT_SECRET`**) |
| `.env.db` | `postgres` | `POSTGRES_*`, `APP_OWNER_PASSWORD`, `APP_USER_PASSWORD`, `STG_OWNER_PASSWORD`, `STG_USER_PASSWORD` |
| `.env.migrate` / `.env.migrate-staging` | `migrate` / `migrate-staging` | `MIGRATION_DATABASE_URL` (sahip rolü). Uygulama dosyalarına asla yazılmaz |
| `.env.redis` | `redis` | `REDIS_PASSWORD` |
| `.env.supabase` | yalnız `veri-aktar.sh` | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`. Kapatmada silinir |

## 5. Veri taşıma (ADR-0004)

- **Yöntem:** yazma durdurulur, `pg_dump -Fc --schema=public --no-owner --no-privileges`, ardından `pg_restore --role=app_owner --single-transaction --exit-on-error`. `SCHEMA public` girdisi listeden çıkarılır.
- **Kim çalıştırır:** **kurucu**, tek komutla: `ssh karateke@209.38.237.171 'bash /srv/beautyos/betikler/veri-aktar.sh <alt-komut>'`. Bağlantı bilgisi `.env.supabase`'ten libpq değişkenleri olarak geçici `postgres:17` konteynerine girer; komut satırına ve çıktıya girmez.
- **Alt komutlar:**
  - `on-kontrol` (yalnız okur): kaynak sürüm ≤ 17; `public`'te RLS/politika yok; `auth.`/`storage.`/`extensions.` bağımlılığı yok; satır sayıları ve kimlik özetleri alınır. Bağlantı Supabase **Session pooler** (IPv4, 5432) üzerinden; Transaction pooler kullanılmaz.
  - `dok`
  - `yukle <hedef-db>`: hedef boş değilse durur.
- **`veri-dogrula.sh`:** tablo başına satır sayısı + `tenants`/`users`/`customers`/`appointments` kimlik özeti eşit olmalı; `prisma migrate status` güncel; `app_user` süper değil.
- **Önceden deneme (G13):** `on-kontrol` ve `dok` kaynağa yalnız okuma yaptığı için geçişten önce güvenle çalışır. `yukle`, sunucuda **geçici, ağsız** bir `postgres:17` konteynerine yapılır, doğrulanır, sonra konteyner ve volume'u silinir. Kişisel veri kalıcı kopyaya dönüşmez.
- **Redis verisi taşınmaz** (ADR-0005). SMS kapalı olduğu için hatırlatma işlerini yeniden kuyruğa almaya gerek yok. Gece no-show işi açılışta kendiliğinden kaydolur.

### 5.1 Kaynak veri: Supabase duraklatılmış görünüyor (2026-10-28)

Canlı API `/health` yanıtı `{"status":"degraded","db":"error"}`. Büyük olasılıkla Supabase projesi hareketsizlik yüzünden duraklatıldı (ücretsiz plan). Kurucu panelden kontrol ediyor. Veri aktarımı (G12/G13/geçiş adım 3) iki yoldan biriyle yapılır. **Öneri: (a)**; (a) mümkün değilse (b).

**(a) Proje geri açılır (Restore/Resume), canlı kaynaktan `pg_dump` alınır**: ana yol.
1. Kurucu Supabase panelinden projeyi yeniden başlatır `[ONAY]`. Yalnız Postgres açılır; Railway API'si kendiliğinden düzelir ve G4a hotfix'i yeniden dağıtılabilir hale gelir. Dağıtımı kurucu panelden "Redeploy" ile tetikler; `/debug` kapanır.
2. Hemen ardından `veri-aktar.sh on-kontrol` ve `dok` çalıştırılır. Döküm `/srv/beautyos/tasima/` altında durur. Ücretsiz plan 7 gün hareketsizlikte yeniden duraklatır, bu yüzden döküm alınmadan beklenmez.
3. Bu döküm G13 ön denemesinde kullanılır. Geçiş günü adım 2–3'te yazma durdurulup **taze** döküm alınır. Supabase o arada yeniden duraklatılmışsa adım 1 tekrarlanır ya da kurucu onayıyla G13'teki döküm son kopya sayılır. Ürün canlıda değil, arada yazılan veri yok.
- Artısı: plandaki akış değişmez; `on-kontrol` kaynakta tüm denetimleri yapar; yalnız `public` şeması gelir.
- Eksisi: projenin geri açılabilir olması gerekir. Supabase uzun süre duraklatılmış projeler için geri açmayı kapatıp yalnız yedek indirmeye izin verebilir.

**(b) Panelden indirilen yedek dosyası kullanılır**: yedek yol.
1. Kurucu Supabase panelinden yedeği indirir (genelde tüm kümenin düz SQL dökümü, `.backup`/`.sql`, gzip olabilir). Dosyayı `scp` ile `/srv/beautyos/tasima/` altına koyar (700/600). **Kurucunun bilgisayarındaki kopya aktarım biter bitmez silinir** (kişisel veri).
2. Dosya `pg_restore -n public` ile seçici yüklenemez; Supabase'in `auth`, `storage`, rol ve uzantı nesnelerini de içerir. Bu yüzden **ara konteyner** kullanılır. `veri-aktar.sh` yeni alt komutu `yedekten-ac <dosya>`:
   - Dosyanın yalnız başlık satırından (`Dumped from database version …`) kaynak sürümü okunur. Ana sürüm 17'den büyükse betik durur.
   - Ara konteyner geçici ve **ağsız** bir `postgres:<kaynak ana sürüm>` konteyneridir. Dosya bu konteynerde `psql` ile `ON_ERROR_STOP` kapalı yüklenir. `public` dışındaki hatalar (eksik `pgsodium`, `pg_graphql`, `supabase_vault` uzantıları, Supabase rolleri) beklenir ve sayılır; `public` nesnelerinde hata varsa betik durur.
   - `on-kontrol` denetimleri (RLS/politika, `auth.`/`extensions.` bağımlılığı, satır sayıları, kimlik özetleri) **ara konteynere karşı** çalışır.
   - Ara konteynerden `pg_dump -Fc --schema=public --no-owner --no-privileges` alınır. Sonrası (`yukle`, `veri-dogrula.sh`) (a) ile aynı.
   - Ara konteyner, volume'u ve düz SQL dosyası iş bitince silinir. Yalnız `-Fc` döküm ve sayım dosyaları kalır.
3. Geçiş günü yazma durdurma adımı anlamsızdır (kaynak zaten kapalı). Adım 2'de yalnız otomatik dağıtım kapatılır ve Railway servisi durdurulur.
- Artısı: Supabase'in geri açılmasına bağlı değil.
- Eksisi: yedek tarihine kadar olan veri gelir. Kişisel veri kurucunun bilgisayarından geçer. Betikte ek alt komut gerekir (G12-K9).
- **Geri dönüş (§10) bu yolda fiilen yoktur:** Supabase kapalıyken Railway API çalışmaz. Sorun çıkarsa ileriye doğru düzeltilir.

**Karar sahibi:** kurucu (müdür üzerinden). Panelde "Restore project" seçeneği görünüyorsa (a), yalnız "Download backup" görünüyorsa (b).

## 6. CI/CD (ADR-0012)

- `imaj.yml` (`workflow_dispatch` + `v*`): tek API imajı + iki web imajı (`-prod`: `NEXT_PUBLIC_API_URL=https://api.beautyossapp.com`; `-staging`: `https://yeni-api.beautyossapp.com`) → özel GHCR. Değerler repository variables'tan gelir. Sunucuya SSH yok.
- **Yayın:** devops elle yapar; önce staging, test GEÇTİ sonrası canlı. Sunucu GHCR'a `read:packages` token'ıyla bağlanır `[ONAY]`.
- **CI testleri (G1):** dış `secrets.DATABASE_URL` yerine `postgres:17` servis konteyneri.
- **Geçiş öncesi geçici durum:** gelistirici'nin sunucudaki test ortamı imajları sunucuda derleyebilir. Canlı imajlar yine iş akışından gelir.

## 7. Staging (ADR-0016)

- Kalıcı. Aynı compose projesinde iki servis (`web-staging`, `api-staging`) ve aynı Postgres/Redis örneğinde ayrı veritabanı/rol/DB. Kurucu ile geliştirme burada sürer.
- `.env.staging`: `NETGSM_*` boş. Mevcut test Telegram botu (VARSAYIM, S4) `PUBLIC_URL=https://yeni-api.beautyossapp.com` ile buraya bağlanır. Resend ve Gemini kurucunun tercihine göre. Sentry boş (S7).
- Basic auth yalnız `yeni` web hostunda.
- **İlk gerçek müşteriden önce** staging'in canlıyla aynı Postgres örneğinde kalması yeniden değerlendirilir (ADR-0016 riski).

## 8. Yedekleme ve izleme: geçişten ÖNCE hazır olmalı

- **Yedek (ADR-0015, devops):**
  - Her gece 03:30 TR: `pg_dump -Fc` (canlı + staging + rol dökümü) → restic → B2 eu-central.
  - Saklama 7/4/6 (hukuk-uyum ONAY).
  - **B2 kovasında yaşam döngüsü "yalnız son sürüm"** olmalı; yoksa `forget --prune` veriyi silmez. Gece `forget`, haftalık `prune`.
  - Başarısızlık Healthchecks kalp atışı ile Telegram'a bildirilir.
  - **İkinci katman:** DO günlük droplet yedeği (7 gün, açık).
  - **Ön koşul:** en az bir başarılı yedek + `yedek-geri-yukle.sh dene beautyos` başarılı.
- **İzleme:**
  - UptimeRobot (ya da Healthchecks) yoklamaları: `https://api.beautyossapp.com/health` (`"status":"ok"`), `https://app.beautyossapp.com/login`, apex. Uyarılar Telegram'a.
  - DO uyarıları: CPU %80, bellek %85, disk %85.
- **KVKK geçiş öncesi şartları** (`docs/kvkk-tasima-degerlendirmesi.md` §6.1):
  - Sentry gövde temizliği **ya da** geçişte `SENTRY_DSN` boş (S7).
  - B2 yaşam döngüsü.
  - Cloudflare ayarları (§3).
  - DO, Cloudflare, B2, GitHub, Sentry ve Google hesaplarında 2FA.
  - Kurucu teyidi: Supabase verisi demo/deneme, gerçek kişi verisi değil (S6).

## 9. Aşamalar ve onay noktaları

| Aşama | İçerik | Görevler | `[ONAY]` noktaları |
|---|---|---|---|
| 0. Hemen | `/debug` hotfix'i canlıya; DNS dışa aktarımı ve yeni hostlar | G4a | Hotfix'in `master` push'u; DNS kayıtları |
| 1. Uygulama | Dockerfile'lar, standalone, CORS, açılış kontrolü + Sentry temizliği, imaj iş akışı, CI | G1–G5, G7 | Taşıma dallarının GitHub'a push'u; GHCR token'ı |
| 2. Altyapı | Caddy, yedek, izleme | G8–G10 | Cloudflare token'ı, B2 ve Healthchecks hesapları |
| 3. Yığın + staging | Compose, roller, Caddy parçası, staging ayakta; veri betiği ve ön denemesi; kabul testi staging'de | G11–G14 | Staging migrate; ön deneme (Supabase'ten okuma) |
| 4. Geçiş | §10 | G15–G16 | Runbook'un tamamı (tek onay) |
| 5. Kapatma | +3 gün (kurucu onayıyla) | G17 | Her silme ayrı; imha tutanağı |
| 6. Sonrası | Node/Next yükseltmesi, temizlik, RLS ve KVKK "ilk müşteriden önce" maddeleri | G18, T-B1 | Ayrı planlama |

## 10. Geçiş (tek oturum, ~1 saat, gün ve saat serbest)

03:00–04:30 arası seçilmez (yedek + otomatik yeniden başlatma).

**Ön koşullar:**
- G1–G5, G7–G14 tamam: denetçi ONAY'ı + staging'de TEST GEÇTİ.
- §8'deki yedek, izleme ve KVKK maddeleri tamam.
- Zone dışa aktarıldı; TTL düşük (gri kayıtlar için).
- Kurucu, `MIGRATION_DATABASE_URL`'in `.env`'de olmadığını teyit etti.

| # | Kim | Adım | Doğrulama |
|---|---|---|---|
| 1 | kurucu | Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımını kapat (R1) | Panel |
| 2 | kurucu | Railway prod ve staging API servislerini durdur (silme) | Eski `/health` yanıt vermiyor |
| 3 | kurucu | Yol (a): `veri-aktar.sh on-kontrol`, `dok`, `yukle beautyos`. Yol (b): `yedekten-ac <dosya>` (ön denemede yapılmışsa döküm hazırdır), `yukle beautyos` (§5.1) | Hatasız |
| 4 | devops | `veri-dogrula.sh` | Sayılar ve özetler eşit, migrate güncel |
| 5 | kurucu | `.env` canlı değerleri: `NETGSM_*` boş, `TELEGRAM_*` boş, `SENTRY_DSN` S7'ye göre, Resend/Turnstile/Gemini dolu, `FRONTEND_URL=https://app.beautyossapp.com` | Kurucu "tamam" der |
| 6 | devops | `docker compose up -d api web` | healthy; log'da "SMS provider: Mock" |
| 7 | kurucu | DNS `@`, `app`, `www` → 209.38.237.171, turuncu | `curl -sI https://app.beautyossapp.com` → `server: cloudflare`, 200 |
| 8 | test-muhendisi | Canlı duman testi (G16) | Geçti |
| 9 | devops | `sirket/sunucu.md` kaydı, ilk 60 dk izleme | Kayıt yazıldı |

**Geri dönüş (3 gün içinde, `[ONAY]`):**
1. DNS dışa aktarımdaki Vercel değerlerine döner.
2. `docker compose stop api web`.
3. Railway prod servisi son dağıtımdan başlatılır.

Geçişten sonra yeni sunucuda yazılan veri geri taşınmaz. Gerçek kullanıcı yok ve SMS kapalı, bu yüzden kayıp kabul edilir. Yeni sunucudaki veri silinmez; neden araştırılır. **Yol (b) seçildiyse ya da Supabase yeniden duraklatıldıysa geri dönüş çalışmaz** (Railway API veritabanına bağlanamaz); bu durumda ileriye doğru düzeltilir.

## 11. Eski servislerin kapatılması (geçiş + 3 gün, kurucu onayıyla)

Her silme ayrı `[ONAY]`; her biri için `sirket/` altında **imha tutanağı** tutulur (tarih, ne silindi, kim onayladı; içerik yok).
1. Supabase canlı son dökümü restic'e `arsiv` etiketiyle. **En fazla 30 gün** saklanır (demo veri; S6). `--keep-tag arsiv` kullanılmaz.
2. Railway (prod + staging), Vercel, Upstash, Supabase (prod + staging) projeleri silinir.
3. GitHub `DATABASE_URL` sırrı silinir. Dış platformlarda saklanmış anahtarlar yenilenir (S5).
4. `/srv/beautyos/.env.supabase` ve `/srv/beautyos/tasima/` silinir.
5. Depodaki Railway/Vercel kalıntıları temizlenir (G18).

## 12. Risk değerlendirmesi

**Genel: DÜŞÜK.** Gerçek kullanıcı yok, SMS kapalı, Telegram yalnız testte, veri küçük, uygulama Supabase'i yalnız Postgres olarak kullanıyor.

| Risk | Önlem |
|---|---|
| `master` push'unun eski API'yi yeniden açması (R1). Hotfix push'u bu yüzden geçişten önce bilerek yapılır; Railway hâlâ canlı olduğu için doğru davranış budur | Geçiş adım 1 |
| **Supabase duraklatılmış (2026-10-28):** veri kaynağına erişim yok; `/debug` hotfix'i dağıtılamıyor (açılışta DB kontrolü süreci durduruyor), açık sürüyor | §5.1 yol (a) ya da (b). `/debug` için ara önlem (kurucu, `[ONAY]`): Railway servisinin herkese açık alan adını kaldırmak ya da servisi şimdi durdurmak. Ürün canlıda değil ve API zaten veritabanına bağlanamıyor, yani kayıp yok. Ek olarak Gemini API anahtarı yenilenirse `/debug` ücretli çağrı yapamaz |
| Yol (b)'de kişisel verinin kurucunun bilgisayarından geçmesi | Aktarımdan hemen sonra yerel kopya silinir; sunucuda 700/600 |
| Panelden açılmış RLS/uzantı bağımlılığı | `on-kontrol` + ön deneme |
| Cloudflare arkasında yanlış istemci IP'si → hız sınırı kilidi | ADR-0010 + G14-K7 |
| Staging'in canlıyla aynı Postgres/Redis'i paylaşması (kaynak ya da yanlış yapılandırma) | Ayrı veritabanı ve roller, `REVOKE CONNECT`, bellek sınırları, ayrı `JWT_SECRET`; G11-K3 testi |
| Yedeksiz canlı | §8 ön koşulu |
| Kiracı izolasyonunun yalnız uygulama filtresinde olması (RLS yok) | Taşımadan bağımsız; hukuk-uyum ilk müşteriden önce RLS'i güçlü öneriyor (T-B1) |

## 13. Kurucudan beklenenler

**Yanıtlananlar (2026-10-28):** Cloudflare turuncu bulut + ayarlar + token (K2). Telegram yalnız test, bot staging'e (K4). Başka hesap yok (K6). Geçiş zamanı serbest (K7).

**Hâlâ açık:**
1. **Veri kaynağı (§5.1):** Supabase panelinde "Restore/Resume" mı görünüyor (yol a), yalnız "Download backup" mı (yol b)? (Müdür takipte.)
2. **S1:** `www` kullanılıyor mu, apex'e yönlensin mi? `app` ve apex dışında başka alt alan adı var mı?
3. **S3:** GitHub'daki `DATABASE_URL` sırrı hangi veritabanını gösteriyor (CI)?
4. **S5:** `JWT_SECRET` yenilensin mi (öneri: evet) ve kapatmada dış servis anahtarları yenilensin mi?
5. **S6:** Supabase canlı verisinin demo/deneme olduğu, gerçek kişi verisi olmadığı teyidi (KVKK G-5; arşiv süresi ve yol (b)'deki yerel kopya riski buna bağlı).
6. **S7:** Sentry geçişte kapalı mı kalsın (`SENTRY_DSN` boş), yoksa G5-K5 + AB bölgesi projesiyle mi açılsın?
7. Backblaze B2 ve Healthchecks hesapları açıldığında devops'a bildirim; ilgili hesaplarda 2FA.
