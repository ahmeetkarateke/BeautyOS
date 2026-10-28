# BeautyOS — Şirket Sunucusuna Taşıma Planı

- **Tarih:** 2026-10-27 · **Sürüm:** 4 (2026-10-28) · **Hazırlayan:** mimar
- **Sürüm 4'te değişen:** Kurucu, Supabase verisinin demo olduğunu ve önemli olanın yalnız tablolar olduğunu bildirdi. **Veri taşınmıyor.** Canlı veritabanı sunucuda boş kuruluyor. Veri aktarımı yerine şema uyum kontrolü yapılıyor (§5). Geçiş DNS değişikliğine, geri dönüş DNS'i geri almaya indi.
- **Kurucu kararı:** Her şey şirket sunucusunda (`sirket-sunucu-1`, DO FRA1, 209.38.237.171) çalışır. Eski Supabase, Railway, Vercel ve Upstash kapatılır.
- **Girdiler:** `docs/mevcut-durum.md` (bulgular R1–R14), `docs/kvkk-tasima-degerlendirmesi.md` (hukuk-uyum). **Kararlar:** `docs/kararlar.md`. **Görevler:** `docs/gorevler.md`.
- **İşaretler:** `[ONAY]` = kurucu onayı olmadan yapılmaz (müdür toplar). **VARSAYIM** = doğrulanmamış.
- **Kalıcı izin (kurucu, 2026-10-28; şirket `CLAUDE.md` "Kalıcı izinler"):** Bu plandaki, **denetçi ONAY'ı almış teknik adımlar** (sunucuda kurulum, derleme, migrate, Caddy site dosyası, sertifika, test/deneme kaynaklarının ve eski imajların temizliği) kurucuya ayrıca sorulmadan yürütülür. İzni **yalnız müdür** kullanır; ekip üyeleri bu adımları müdürün talimatıyla yapar. Bu tarihten sonra plandaki `[ONAY]` işaretlerinden yalnız şunlar kurucuya gider (§9):
  - DNS değişiklikleri.
  - Eski servislerin (Railway, Vercel, Supabase, Upstash) kapatılması ya da silinmesi.
  - Taşıma dallarının `master`'a birleştirilmesi.
  - Gerçek veri silme.
  - Para gerektiren işler.
  - İzin metninde açıkça yer almayan her şey.

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
| 10-28 | Supabase'te bulunan, depoda olmayan iki migration (WhatsApp numara alanı, iyzico abonelik) **terk edildi**: "önemli değil, en baştan birlikte düzelteceğiz, proje burada ayakta olsun" | Depodaki 19 migration esas. Bu özellikler ileride gelirse yeni migration'larla yazılır. G13-K7 iptal; Supabase silme koşulu kalktı |
| 10-28 | Kalıcı izin: plandaki denetçi ONAY'lı teknik adımlar kurucuya sorulmadan yürütülür (DNS ve eski servis kapatma hariç) | Başlık notu, §9 |
| 10-28 | Müdür kararı: taşıma dalları push edilmez (kalıcı izin dışı; Vercel her dal push'unda preview açıyor). Kaynak sunucuya `git archive` paketiyle aktarılır | ADR-0019 (ADR-0018'in kaynak bölümünün yerini aldı), §6, G7. Deploy key ve push maddeleri kaldırıldı |
| 10-28 | Müdür kararı: geçişte kayıtlar **gri** kalır (dört kayıt bugün gri; SSL modu teyitsiz; sertifikalar DNS-01 ile hazır; KVKK açısından daha az üçüncü taraf) | ADR-0021; turuncu bulut ayrı adım G20 (önce kurucu Full strict yapar) |
| 10-28 | **Kurucunun koşullu geçiş onayı** (müdür aktardı): "testler geçerse çevir". Koşullar G13 + denetçi son sunucu doğrulaması ONAY, G14 TEST GEÇTİ, G15 doğrulamaları. Eski servislerin kapatılması onayın dışında | §9, §10 baştan yazıldı. DNS'i müdür Cloudflare API ile çevirir (ADR-0020); Railway/Vercel Git kesme geçiş sonrasına alındı |

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
                 kaynak/<sha12>/  kaynak.tar + commit.txt + kaynak.tar.sha256 + agac/ (müdürün aktardığı onaylı commit paketi; ADR-0019; .env* yok)
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

**Kalıcı staging dahil 4 GB yeter.** İmajlar sunucuda derlenir (ADR-0018). Ölçüm (D14, 10-28): canlı yığın açıkken sistem tepe belleği 1715 MB, tepe swap 37 MB, derleme süresi toplam ~8 dk; ek swap gerekmiyor. Önlemler: sıralı derleme, Node heap sınırı, bellek ve CPU sınırlı builder ve düşük trafik saati. Mevcut 2 GB swap güvenlik ağıdır. Ölçüm (D14) yetersiz çıkarsa devops geçici swap için ADR önerir `[ONAY]`. İkinci bir müşteri projesi gelirse ya da bellek kalıcı olarak > %85 olursa droplet büyütülür ya da staging durdurulur (ADR-0016).

## 3. Alan adı, DNS, SSL

- DNS Cloudflare'de. Kiracılar URL yoluyla ayrıldığı için **joker sertifika gerekmez** (ADR-0007).
- Canlı hostlar: `beautyossapp.com`, `app.`, `www.` (S1) ve `api.`. Staging hostları: `yeni.` ve `yeni-api.`. İki seviyeli alt alan adı kullanılmaz: Cloudflare'in ücretsiz kenar sertifikası kapsamaz.
- **ADR-0021 (müdür kararı, 10-28): geçişte kayıtlar GRİ kalır.** `uygula` yalnız hedefi değiştirir, `proxied=false` korunur. Turuncu bulut (ADR-0008) ayrı ve sonraki bir adım (G20): önce kurucu SSL/TLS modunu Full (strict) yapar, sonra kayıtlar turuncuya alınır. Bu bir DNS değişikliğidir, kurucuya sorulur. Aşağıdaki ADR-0008 maddeleri o adımda geçerli olur.
- **ADR-0008 (kabul edildi, uygulaması ertelendi):** turuncu bulut, Full (strict), minimum TLS 1.2, Bot Fight Mode ve Under Attack kapalı. Hukuk-uyum şartları:
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
| Hemen | `yeni`, `yeni-api` → A 209.38.237.171, **gri** (ADR-0021; SSL modu teyit edilene kadar; yeni hostlar, eski sisteme dokunmaz). Zaten turuncu açıldılarsa ve SSL modu Full (strict) değilse griye alınır. **`api` buna dahil DEĞİL:** `api.beautyossapp.com` şu an Railway canlısının özel alan adı (10-28'de görüldü); geçişe kadar Railway'i gösterir |
| Geçişten önce | Dört kayıt gri (plan çıktısı, 10-28). TTL > 300 ise `ttl-dusur` ile 60 sn yapılır ve eski TTL kadar beklenir |
| Geçiş | `@`, `app`, `www` **ve `api`** → A 209.38.237.171, **gri, proxied=false korunur** (ADR-0021; dördü birlikte; Railway'deki özel alan adı kaydı G17'de kaldırılır). **Müdür yürütür, kurucunun koşullu onayıyla, `dns-cevir.sh` ve Cloudflare API ile** (ADR-0020, §10) |

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
- **Kaynak (ADR-0019, müdür kararı):** sunucu GitHub'dan **çekmez**; deploy key yok, taşıma dalları push edilmez. Akış:
  1. Müdür, denetçi ONAY raporundaki commit'i bu bilgisayarda paketler: `git -c core.autocrlf=false archive --format=tar -o beautyos-<sha12>.tar <tam-sha>` ve `certutil -hashfile … SHA256`. **`-c core.autocrlf=false` zorunlu:** Windows'ta `autocrlf=true` iken paket CRLF'ye çevrilir ve kabuk betikleri ile Dockerfile bozulur (D16).
  2. Paketi `scp` ile `/srv/beautyos/kaynak/<sha12>/kaynak.tar` olarak taşır. Yanına `commit.txt` (tam sha) ve `kaynak.tar.sha256` koyar.
  3. Boru hattı kullanılmaz (PowerShell 5.1 ikili veriyi bozar).
- **Derleme:** `derle.sh <tam-sha>` (devops çalıştırır):
  1. SHA-256 doğrulanır.
  2. `git get-tar-commit-id` çıktısı, `commit.txt` ve argüman üçü birden eşit olmalı. Tutmazsa derleme yapılmaz.
  3. Paket boş bir `agac/` dizinine açılır, ardından sırayla `docker build` çalışır.
  4. Etiketler `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod`, `beautyos-web:<sha12>-staging`. Web derleme değerleri `deploy/derleme.conf`'tan gelir (`-prod` → `https://api.beautyossapp.com`, `-staging` → `https://yeni-api.beautyossapp.com`).
- Canlıya giden imaj yalnız **denetçi ONAY'lı ve müdürün aktardığı** commit'ten derlenir. Kimlik ve ONAY raporu yolu `sirket/sunucu.md`'ye yazılır.
- **CI notu:** Taşıma dalları push edilmediği için GitHub Actions (G1 testleri, `imaj.yml` derleme kontrolü) G18 birleştirmesine kadar çalışmaz. Eşdeğer test ve derleme kontrolleri sunucuda ya da test ortamında elle koşulur, sonuçlar `[İNCELEME HAZIR]` mesajına eklenir.
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

Sütunlar: **Kalıcı izinle (müdür)** = denetçi ONAY'ı şartıyla kurucuya sorulmadan yapılır. **Kurucuya sorulur** = kalıcı izin dışında kalan işler.

| Aşama | İçerik | Görevler | Kalıcı izinle (müdür) | Kurucuya sorulur |
|---|---|---|---|---|
| 0. Hemen | `/debug` (G4a, **kapandı 10-28**), DNS dışa aktarımı, staging hostları | G4a | — | `yeni` ve `yeni-api` DNS kayıtları |
| 1. Uygulama | Dockerfile'lar, standalone, CORS, açılış kontrolü + Sentry temizliği, derleme betikleri, CI + depo içi şema uyumu | G1–G5, G7 | Onaylı düzeltme commit'lerinin push'u; onaylı commit'in `git archive` paketiyle sunucuya aktarılması (ADR-0019) | — (taşıma dalları push edilmez; deploy key yok) |
| 2. Altyapı | Caddy, yedek, izleme | G8–G10 | Caddy kurulumu ve yeniden oluşturma, site dosyası, sertifika, yedek ve izleme betikleri | B2 ve Healthchecks hesapları (hesap ve ücret kurucuda) |
| 3. Yığın | Compose, roller, staging; canlı yığın boş veritabanıyla; kabul testi staging'de | G11, G13, G14 | Canlı ve staging `migrate` (boş veritabanı), yığının açılması, sunucuda derleme, son 3 sürüm dışındaki imajların ve test kaynaklarının temizliği | — |
| 4. Geçiş | §10 | G15, G15a, G16 | **Kurucunun koşullu onayıyla (2026-10-28, "testler geçerse çevir"):** müdür §10'u yürütür, DNS değişikliği ve gerekirse DNS geri alma dahil. §10 ön koşulları eksiksiz olmalı | Ön koşullardan biri bile kalırsa geçiş durur, kurucuya sorulur. Railway/Vercel Git bağlantısının kesilmesi ve Railway'in durdurulması geçişten **sonraya** alındı (§10.3) |
| 5. Kapatma | G16 geçince | G17 | `tasima/` ve geçici dosyaların temizliği | **Koşullu onayın DIŞINDA:** her eski servisin kapatılması/silinmesi ayrı (Supabase ×2, Railway, Vercel, Upstash); Railway/Vercel GitHub otomatik dağıtımının kapatılması; GitHub sırrı; anahtar yenileme (S5) |
| 6. Sonrası | Node/Next yükseltmesi, temizlik, G19, RLS ve KVKK "ilk müşteriden önce" maddeleri | G18, G19, T-B1 | Onaylı düzeltmeler | Taşıma dallarının `master`'a birleştirilmesi; yeni özellikler |

G12 ve G13'ün şema karşılaştırması tamamlandı (10-28); bu adımlar artık tabloda yok.

## 10. Geçiş: müdür yürütür, kurucu gerekmez (~30 dk, gün serbest; 03:00–04:30 hariç)

**Yetki:** Kurucunun koşullu onayı (2026-10-28, müdür aktardı: "testler geçerse çevir"). Müdür geçişi, aşağıdaki **üç koşulun tamamı** sağlandığında yürütür. Biri bile eksikse geçiş durur ve kurucuya sorulur. Eski servislerin kapatılması bu onayın dışındadır (§11).

### 10.1 Ön koşullar (hepsi ✔, kanıtları geçiş kaydına yazılır)

| # | Koşul | Kanıt |
|---|---|---|
| K-A | **G13 kurulumu tamam ve denetçinin son sunucu doğrulaması ONAY.** Canlı yığın boş veritabanıyla healthy. Kontrol listesine şunlar da girer: §8 yedek (en az bir başarılı yedek + geri yükleme denemesi), izleme (UptimeRobot `api` yoklaması aktif) ve aşağıdaki ortam kontrolü | Denetim raporu yolu |
| K-B | **G14 kabul testi: TEST GEÇTİ** (staging'de, canlıyla aynı API imajı) | Test raporu yolu |
| K-C | **G15 doğrulamaları geçti.** DNS'e dokunmadan, doğrudan sunucuya: `curl --resolve api.beautyossapp.com:443:209.38.237.171 https://api.beautyossapp.com/health` → 200 ve geçerli sertifika. Aynı yolla `app.beautyossapp.com/login`, `beautyossapp.com/` ve `www.beautyossapp.com/` → 200, sertifikalar geçerli. `dns-cevir.sh plan` çıktısı beklenen dört kaydı gösteriyor | Komut çıktıları (gizli değer içermez) |

**Ortam kontrolü (kurucu teyidinin yerine; değer okumadan):** `ortam-kontrol` adımı (G15a, devops, sunucu-altyapi) her değişken için yalnız **var/yok** bilgisini çıkış koduyla verir; değer yazdırmaz. Örnek: `docker compose exec -T api node -e "process.exit(process.env.X ? 1 : 0)"`. Beklenen:
- `NETGSM_USERCODE`, `TELEGRAM_BOT_TOKEN`, `SENTRY_DSN` (G5-K5 birleşmediyse), `ADMIN_SEED_SECRET` ve `MIGRATION_DATABASE_URL` **yok**.
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `PUBLIC_URL`, `FRONTEND_URL`, `TURNSTILE_SECRET_KEY` ve `RESEND_API_KEY` **var**.

Bu `.env`'leri kurucu G13'te doldurur. `ADMIN_SEED_SECRET` canlıda baştan boş kalır; seed uç noktası 403 döner, açık kapı kalmaz. İlk süper yönetici geçişten sonra kurucunun uygun zamanında açılır (10.4).

### 10.2 Adımlar

| # | Kim | Adım | Doğrulama |
|---|---|---|---|
| 1 | müdür (devops yürütür) | `dns-cevir.sh plan`: dört kaydın (`@`, `app`, `www`, `api`) mevcut halini ve tüm zonu `tasima/dns-oncesi.json` ve `tasima/zone-oncesi.txt` olarak saklar | Dosyalar var. Gri kayıtta TTL > 300 ise önce `ttl-dusur` çalışır, eski TTL kadar beklenir |
| 2 | müdür (devops yürütür) | `dns-cevir.sh uygula`: dört kayıt → A 209.38.237.171. **`proxied` değeri `dns-oncesi.json`'daki gibi korunur (bugün `false`, gri), TTL plandaki değerinde kalır** (ADR-0021). Gerçek API'de ilk `uygula` çalıştırması budur; önceden yalnız sahte API'ye karşı sınanmıştır (G15a-K4b) | Betik her kaydı API'den geri okuyarak doğrular |
| 3 | devops | TTL süresi kadar (en çok 300 sn) beklendikten sonra dıştan doğrulama:<br>- `dig +short app.beautyossapp.com @1.1.1.1` → 209.38.237.171 (dört ad için).<br>- `curl -sI https://app.beautyossapp.com` → 200, `server: Caddy` (gri olduğu için `cloudflare` değil), sertifika geçerli.<br>- `https://api.beautyossapp.com/health` → 200; isteğin sunucuya ulaştığı Caddy/API log'unda görünür (Railway değil). | Geçti |
| 4 | test-muhendisi | Canlı duman testi (G16-K1). Bir telefon doğrulama isteğiyle log'da "SMS provider: Mock" görülür | TEST GEÇTİ |
| 5 | devops | UptimeRobot `app` ve apex yoklamaları açılır; `sirket/sunucu.md` "Çalışan servisler" satırı ve işlem günlüğü (K-A/K-B/K-C kanıt yollarıyla); ilk 60 dk izleme | Kayıt yazıldı |
| 6 | müdür | Kurucuya rapor: geçiş tamam + §10.3 ve §11 için bekleyen kurucu işleri | — |

### 10.3 Geçişten sonraya alınanlar (kurucu paneli gerektirir)

Railway ve Vercel'in GitHub otomatik dağıtımının kapatılması ve Railway servislerinin durdurulması **kurucu paneli** gerektirir. Geçişten sonraya alınabilir, çünkü DNS çevrildikten sonra eski sistemin trafiği yoktur:
- `api.beautyossapp.com` artık sunucuyu gösterir.
- Railway yalnız kendi `*.up.railway.app` adresinden ve demo Supabase verisiyle çalışır. SMS kapalıdır.

**Bu süre boyunca kural (müdür kayda aldı, 10-28):** kurucu Git bağlantılarını kesene kadar **`master`'a hiçbir push yapılmaz**; kalıcı izindeki onaylı düzeltme push'u da dahil. Aksi halde Railway eski API'yi yeniden dağıtır (`apps/api/**` değişikliği kendiliğinden çıkar). Bu kural müdürde. Telegram notu: Railway canlısında `TELEGRAM_BOT_TOKEN` tanımlıysa ve staging'deki test botuyla aynıysa, Railway her yeniden başlatmada webhook'u geri alır. Kurucuya kesme talebi bununla birlikte iletilir (S4).

### 10.4 İlk süper yönetici (geçiş sonrası, kurucuyla)

Kurucu uygun olduğunda `.env`'e geçici bir `ADMIN_SEED_SECRET` yazar. Devops `api`'yi yeniden oluşturur, kurucu `POST /api/v1/admin/seed` çağırır. Ardından değer boşaltılır, `api` yeniden oluşturulur ve uç noktanın 403 döndüğü doğrulanır. Geçişi engellemez.

### 10.5 Geri dönüş (müdür yürütür, kurucuya hemen rapor)

- **Ölçüt:** §10.2 adım 3 ya da 4 başarısız ve 60 dakika içinde düzeltilemiyor, veya sunucuda kalıcı arıza var.
- **Adım:** `dns-cevir.sh geri-al`. Dört kaydı `tasima/dns-oncesi.json`'daki haline (tür, değer, proxy, TTL) döndürür ve geri okuyarak doğrular. Taşınmış veri olmadığı için başka adım yok; yeni sunucudaki yığın durdurulmaz, sorun ileriye doğru düzeltilir.
- **Gerekçe:** Geri dönüş kurucunun onayladığı önceki duruma döndürmektir ve koşullu onayın parçası sayılır. Müdür bunu yapar ve kurucuya hemen bildirir. İkinci deneme yeniden §10.1 koşullarına bağlıdır.
- **Uyarı:** Eski sistem ancak `beautyos-dev` açıkken çalışır. Proje 10-28'de açıldı ve ~7 gün içinde yeniden duraklar. Duraklamışsa geri dönüş yalnız tanıtım sayfasını (Vercel) geri getirir.

## 11. Eski servislerin kapatılması (G16 geçince, kurucu onayıyla)

Her silme ayrı `[ONAY]` (kurucunun koşullu geçiş onayının dışında). Her biri için `sirket/` altında **imha tutanağı** tutulur: tarih, ne silindi, kim onayladı; içerik yok. Veri demo olsa da KVKK gereği tutanak tutulur.

0. **İlk iş (kurucu paneli, geçişten hemen sonra):** Railway (prod + staging) ve Vercel'de GitHub otomatik dağıtımının kapatılması ve Railway servislerinin durdurulması (§10.3). O zamana kadar `master`'a push yasağı sürer.

1. **Supabase `beautyos-dev`** (canlı proje, 10-28'de kesinleşti) silinir. §5 `kaynak` adımı tamamlandı (10-28). Silme her durumda kurucu onayına bağlıdır. Depoda olmayan iki migration kurucu kararıyla terk edildi; bekleme koşulu yok. Panelin kendi otomatik yedekleri de projeyle birlikte gider; tutanakta yazılır.
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
0. ~~Depoda olmayan iki migration~~ kurucu kararıyla terk edildi (10-28).
1. ~~Şema dökümü~~ alındı (10-28).
2. ~~`/debug`~~ kapandı (10-28).
3. **S1:** `www` kullanılıyor mu, apex'e yönlensin mi? Başka alt alan adı var mı?
4. **S3:** GitHub'daki `DATABASE_URL` sırrı hangi veritabanını gösteriyor (CI)?
5. **S5:** `JWT_SECRET` ve dış servis anahtarları yenilensin mi (öneri: evet)?
6. **S7:** Sentry geçişte kapalı mı kalsın, yoksa G5-K5 + AB bölgesiyle mi açılsın?
7. B2 ve Healthchecks hesapları açılınca devops'a bildirim; hesaplarda 2FA.
8. ~~Deploy key~~: gerek kalmadı (ADR-0019). İmaj ve kaynak temizliği (son 3 sürüm) kalıcı iznin "sunucu temizliği" maddesine giriyor.
9. Taşıma dallarının `master`'a birleştirilmesi (G18): ileride kurucu onayıyla.
