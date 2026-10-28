# Teknik Kararlar (ADR) — beautyos

Her önemli teknik karar (dil, framework, veritabanı, kimlik doğrulama, çok kiracılık, ödeme, barındırma, yedekleme) numaralı bir ADR olarak bu dosyanın sonuna eklenir. İsimlendirme gibi küçük kararlar yazılmaz.

- Durum: önerildi | kabul edildi | kullanımdan kalktı | yerini aldı: ADR-NNNN
- Kabul edilmiş ADR değiştirilmez. Karar değişirse yeni ADR yazılır, eskisinin durumu "yerini aldı: ADR-NNNN" yapılır.
- Kısa tut: bir ADR iki dakikada okunmalı; bağlam en fazla 10 satır.
- Geçmiş bir karar sonradan yazılıyorsa asıl tarihi belirt.

## Dizin

| No | Başlık | Durum | Tarih |
|---|---|---|---|
| ADR-0001 | Kararlar ADR formatında kaydedilir | kabul edildi | 2026-10-27 |
| ADR-0002 | Tüm yığın şirket sunucusunda Docker Compose ile çalışır | kabul edildi (kurucu kararı) | 2026-10-27 |
| ADR-0003 | PostgreSQL 17 kendi konteynerimizde; `app_owner`/`app_user` rol ayrımı; taşımada RLS eklenmez | önerildi | 2026-10-27 |
| ADR-0004 | Veri taşıma: bakım penceresinde `pg_dump`/`pg_restore`, betiği kurucu çalıştırır | yerini aldı: ADR-0017 | 2026-10-27 |
| ADR-0005 | Redis kendi konteynerimizde; Upstash verisi taşınmaz | önerildi | 2026-10-27 |
| ADR-0006 | BullMQ işçisi API sürecinde kalır; tek kopya; konteyner saati UTC | önerildi | 2026-10-27 |
| ADR-0007 | Alan adları: yol tabanlı kiracı, joker sertifika yok; API `api.beautyossapp.com` | önerildi | 2026-10-27 |
| ADR-0008 | Cloudflare proxy açık (turuncu), SSL modu Full (strict) | kabul edildi (kurucu 2026-10-28; hukuk-uyum şartlı) | 2026-10-27 |
| ADR-0009 | Sertifikalar ACME DNS-01 (caddy-dns/cloudflare), tek zona sınırlı token | kabul edildi (kurucu 2026-10-28; token doğrulandı, Caddy çalışıyor) | 2026-10-27 |
| ADR-0010 | Gerçek istemci IP'si: Caddy CF-Connecting-IP'yi yalnız Cloudflare aralıklarından kabul eder | önerildi | 2026-10-27 |
| ADR-0011 | 80/443 güvenlik duvarında Cloudflare IP'lerine kısıtlanmaz | önerildi | 2026-10-27 |
| ADR-0012 | İmajlar GitHub Actions'ta derlenip GHCR'a gider; yayın sunucuda elle çekilir | yerini aldı: ADR-0018 | 2026-10-27 |
| ADR-0013 | Kalıcı staging yok; gerekirse aynı sunucuda isteğe bağlı staging yığını | yerini aldı: ADR-0016 | 2026-10-27 |
| ADR-0014 | Taşıma Node 20 + Debian bookworm ile; Node yükseltmesi taşımadan sonra | önerildi | 2026-10-27 |
| ADR-0015 | Yedekleme: gece `pg_dump` → restic → Backblaze B2 (AB), geçişten önce denenmiş olarak hazır | önerildi (hukuk-uyum onayı: 7/4/6, şartlı) | 2026-10-27 |
| ADR-0016 | Kalıcı staging aynı compose projesinde, ortak Postgres/Redis örneğinde ayrı veritabanı ve rollerle | önerildi | 2026-10-27 |
| ADR-0017 | Veri taşınmaz; canlı veritabanı migration'larla boş kurulur, Supabase şeması yalnız uyum kontrolü için dökülür | kabul edildi (kurucu kararı) | 2026-10-28 |
| ADR-0018 | İmajlar sunucuda, belirli commit'ten derlenir; son 3 sürüm yerelde tutulur; kayıt defteri yok | kabul edildi (müdür kararı D4). **Kaynak bölümünün (deploy key + `git fetch`) yerini aldı: ADR-0019**; derleme, yük, temizlik ve geri alma bölümleri geçerli | 2026-10-28 |
| ADR-0019 | Sunucu GitHub'dan çekmez: müdür onaylı commit'i `git archive` paketiyle aktarır | kabul edildi (müdür kararı) | 2026-10-28 |
| ADR-0020 | Geçiş DNS'i müdür tarafından Cloudflare API ile, denetlenmiş bir betik ve Caddy'nin tek zonlu token'ıyla çevrilir; geri alma kayıttan | kabul edildi (müdür, 2026-10-28) | 2026-10-28 |

---

## ADR-0001: Kararlar ADR formatında kaydedilir

- **Tarih:** 2026-10-27
- **Durum:** kabul edildi
- **Karar verenler:** mimar

### Bağlam
Proje tek kişi ve ajan ekibiyle yürüyor; oturumlar arası hafıza yalnızca dosyalardır. Bir seçimin neden yapıldığı kaydedilmezse sonraki oturumda aynı tartışma tekrarlanır. BeautyOS şirket dışında başladı ve bu dosya taşıma sırasında açıldı; önceki kararlar (Supabase, Vercel, Railway, Upstash, Prisma) yalnız `docs/mevcut-durum.md`'de özetli.

### Alternatifler
- **Tek tablo (tarih/karar/gerekçe):** kısa ama reddedilen seçenekler ve sonuçlar kayboluyor.
- **Ayrı dosyalar (docs/adr/NNNN-*.md):** büyük ekipler için uygun; bu ölçekte dosya kalabalığı.

### Karar
Tüm kararlar bu dosyada, numaralı ADR bölümleri olarak tutulur.

### Sonuçlar
- **Olumlu:** Gerekçe ve reddedilen seçenekler kalıcı; denetçi mimari değişikliği ADR'siz yakalayabilir.
- **Olumsuz:** Dosya zamanla uzar; dizin tablosu güncel tutulmalı.
- **Riskler:** ADR yazılmadan karar uygulanabilir. Önlem: mimari görevlerde kabul kriteri olarak "ilgili ADR yazıldı" bulunur.

---

## ADR-0002: Tüm yığın şirket sunucusunda Docker Compose ile çalışır

- **Tarih:** 2026-10-27
- **Durum:** kabul edildi (kurucu kararı)
- **Karar verenler:** kurucu; mimar (uygulama planı)

### Bağlam
BeautyOS dört ayrı platformda çalışıyor: web Vercel'de, API Railway'de, PostgreSQL Supabase'te, Redis Upstash'te. Şirketin artık kendi sunucusu var (`sirket-sunucu-1`, DO FRA1, 2 vCPU / 4 GB). Dört platform dört fatura, dört panel, dört yurt dışı veri işleyen demek. Gerçek kullanıcı henüz yok.

### Alternatifler
- **Olduğu gibi kalmak:** sıfır iş, ama maliyet ve dağınıklık sürer; şirket standardına (ortak sunucu, compose) uymaz.
- **Yalnız uygulamayı taşımak, Supabase'i tutmak:** veritabanı yönetimi kalkar, ama gecikme ve yurt dışı işleyen sürer. Kurucu reddetti.

### Karar
Web, API (+ işçi), PostgreSQL ve Redis şirket sunucusunda `beautyos` adlı tek compose projesi olarak çalışır; önünde ortak Caddy vardır. Eski platformlar 14 gün durdurulmuş halde bekler, sonra silinir.

### Sonuçlar
- **Olumlu:** Tek yer, tek fatura, daha az veri işleyen; şirketin diğer projeleriyle aynı işletim modeli.
- **Olumsuz:** Veritabanı yedeği, güncellemesi ve izlemesi artık bizde.
- **Riskler:** Tek sunucu tek arıza noktasıdır. Önlem: yedek sunucu dışında (ADR-0015), dış izleme, belgeli geri yükleme.

---

## ADR-0003: PostgreSQL 17 kendi konteynerimizde; `app_owner`/`app_user` rol ayrımı; taşımada RLS eklenmez

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
`pg_restore` yalnız aynı ya da daha yeni bir ana sürüme güvenle yüklenir. Supabase'in sürümü bilinmiyor; yeni projeler 15 ya da 17. Şirket standardı (`coklu-kiraci-veritabani`) uygulamanın süper kullanıcıyla bağlanmamasını ve RLS'yi şart koşuyor. Mevcut kodda RLS yok; kiracı ayrımı Prisma sorgularındaki `tenantId` filtresiyle sağlanıyor.

### Alternatifler
- **PostgreSQL 16:** Prisma 5'in resmî listesinde daha kesin, ama kaynak 17 ise geri yükleme riskli.
- **PostgreSQL 18:** en yeni; Prisma 5 ile denenmemiş, kazancı yok.
- **Taşımayla birlikte RLS eklemek:** standarda uyar, ama Prisma'da her isteği işlem + `set_config` ile sarmak büyük bir kod değişikliği. Taşımayla aynı anda yapılırsa hata kaynağı ayrıştırılamaz.

### Karar
`postgres:17` (sabit küçük sürüm) kullanıyoruz. Roller:
- Süper kullanıcı (`POSTGRES_USER`) yalnız ilk kurulumda kullanılır.
- `app_owner` tabloların sahibidir ve migration'ları çalıştırır. Bağlantısı yalnız `.env.migrate`'te durur.
- `app_user` (`NOSUPERUSER NOBYPASSRLS`, yalnız DML) uygulamanın bağlandığı roldür. `ALTER DEFAULT PRIVILEGES` ile yetki alır.

Taşımada RLS eklenmez; ayrı bir proje olarak (T-B1) yeni ADR ile ele alınır.

### Sonuçlar
- **Olumlu:** Uygulama DDL ya da rol yetkisi taşımaz; RLS projesi için zemin hazır.
- **Olumsuz:** Kiracı izolasyonu hâlâ tek katmanlı (uygulama filtresi).
- **Riskler:** Prisma 5.22 + PG 17 uyumsuzluğu. Önlem: G1 testleri PG 17'de koşar. Kalırsa PG 16'ya inilir, ama yalnız kaynak ≤ 16 ise (doğrulama kaydı D1, D2).

---

## ADR-0004: Veri taşıma: bakım penceresinde `pg_dump`/`pg_restore`, betiği kurucu çalıştırır

- **Tarih:** 2026-10-27
- **Durum:** yerini aldı: ADR-0017 (2026-10-28; kurucu verinin demo olduğunu bildirdi)
- **Karar verenler:** mimar

### Bağlam
Veri korunmalı ama gerçek kullanıcı yok; kısa bir yazma kesintisi kabul edilebilir. Supabase bağlantı bilgisi gizlidir; ajanlar `.env*` okuyamaz. Supabase veritabanında `auth`, `storage`, `realtime`, `extensions` gibi bizim taşımayacağımız şemalar var.

### Alternatifler
- **Mantıksal replikasyon (publication/subscription):** kesintisiz, ama kurulum ve Supabase yetkileri karmaşık; bu ölçekte gereksiz.
- **Tam veritabanı dökümü:** Supabase'e özgü şemalar, roller ve yetkiler gelir; geri yükleme kirlenir ve hata verir.
- **Ajanın bağlantı bilgisini görmesi:** şirket kuralına aykırı.

### Karar
Yazma durdurulur (Railway API durdurulur). Kaynak iki yoldan biridir (plan §5.1):
- **(a)** Supabase projesi açıksa ya da geri açılabiliyorsa canlı kaynağa bağlanılır. Tercih edilen yol budur.
- **(b)** Proje duraklatılmış ve geri açılamıyorsa panelden indirilen yedek dosyası kullanılır. Dosya sunucuda geçici, ağsız bir ara konteynere (kaynakla aynı ana sürüm) düz SQL olarak yüklenir. `public` dışındaki Supabase nesnelerinin hataları yok sayılır, `public` hataları durdurur. Denetimler ara konteynerde yapılır. Ara konteyner ve düz dosya iş bitince silinir.

İki yolda da `pg_dump -Fc --schema=public --no-owner --no-privileges` ile döküm alınır, `pg_restore --role=app_owner --single-transaction --exit-on-error` ile yüklenir. Hedefte zaten var olan `SCHEMA public` girdisi listeden çıkarılır. İşi `deploy/betikler/veri-aktar.sh` yapar ve **kurucu çalıştırır**. Bağlantı bilgisi libpq değişkenleri olarak `.env.supabase`'ten konteynere girer, komut satırına girmez. Doğrulama satır sayısı + kimlik özeti + `prisma migrate status` ile yapılır.

### Sonuçlar
- **Olumlu:** Basit, tekrarlanabilir. Önce provada aynı betikle denenir.
- **Olumsuz:** 15–30 dk yazma kesintisi.
- **Riskler:**
  - Supabase'de panelden açılmış RLS/politika ya da `extensions.` bağımlılığı geri yüklemeyi bozar. Önlem: `on-kontrol` adımı bunları arar ve durur.
  - Supabase ücretsiz planı hareketsizlikte projeyi duraklatır (2026-10-28'de canlı `/health` `db: error` döndü). Önlem: (a)'da geri açılınca döküm hemen alınır; (b) yedek yoldur. (b)'de veri yedek tarihine kadardır ve Railway'e geri dönüş çalışmaz.

---

## ADR-0005: Redis kendi konteynerimizde; Upstash verisi taşınmaz

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
Redis'te yalnız BullMQ `reminders` kuyruğu var. İçinde randevu başına iki gecikmeli hatırlatma (belirlenimci jobId) ve bir tekrarlı gece işi bulunuyor. Rate limit Redis kullanmıyor.

### Alternatifler
- **Upstash'ten RDB/`MIGRATE` ile kopya:** TLS ve Upstash kısıtları yüzünden zahmetli. Kopyalanan işler provada çift tetiklenme riski taşır.
- **Yeniden kuyruklama betiği:** gelecekteki randevuların hatırlatmalarını korur. Kurucu yanıtına göre NetGSM SMS kapalı ve geçişte de kapalı kalıyor; hatırlatmalar zaten gönderilmeyecek. Gereksiz (G6 iptal).

### Karar
Redis 7.4 kendi konteynerimizde çalışır: `appendonly yes`, `maxmemory 128mb`, `maxmemory-policy noeviction`, parola zorunlu, port yayını yok. Canlı DB 0, staging DB 1 (ADR-0016). Upstash verisi taşınmaz; yeniden kuyruklama yapılmaz. Gece no-show işi API açılışında kendiliğinden kaydolur.

### Sonuçlar
- **Olumlu:** Taşınacak durum yok, ek betik yok.
- **Olumsuz:** Geçişten önce oluşturulmuş randevuların hatırlatma işleri kaybolur (SMS kapalıyken etkisi yok). SMS açılırsa yalnız geçiş sonrası oluşturulan randevuların işleri vardır.
- **Riskler:** `noeviction` ile bellek dolarsa yazmalar hata verir. Önlem: tamamlanan işler zaten siliniyor (`removeOnComplete`); bellek izlenir.

---

## ADR-0006: BullMQ işçisi API sürecinde kalır; tek kopya; konteyner saati UTC

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
`startReminderWorker()` API açılışında çağrılıyor; ayrı bir giriş noktası yok. Gece no-show işi cron `30 20 * * *` ile süreç saatine göre çalışıyor. "Bugün" sınırı da `setHours(0,0,0,0)` ile hesaplanıyor; Railway'de bu UTC idi. Sunucunun kendi saat dilimi `Europe/Istanbul`. `express-rate-limit` bellek içi depo kullanıyor.

### Alternatifler
- **Ayrı worker konteyneri:** API ölçeklemesi bağımsız olur, ama kod değişikliği ve ek ~150 MB bellek ister; bugünkü yükte gereksiz.
- **`TZ=Europe/Istanbul`:** daha "doğal", ama cron 23:30'dan 20:30 TR'ye kayar ve no-show tarih penceresi değişir. Taşımada davranış değiştirmek istemiyoruz.

### Karar
API ve işçi tek konteynerde, tek kopya çalışır (`replicas` ya da `scale` yok). Konteyner ortamında `TZ=UTC` açıkça yazılır. İşçi ayrımı ya da saat dilimi değişikliği gerekirse yeni ADR yazılır.

### Sonuçlar
- **Olumlu:** Davranış Railway ile birebir aynı.
- **Olumsuz:** API yeniden başlarken işçi de durur. Gecikmeli işler Redis'te kalıcı olduğu için kaybolmaz.
- **Riskler:** Biri ölçekleme için kopya artırırsa hız sınırları kopya başına ayrı sayılır. Önlem: bu ADR ve proje CLAUDE.md'deki kural.

---

## ADR-0007: Alan adları: yol tabanlı kiracı, joker sertifika yok; API `api.beautyossapp.com`

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
Kiracılar URL yolunda ayrılıyor (`/tenant/[slug]`, `/book/[slug]`); alt alan adı kullanılmıyor. Web `beautyossapp.com` (tanıtım) ve `app.beautyossapp.com` (uygulama) üzerinden çalışıyor. API şimdiye kadar `*.up.railway.app` adresindeydi; bu adres web'e derleme anında gömülü. (2026-10-28 düzeltmesi: Railway canlısı zaten `api.beautyossapp.com` özel alan adını kullanıyor. Bu yüzden `api` kaydı "yeni host" değil; geçişte `@`/`app`/`www` ile birlikte sunucuya çevrilir.)

### Alternatifler
- **API'yi aynı host altında `/api` yolundan sunmak:** CORS biter, ama tüm API yollarının (`/api/v1`, `/webhook`, `/health`) yeniden eşlenmesi ve web'de ters vekil gerekir.
- **Joker sertifika `*.beautyossapp.com`:** gelecekteki kiracı alt alan adlarına hazır olur, ama bugün ihtiyaç yok. DNS-01 ile sonradan tek satırla eklenir.

### Karar
Hostlar şunlar: `beautyossapp.com`, `www.beautyossapp.com`, `app.beautyossapp.com` → web; `api.beautyossapp.com` → API; kalıcı staging `yeni.beautyossapp.com` (web) ve `yeni-api.beautyossapp.com` (API) (ADR-0016). İki seviyeli alt alan adı (`api.yeni.…`) kullanılmaz: Cloudflare'in ücretsiz kenar sertifikası yalnız tek seviyeyi kapsar. Her host için ayrı sertifika alınır. `NEXT_PUBLIC_API_URL=https://api.beautyossapp.com`, `ALLOWED_ORIGINS` apex + `app` + `www`.

### Sonuçlar
- **Olumlu:** API adresi bizim alan adımızda; platform değişse de web yeniden derlenmez. `refreshToken` çerezi artık aynı site içinde.
- **Olumsuz:** CORS hâlâ gerekli.
- **Riskler:** `www`'nun kullanılıp kullanılmadığı bilinmiyor (Soru S1).

---

## ADR-0008: Cloudflare proxy açık (turuncu), SSL modu Full (strict)

- **Tarih:** 2026-10-27
- **Durum:** kabul edildi (kurucu 2026-10-28; hukuk-uyum ŞARTLI ONAY, `docs/kvkk-tasima-degerlendirmesi.md` §4)
- **Karar verenler:** mimar; hukuk-uyum; kurucu (alan adı ve DNS Cloudflare'de)

### Bağlam
DNS Cloudflare'de. Sunucu ortak ve IP'si sabit. Proxy açıkken TLS Cloudflare'de sonlanır ve yeniden şifrelenir; yani kişisel veri Cloudflare'in (ABD şirketi) kenar sunucularından açık halde geçer. Bot Fight Mode ücretsiz planda kuralla atlanamaz.

### Alternatifler
- **Gri bulut (yalnız DNS):** Cloudflare veri yolunda değil, IP doğrudan gelir. Ama origin IP açıkta kalır, DDoS koruması ve statik önbellek olmaz.
- **SSL Flexible / Full (strict olmayan):** Cloudflare ile sunucu arası şifresiz ya da doğrulamasız olur. Reddedildi.

### Karar
`beautyossapp.com` hostları turuncu bulutla kullanılır, zone SSL modu **Full (strict)**, "Always Use HTTPS" açık. Bot Fight Mode ve "Under Attack" kapalı kalır (Telegram/NetGSM çağrıları engellenmesin). HSTS, geçiş oturduktan sonra ayrı adımda açılır. Hukuk-uyum şartları:
- Minimum TLS 1.2.
- `api` ve `yeni-api` için "Bypass cache" kuralı; API ya da `/tenant/*`, `/book/*` yollarına "Cache Everything" uygulanmaz.
- Web Analytics/RUM, Zaraz, Logpush ve Workers kapalı.
- Cloudflare hesabında 2FA.
- Cloudflare, DPA alt işleyen listesine yazılır.
- İlk gerçek müşteriden önce KVKK m.9 mekanizması kurulur. Kurulamazsa yalnız `api` gri buluta alınır; Caddy yapılandırması (ADR-0009, 0010) değişmeden çalışır.

### Sonuçlar
- **Olumlu:** DDoS koruması, origin gizliliği, DNS değişikliğinin anında yayılması.
- **Olumsuz:** Cloudflare veri yolunda; 100 sn istek zaman aşımı ve 100 MB gövde sınırı var (bugünkü kullanımda sorun değil).
- **Riskler:** Full (strict) zone geneline uygulanır. Vercel geçerli sertifika sunduğu için geçişten önce açmak güvenli.

---

## ADR-0009: Sertifikalar ACME DNS-01 (caddy-dns/cloudflare), tek zona sınırlı token

- **Tarih:** 2026-10-27
- **Durum:** kabul edildi (kurucu 2026-10-28; token oluşturuldu ve sunucuda doğrulandı, ortak Caddy çalışıyor)
- **Karar verenler:** mimar, devops, kurucu

### Bağlam
Proxy açıkken HTTP-01 doğrulaması Cloudflare'den geçmek zorunda ve kırılgan. Ayrıca sertifikayı DNS geçişinden **önce** almak istiyoruz; geçiş anında bekleme olmasın. Ortak Caddy ileride Cloudflare kullanmayan müşteri alan adlarını da sunacak.

### Alternatifler
- **Cloudflare Origin CA sertifikası (15 yıl):** ACME ve token gerekmez, ama yalnız Cloudflare'e güvenilir. Gri buluta dönüş imkânını kapatır; özel anahtar dosyası elle yönetilir.
- **HTTP-01 / TLS-ALPN-01 (Caddy varsayılanı):** eklenti gerekmez, ama sertifika ancak DNS sunucuyu gösterdikten sonra alınır; proxy ile kırılgan.

### Karar
Ortak Caddy, `caddy-dns/cloudflare` eklentili özel imajla çalışır. Cloudflare dışındaki alan adları varsayılan HTTP-01/TLS-ALPN ile devam eder. Token Cloudflare'de **yalnız `Zone:DNS:Edit` + `Zone:Zone:Read` izinli ve yalnız `beautyossapp.com` zonuna sınırlı** olarak oluşturulur (kurucu). Değeri `/srv/caddy/.env` içinde `CLOUDFLARE_API_TOKEN` olarak durur. Uygulama ayrıntısı sunucu-altyapi ADR-0006..0010'dadır.

### Sonuçlar
- **Olumlu:** Proxy kipinden bağımsız, otomatik yenileme, geçiş öncesi sertifika.
- **Olumsuz:** Özel Caddy imajı derlenmeli ve eklenti sürümleri takip edilmeli.
- **Riskler:** Token sızarsa saldırgan bu zonun DNS kayıtlarını değiştirebilir. Önlem: tek zon, tek izin; token yalnız Caddy konteynerinde; kapatma aşamasında yenilenir.

---

## ADR-0010: Gerçek istemci IP'si: Caddy CF-Connecting-IP'yi yalnız Cloudflare aralıklarından kabul eder

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar, devops

### Bağlam
API'de `trust proxy 1` var; hız sınırları (giriş 15 dk / 10 istek, SMS doğrulama) `req.ip`'ye göre sayılıyor. Zincir Cloudflare → Caddy → API. Caddy varsayılanında `X-Forwarded-For` "istemci, cloudflare-kenarı" olur ve Express kenar IP'sini görür. Bu durumda tüm kullanıcılar birkaç IP'de toplanır ve birbirini kilitler.

### Alternatifler
- **Express `trust proxy 2`:** kod değişikliği ister; doğrudan gelen isteklerde yanlış hop sayısına güvenir.
- **Uygulamada `CF-Connecting-IP` okumak:** herkes bu başlığı sahteleyebilir (origin açık).

### Karar
Caddy genel ayarında `trusted_proxies static <Cloudflare aralıkları>` ve `client_ip_headers CF-Connecting-IP` kullanılır. Ek eklenti ve tedarik zinciri bağımlılığı olmasın diye liste statiktir; devops ayda bir `11-caddy.sh --ip-kontrol` ile Cloudflare'in yayımladığı listeyle karşılaştırır. Her `reverse_proxy` bloğunda `header_up X-Forwarded-For {client_ip}` yazılır. Express tek değer görür; `trust proxy 1` doğru IP'yi verir. Cloudflare dışından gelen bağlantıda başlık yok sayılır.

### Sonuçlar
- **Olumlu:** Kod değişmez; sahte IP enjekte edilemez.
- **Olumsuz:** Liste elle güncel tutulur.
- **Riskler:** Cloudflare yeni aralık eklerse o aralıktan gelen isteklerde kenar IP'si görünür. Önlem: aylık `--ip-kontrol` ve G14'te iki farklı istemciden giriş denemesi + API log'unda IP doğrulaması.

---

## ADR-0011: 80/443 güvenlik duvarında Cloudflare IP'lerine kısıtlanmaz

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
Sunucu ortaktır; ileride Cloudflare kullanmayan müşteri alan adları da aynı Caddy'den sunulacak. Origin IP'si zaten belgelerde ve DNS geçmişinde biliniyor. Kısıt ufw ve DO Cloud Firewall'da uygulanırsa tüm projeleri etkiler.

### Alternatifler
- **ufw/Cloud Firewall'da 80/443'ü yalnız Cloudflare'e açmak:** origin tam gizlenir, ama diğer müşterileri keser. Ayrıca Cloudflare aralıkları değiştikçe bakım gerektirir.
- **Authenticated Origin Pulls (mTLS):** güçlü, ama Caddy'de istemci sertifikası yönetimi ekler.

### Karar
Güvenlik duvarında kısıt yok. İsteğe bağlı sonraki adım: Caddy'de yalnız BeautyOS hostları için "Cloudflare dışı kaynağa 403" kuralı. Geçişten 14 gün sonra yeni ADR ile değerlendirilir.

### Sonuçlar
- **Olumlu:** Ortak sunucu esnek kalır.
- **Olumsuz:** Saldırgan Cloudflare'i atlayıp doğrudan IP'ye gelebilir (hız sınırları ve IP tespiti yine doğru çalışır, ADR-0010).
- **Riskler:** Doğrudan DDoS. Önlem: DO Cloud Firewall + izleme; gerekirse yeni ADR.

---

## ADR-0012: İmajlar GitHub Actions'ta derlenip GHCR'a gider; yayın sunucuda elle çekilir

- **Tarih:** 2026-10-27
- **Durum:** yerini aldı: ADR-0018 (2026-10-28; GitHub Free planında özel paket kotası 500 MB depolama / 1 GB aylık aktarım, yetersiz)
- **Karar verenler:** mimar

### Bağlam
`next build` 1,5–2 GB bellek ister; sunucu 4 GB ve canlı Postgres'le ortak. Kurucunun makinesinde Docker ve Node kurulu değil. Şirket kuralı: canlıya alma denetçi ONAY'ı ve test GEÇTİ sonrası yapılır. Bugünkü "`master` push = canlı" akışı bu kurala aykırı.

### Alternatifler
- **Sunucuda `git pull` + `docker compose build`:** kayıt defteri gerekmez, ama derleme canlı servislerle bellek yarışına girer ve sunucuya depo erişim anahtarı gerekir.
- **Actions'tan SSH ile otomatik dağıtım:** hızlı, ama GitHub'a sunucu anahtarı verilir ve onaysız canlıya alma geri gelir.

### Karar
`.github/workflows/imaj.yml` (`workflow_dispatch` + `v*` etiketi) özel GHCR'a üç imaj iter: tek API imajı `beautyos-api:<sha-12>` ve ortam başına iki web imajı, `beautyos-web:<sha-12>-prod` ile `-staging`. Web'in iki imajı olmasının nedeni `NEXT_PUBLIC_API_URL`'in derlemede gömülmesi. `NEXT_PUBLIC_*` derleme değerleri repository variables'tan gelir. Önce staging'e, test GEÇTİ sonrası canlıya çıkılır. Yayını devops sunucuda yapar: imaj etiketini compose'da günceller, ardından `pull` + `up -d`. Sunucu GHCR'a yalnız `read:packages` token'ıyla bağlanır.

### Sonuçlar
- **Olumlu:** Sunucuda derleme yükü yok; her sürüm sabit etiketli; geri alma tek satır.
- **Olumsuz:** Yayın elle yapılır (bilinçli tercih).
- **Riskler:** GHCR özel paket kotası ya da ücreti (doğrulama D4). Sorun çıkarsa yedek yol: geceleyin, bellek sınırıyla sunucuda derleme. Prova sırasında test ortamı sunucuda derlenebilir; canlı imaj yine bu iş akışından gelir.

---

## ADR-0013: Kalıcı staging yok; gerekirse aynı sunucuda isteğe bağlı staging yığını

- **Tarih:** 2026-10-27
- **Durum:** yerini aldı: ADR-0016 (kurucu kalıcı staging istedi)
- **Karar verenler:** mimar

### Bağlam
Bugün Railway staging + Vercel preview + ayrı Supabase staging projesi var. Sunucuya kalıcı staging eklemek bellek bütçesini (ADR-0002, plan §2) ikiye katlar. Gerçek kullanıcı yok; doğrulama zinciri CI testleri + denetçi + test mühendisinden oluşuyor.

### Alternatifler
- **Kalıcı staging (ikinci compose projesi):** canlıya en yakın ortam, ama sürekli ~1 GB bellek.
- **Staging'i dış platformda bırakmak:** "her şey taşınacak" kurucu kararına aykırı.

### Karar
Kalıcı staging kurulmaz. Gerektiğinde `beautyos-staging` compose projesi aynı sunucuda ayrı volume'larla, `staging.beautyossapp.com` + Caddy basic auth arkasında açılır; iş bitince durdurulur. Eski staging ortamları kapatılır; staging verisi taşınmaz (VARSAYIM, Soru S3).

### Sonuçlar
- **Olumlu:** Bellek ve bakım tasarrufu.
- **Olumsuz:** Kabul testi için ortam her seferinde açılır.
- **Riskler:** Canlıya yakın test eksikliği. Önlem: CI'da gerçek Postgres/Redis; taşımada kuru prova.

---

## ADR-0014: Taşıma Node 20 + Debian bookworm ile; Node yükseltmesi taşımadan sonra

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar

### Bağlam
Node 20 Nisan 2026'da destek dışı kaldı. Mevcut imaj `node:20-bullseye-slim`; Debian 11'in desteği de bitiyor. (2026-10-28 notu: bullseye apt deposu kapandığı için Railway derlemesi düştü. Kök Dockerfile da aynı gerekçeyle `node:20.20.2-bookworm-slim`'e alındı (`e68459f`, denetçi ONAY'lı). Prisma `binaryTargets`'a dokunulmadı, motor hatası yok.) Prisma motoru işletim sisteminin OpenSSL sürümüne bağlı. Bir taşımada aynı anda birden fazla değişken değişirse arıza kaynağı ayrıştırılamaz.

### Alternatifler
- **Taşımayla birlikte Node 22/24:** tek seferde biter, ama hata kaynağı belirsizleşir.
- **bullseye'da kalmak:** Prisma değişmez, ama destek dışı bir işletim sistemi.

### Karar
Taşıma imajları `node:20.x-bookworm-slim` (sabit küçük sürüm) ile derlenir. `prisma generate`, çalışma imajıyla aynı tabanlı aşamada çalışır; bu sayede şemaya dokunmadan `native` hedef tutar. Node 22/24 LTS yükseltmesi, taşıma oturduktan sonra ayrı görevdir (G18).

### Sonuçlar
- **Olumlu:** Davranış değişikliği en az; işletim sistemi destekli.
- **Olumsuz:** Birkaç hafta destek dışı Node çalışır.
- **Riskler:** Node 20 güvenlik açığı. Önlem: G18 taşıma +14 günde planlanır.

---

## ADR-0015: Yedekleme: gece `pg_dump` → restic → Backblaze B2 (AB), geçişten önce denenmiş olarak hazır

- **Tarih:** 2026-10-27
- **Durum:** önerildi (hukuk-uyum ONAY: 7/4/6, B2 sürüm ayarı ve imha kaydı şartıyla)
- **Karar verenler:** mimar, devops, hukuk-uyum

### Bağlam
Veritabanı artık bizde ve özel nitelikli kişisel veri (anamnez) içeriyor. Sunucuda henüz yedek yok. Şirket kuralı: yedek sunucu dışında ve şifreli tutulur, geri yükleme denenerek doğrulanır, yurt dışı depolama `hukuk-uyum` onayı ister.

### Alternatifler
- **Yalnız DO droplet yedeği:** kolay, ama tüm diski kapsar ve aynı sağlayıcıda durur. Tek başına yeterli değil. Kurucu günlük droplet yedeğini (7 gün) zaten açtı; ikinci katman olarak kalır.
- **Yalnız yerel döküm:** sunucu kaybında yedek de gider.

### Karar
Her gece 03:30 (TR) `pg_dump -Fc` (canlı + staging veritabanları + rol dökümü) çıktısı restic ile B2 AB bölgesine gider. Şifreleme istemci tarafında yapılır; restic parolası sunucu-altyapi'nin yedek ortam dosyasında ve kurucunun parola yöneticisinde durur. Saklama 7 günlük / 4 haftalık / 6 aylık.

Hukuk-uyum şartları:
- B2 kovasında yaşam döngüsü "yalnız son sürüm" olmalı; yoksa `forget --prune` veriyi silmez.
- Gece `forget`, haftalık `prune`.
- `--keep-tag arsiv` kullanılmaz. (2026-10-28: veri taşınmadığı için taşıma arşivi yok; 30 günlük arşiv şartı konusuz kaldı, ADR-0017.)
- Her imha işlemi için kayıt tutulur.

Başarısız iş Healthchecks üzerinden Telegram'a uyarı yollar. **Geçiş, en az bir başarılı yedek ve belgeli bir geri yükleme denemesi olmadan yapılmaz.** Uygulama ortak altyapıdadır (sunucu-altyapi, devops).

### Sonuçlar
- **Olumlu:** Sunucu dışında, şifreli, test edilmiş yedek.
- **Olumsuz:** B2 hesabı ve küçük bir aylık ücret.
- **Riskler:** restic parolası kaybolursa yedek açılamaz. Önlem: parola kurucunun parola yöneticisinde ikinci kopya olarak durur.

---

## Doğrulama kaydı

Mimar deney yapamıyor; aşağıdaki varsayımlar ilgili görevde doğrulanır ve sonuç buraya yazılır.

| No | Varsayım | Beklenen | Doğrulayan | Sonuç |
|---|---|---|---|---|
| D1 | Supabase PostgreSQL ana sürümü ≤ 17 (pg_dump 17 istemcisi şema dökebilsin) | `kaynak` sürümü yazar | G13 | — |
| D2 | Prisma 5.22 PostgreSQL 17'de sorunsuz (migrate deploy + testler) | CI yeşil | G1 | — |
| D3 | Prisma Client çalışma anında `DIRECT_URL` ister | Yoksa açılış hatası; bu yüzden `.env`'de `DATABASE_URL` ile aynı değer | G2 | — |
| D4 | GHCR özel paket depolama/indirme bu ölçekte ücretsiz ya da kota içinde | Fatura/kota uyarısı yok | G7 | **Olumsuz (2026-10-28):** GitHub Free, özel paket 500 MB / 1 GB aylık aktarım; bir sürümün üç imajı birkaç yüz MB. ADR-0018'e geçildi |
| D15 | Sunucuda `git` yüklü (`git get-tar-commit-id` için; ADR-0019) | `git --version` çıktı verir | G7 | **Olumlu (10-28):** git 2.43.0 |
| D14 | Sunucuda web (`next build`) derlemesi bellek sınırıyla canlı servisleri etkilemeden biter | Tepe bellek ve süre ölçülür; canlı `/health` derleme boyunca 200 | G7-K4 | **Olumlu (10-28):** Soğuk derleme canlı yığın açıkken yapıldı; sınırlı buildx builder (`memory=2g`, `memory-swap=3g`, 1,5 CPU) ve `NODE_HEAP_MB=1536` kullanıldı. Süreler: api 113 sn, web-prod 205 sn, web-staging 166 sn. Sistem tepe belleği 1715 MB (yığın tabanı ~900 MB); tepe swap 37 MB; api sağlık kontrolü 231/231 healthy. **Sonuç:** ADR-0018 yük seçeneği (b) uygulanıyor, ek swap gerekmiyor |
| D16 | Windows'ta `git archive` satır sonlarını değiştirmez | Paket LF içerir | G7 | **Olumsuz (10-28):** `core.autocrlf=true` iken `git archive` dosyaları CRLF'ye çevirip kabuk betiklerini ve Dockerfile'ı bozuyor. Paketleme komutu **`git -c core.autocrlf=false archive …`** olmalı (plan §6, `deploy/README.md`). `.gitattributes` da kritik dosyalarda `eol=lf` zorluyor |
| D5 | Statik CF listesiyle `trusted_proxies` + `header_up X-Forwarded-For {client_ip}` ile Express gerçek IP'yi görür | API log'unda istemci IP'si | G8/G14 | — |
| D6 | Turnstile widget'ı `yeni.beautyossapp.com`'da çalışır (alt alan adı otomatik ya da eklenince) | Herkese açık randevu staging'de geçer | G14 | — |
| D7 | Supabase'e sunucudan Session pooler (IPv4) ile `pg_dump --schema-only` yapılabilir | `kaynak` bağlanır | G13 | 2026-10-28: canlı proje `beautyos-dev` kesinleşti ve açıldı (canlı `/health` `db: ok`); 7 gün içinde yeniden duraklar. Pooler bağlantısı kurucu komutuyla denenecek (plan §5.1) |
| D8 | Supabase `public` şemasında RLS/politika/`extensions.` bağımlılığı yok | `kaynak-bilgi.txt` boş liste (bilgi amaçlı; veri taşınmadığı için engel değil) | G13 | — |
| D11 | ~~Yedek dosyası ara konteynerde yüklenir~~ | — | — | Geçersiz: veri taşınmıyor (ADR-0017) |
| D12 | `schema.prisma` ile migration'lar uyumlu (`prisma migrate diff --exit-code` boş) | CI adımı yeşil | G1-K6 | — |
| D13 | Canlı Supabase `public` şeması = migration'larla kurulan şema | `sema-fark.txt` boş ya da yalnız gürültü | G13 | **Kısmen (10-28):** tek şema farkı, depoda olmayan 2 migration (WhatsApp numara alanı, iyzico abonelik). **Kurucu kararıyla terk edildi**; esas depodaki 19 migration. Ayrıca 5 migration'da yalnız CRLF kaynaklı checksum farkı var. Başka fark yok |
| D9 | NetGSM API'de IP kısıtı yok ya da sunucu IP'si eklendi | — | — | Geçersiz: SMS kapalı (kurucu, 2026-10-27). SMS açılırken yeniden sorulur |
| D10 | Aynı Postgres örneğinde `app_user` staging veritabanına, `stg_user` canlı veritabanına bağlanamaz | Bağlantı reddi | G11-K3 | — |

---

## ADR-0016: Kalıcı staging aynı compose projesinde, ortak Postgres/Redis örneğinde ayrı veritabanı ve rollerle

- **Tarih:** 2026-10-27
- **Durum:** önerildi
- **Karar verenler:** mimar; kurucu (kalıcı staging talebi)

### Bağlam
Kurucu, taşımadan sonra geliştirmenin bu sunucuda süreceğini ve `yeni.beautyossapp.com`'da kalıcı bir staging istediğini bildirdi. Bellek bütçesi aşılmamalı. Ayrı bir tam yığın (web + api + postgres + redis) ~1,6 GB sınır ister ve toplamı ~3,6 GB'a çıkarır. Gerçek kullanıcı yok, SMS kapalı.

### Alternatifler
- **Ayrı compose projesi, kendi Postgres ve Redis'iyle:** en iyi yalıtım, ama bellek bütçesini aşar.
- **Staging'in canlı yığının ağına dışarıdan bağlanması:** skill kuralına aykırı (proje ağları birbirine bağlanmaz).
- **İsteğe bağlı staging (ADR-0013):** kurucu kalıcı istedi.

### Karar
Staging aynı `beautyos` compose projesinde `web-staging` (256M) ve `api-staging` (384M) servisleri olarak çalışır. Aynı Postgres örneğinde ayrı `beautyos_staging` veritabanı ve ayrı `stg_owner`/`stg_user` rolleri kullanılır. İki veritabanında `REVOKE CONNECT … FROM PUBLIC` yapılır; her rol yalnız kendi veritabanına bağlanır. Redis aynı örnekte DB 1'i kullanır. Diğer kurallar:
- `.env.staging` içinde ayrı `JWT_SECRET` ve SMS kapalı.
- Hostlar `yeni.beautyossapp.com` (basic auth) ve `yeni-api.beautyossapp.com`.
- Canlı veri staging'e kopyalanmaz.
- Yayınlar servis adıyla ayrılır.

### Sonuçlar
- **Olumlu:** +640 MB sınırla kalıcı staging; toplam sınır ~2,6 GB.
- **Olumsuz:** Postgres ve Redis bakım ya da yeniden başlatmaları iki ortamı birlikte etkiler. Staging'deki ağır bir sorgu canlıyı yavaşlatabilir.
- **Riskler:**
  - Yanlış yapılandırmayla staging'in canlı veritabanına bağlanması. Önlem: rol bazlı `CONNECT` kısıtı + D10 testi + ayrı JWT.
  - **Redis'te sınır yok** (denetim bulgusu, `raporlar/denetim/beautyos-tasima-1.md`). Staging, canlıyla aynı Redis parolasını kullanıyor ve aynı sunucuda; canlının DB 0'ına (BullMQ `reminders` kuyruğu) erişebiliyor. DB numarası güvenlik sınırı değildir. Önlem G19: Redis ACL ile ortam başına ayrı kullanıcı, staging kullanıcısına yalnız kendi anahtar önekine izin (`~stg:*`), BullMQ `prefix` ayarı. İlk gerçek müşteriden önce tamamlanır. O zamana kadar kabul edilen risk: gerçek kullanıcı yok ve SMS kapalı.
  - Staging sürüm etiketi `BEAUTYOS_STAGING_VERSION` zorunlu ve canlıdan ayrıdır; boşsa compose durur, canlı sürüme düşmez.
  - **İlk gerçek müşteriden önce** staging'in canlı Postgres'inden ayrılması (ayrı örnek ya da büyütülmüş droplet) yeniden değerlendirilir; bellek > %85 olursa staging durdurulur.

---

## ADR-0017: Veri taşınmaz; canlı veritabanı migration'larla boş kurulur, Supabase şeması yalnız uyum kontrolü için dökülür

- **Tarih:** 2026-10-28
- **Durum:** kabul edildi (kurucu kararı)
- **Karar verenler:** kurucu; mimar (uygulama)

### Bağlam
Kurucu, Supabase'teki verinin demo olduğunu, önemli olanın yalnız tablo yapısı olduğunu bildirdi. Supabase'te iki proje var (`beautyos-dev`, `beautyos-staging`, eu-west-1); ikisi de duraklatılmış. Uygulamanın şeması depoda `schema.prisma` + 19 migration olarak duruyor. Tek risk, Supabase'te migration'a girmemiş elle ya da `db push` ile yapılmış bir şema değişikliğinin kaybolması.

### Alternatifler
- **ADR-0004 (veri aktarımı, iki yollu):** demo veri için gereksiz iş. Kişisel veri kopyası, döküm dosyası ve arşiv yükü getirir.
- **Hiç kontrol etmeden boş kurmak:** en hızlı, ama Supabase'teki şema sapması fark edilmez.

### Karar
Canlı `beautyos` ve staging `beautyos_staging` veritabanları `01-roller.sh` + `prisma migrate deploy` ile boş kurulur; Supabase'ten veri gelmez. Uyum iki adımda doğrulanır:
1. CI'da `schema.prisma` ↔ migration'lar (`prisma migrate diff --exit-code`).
2. Canlı Supabase projesinin `public` şemasının `--schema-only` dökümü, migration'larla geçici bir veritabanında kurulan şemanın dökümüyle karşılaştırılır (`sema-karsilastir.sh`). Döküm komutunu kurucu çalıştırır. Satır okunmaz.

Fark varsa referans `schema.prisma`'dır. Eksik migration için düzeltici migration yazılır (mevcut migration'lar değiştirilmez). `schema.prisma` dışı farklar mimara gider. Supabase açılamazsa yalnız 1. adım yapılır ve risk kabul edilir.

### Sonuçlar
- **Olumlu:** Kişisel veri hiç taşınmaz (KVKK açısından en temiz yol). Döküm, arşiv ve yerel kopya yok. Geçiş, canlı yığın önceden kurulduktan sonra yalnız DNS değişikliğine iner. Geri dönüş yalnız DNS'i geri almaktır.
- **Olumsuz:** Demo veri kaybolur (kurucu kabul etti). Kurucunun test hesapları yeniden oluşturulur. İlk süper yönetici seed uç noktasıyla açılır, ardından `ADMIN_SEED_SECRET` boşaltılır.
- **Riskler:** Supabase'teki şema sapması karşılaştırmada yanlış normalleştirme yüzünden gözden kaçabilir. Önlem: G12-K7'deki tek farklı negatif denemeler. Supabase projeleri silinmeden önce karşılaştırmanın bitmiş olması (G17 sırası).

---

## ADR-0018: İmajlar sunucuda, belirli commit'ten derlenir; son 3 sürüm yerelde tutulur; kayıt defteri yok

- **Tarih:** 2026-10-28
- **Durum:** kabul edildi (müdür kararı D4). Otomatik imaj silme kuralı (son 3'ü tut) kurucu onayına bağlıdır, müdür alır. **"Kaynak" bölümünün ve derleme adımı 2–3'ün yerini ADR-0019 aldı (2026-10-28):** deploy key yok, `git fetch` yok; kaynak müdürün aktardığı pakettir. Bu ADR'nin geri kalanı geçerli.
- **Karar verenler:** müdür; mimar (tasarım)

### Bağlam
GitHub Free planında özel paketlere 500 MB depolama ve aylık 1 GB aktarım düşüyor. Bir sürümün üç imajı (api, web-prod, web-staging) sıkıştırılmış halde birkaç yüz MB tuttuğu için GHCR bir iki sürümde doluyor (D4). Kurucunun makinesinde Docker yok. gelistirici sunucuda derlemeyi t3'te başarıyla denedi. Sunucu 2 vCPU / 4 GB + 2 GB swap ve canlı Postgres'le ortak; `next build` 1,5–2 GB isteyebilir.

### Alternatifler
- **GHCR (ADR-0012):** kota yetmiyor; ücretli plan maliyet getiriyor.
- **Docker Hub / DO Container Registry ücretsiz katman:** tek özel depo ya da 500 MB; aynı kota sorunu, üstüne ikinci bir hesap ve kimlik bilgisi.
- **Actions'ta derleyip `docker save | ssh` ile aktarma:** GitHub'a sunucu SSH anahtarı vermek gerekir; onaysız canlıya alma kapısı açılır.

### Karar
**Kaynak:**
- Sunucu depoyu `/srv/beautyos/kaynak` dizinine, **yalnız bu depoya bağlı, salt okunur bir GitHub deploy key** ile çeker.
- Anahtarı kurucu sunucuda üretir (`ssh-keygen -t ed25519`, `~karateke/.ssh/` altında, 600). Açık anahtarı GitHub'da depo ayarlarından "Deploy keys" bölümüne **"Allow write access" işaretsiz** ekler. `~/.ssh/config`'te yalnız bu depo için bir takma ad tanımlanır (`IdentitiesOnly yes`).
- Ajanlar anahtar dosyasını okumaz. Kayıt defteri, kayıt defteri kimlik bilgisi ve `docker login` yok.

**Derleme** (`deploy/betikler/derle.sh <commit-sha>`, gelistirici yazar, devops çalıştırır):
1. Yalnız tam ya da en az 12 haneli onaltılık commit kimliği kabul edilir; dal adı ya da etiket kabul edilmez.
2. Betik `git fetch origin`, ardından `git cat-file -e <sha>^{commit}` çalıştırır, sonra `git checkout --detach <sha>` ile commit'e geçer. Çalışma ağacı temiz değilse durur.
3. Canlıya giden imaj **yalnız GitHub'a push edilmiş ve denetçi ONAY'lı commit'ten** derlenir. Test ortamı için `git archive` ile yükleme serbesttir, ama o imajlar canlıya çıkmaz.
4. Etiketler (`sha12` = commit'in ilk 12 hanesi):
   - `beautyos-api:<sha12>`
   - `beautyos-web:<sha12>-prod`
   - `beautyos-web:<sha12>-staging`

   `IMAGE_PREFIX` sunucuda boştur. Ayrıca `org.opencontainers.image.revision=<sha>` etiketi eklenir.
5. Web derleme değerleri (`NEXT_PUBLIC_*`, gizli değil) depoda izlenen bir dosyadan gelir: `deploy/derleme.conf`. `.env*` dosyalarından okunmaz.

**Sunucu yükü:**
- Derlemeler **sırayla** yapılır (api, web-prod, web-staging), aynı anda tek derleme çalışır (`flock` kilidi). Canlı Postgres'le bellek yarışını sınırlamak için:
  - (a) Web derleme aşamasında `NODE_OPTIONS=--max-old-space-size=1536`.
  - (b) BuildKit, bellek ve CPU sınırlı ayrı bir builder'da çalışır: `docker buildx create --driver docker-container`, ardından `--driver-opt` ile `memory=2g`, `memory-swap=3g` ve CPU kotası yaklaşık 1,5 çekirdek; `--load` ile yerel imaja aktarılır. (b) çalışmazsa (a) + sıralı derleme + izleme yeterli sayılır. Seçim D14 ölçümüne göre yapılır, ADR'ye işlenir.
- Derleme düşük trafik saatinde yapılır; 03:00–04:30 değil (yedek + otomatik yeniden başlatma).
- **Ek swap varsayılan değil.** Mevcut 2 GB swap (sunucu-altyapi ADR-0005) güvenlik ağıdır. D14 ölçümünde tepe bellek kullanılabilir alanı aşarsa devops, sunucu-altyapi'de derleme süresince açılıp kapanan geçici bir swap dosyası ya da kalıcı artış için ADR önerir `[ONAY]`. Swap ayarı derleme betiğine gömülmez.
- Derleme sırasında canlı `/health` izlenir. Derleme OOM ile düşerse canlı servisler etkilenmemiş olmalıdır; etkilenirse müdüre bildirilir.

**Temizlik** (`deploy/betikler/imaj-temizle.sh`, derlemenin sonunda çağrılır):
- Her imaj adı için **son 3 sürüm** tutulur.
- Çalışan ya da durmuş herhangi bir konteynerin kullandığı imaj, `.env`'deki `BEAUTYOS_VERSION` ve `BEAUTYOS_STAGING_VERSION` **hiçbir koşulda silinmez**.
- Sonra `docker builder prune --filter until=168h` çalışır. Silinen etiketler log'a yazılır.
- Kuralın kendisi kurucu onayıyla bir kez kabul edilir; kural dışı silme ayrıca `[ONAY]` ister.

**Yayın ve geri alma:** `.env`'de sürüm etiketi değiştirilir, `docker compose up -d <servisler>` çalıştırılır. Geri almak için önceki etikete dönülür; imaj yerelde durur, çekme gerekmez.

**CI:** `.github/workflows/imaj.yml` (`c82bab8`), GHCR'a itmeyen bir **derleme kontrolüne** dönüşür: `push: false`, yetki yalnız `contents: read`, GHCR girişi yok. Tetikleyiciler PR ve `workflow_dispatch`. Dockerfile kırılmalarını sunucuya gelmeden yakalar.

### Sonuçlar
- **Olumlu:**
  - Kota ve kayıt defteri hesabı yok, ücret yok.
  - GitHub'a sunucu erişimi verilmiyor; sunucu yalnız okuyor.
  - Geri alma tek satır ve anında.
  - İmaj hangi commit'ten geldiğini etiketinde taşıyor.
- **Olumsuz:**
  - Derleme sunucuya CPU ve bellek yükü bindirir; birkaç dakika sürer.
  - Web derleme değerleri değişirse yeniden derleme gerekir.
- **Riskler:**
  - Derleme sırasında OOM ya da canlı yavaşlama. Önlem: sınırlı builder, sıralı derleme, düşük trafik saati, D14 ölçümü, gerekirse geçici swap ADR'si.
  - Deploy key sızarsa depo kaynak kodu okunur (yazılamaz). Önlem: anahtar yalnız sunucuda, 600 izinli, tek depoya bağlı; sızıntıda GitHub'dan kaldırılıp yenilenir.
  - Sunucu tek kopya yerdir. İmajlar yedeklenmez, ama her an commit'ten yeniden derlenebilir.

---

## ADR-0019: Sunucu GitHub'dan çekmez: müdür onaylı commit'i `git archive` paketiyle aktarır

- **Tarih:** 2026-10-28
- **Durum:** kabul edildi (müdür kararı). ADR-0018'in "Kaynak" bölümünün yerini alır.
- **Karar verenler:** müdür; mimar (tasarım)

### Bağlam
ADR-0018'de sunucunun derlenecek commit'i GitHub'dan salt okunur deploy key ile çekmesi öngörülmüştü. Bunun için taşıma dallarının GitHub'a push edilmesi gerekiyordu. Ancak:
- Kalıcı izin yalnız onaylı düzeltme push'unu kapsıyor; taşıma dallarının push'u her seferinde kurucu onayı istiyor.
- Vercel her dal push'unda preview derlemesi açıyor.
- Deploy key, kurucunun yapması gereken ek bir adım.

### Alternatifler
- **ADR-0018 yolu (push + deploy key):** izlenebilir, ama her sürümde kurucu onayı gerekir, Vercel preview'ları açılır ve sunucuda depo erişimi olur.
- **Kaynağı `git archive | ssh` boru hattıyla aktarmak:** tek adım, ama PowerShell 5.1 boru hattı ikili veriyi bozar (sunucu-altyapi CLAUDE.md). Bu yüzden dosyaya yazılıp `scp` ile taşınır.

### Karar
**Paketleme** (müdür, bu bilgisayarda; commit yerel depoda bulunur, push gerekmez):
```
git -C <depo/worktree> archive --format=tar -o beautyos-<sha12>.tar <tam-sha>
certutil -hashfile beautyos-<sha12>.tar SHA256      (özet not edilir)
```
- `git archive`, commit verildiğinde tam commit kimliğini tar paketinin pax başlığına yazar; `git get-tar-commit-id` bu kimliği okur.
- Paket bir boru hattından geçmez, dosyaya yazılır.

**Aktarım:**
- Paket `scp` ile `/srv/beautyos/kaynak/<sha12>/kaynak.tar` olarak taşınır.
- Aynı dizine iki küçük metin dosyası yazılır: `commit.txt` (tam commit kimliği) ve `kaynak.tar.sha256` (SHA-256 özeti).
- Dizin 700, dosyalar 600 izinli, sahibi karateke.

**Doğrulama ve derleme** (`derle.sh <tam-sha>`):
1. Argüman 40 haneli onaltılık değilse çıkış 2.
2. `/srv/beautyos/kaynak/<sha12>/` altında üç dosya da bulunmalı.
3. `sha256sum -c` geçmeli.
4. `git get-tar-commit-id < kaynak.tar` çıktısı, `commit.txt` ve argüman **üçü birden eşit** olmalı. Biri tutmazsa betik durur, hiçbir şey derlenmez.
5. Paket boş bir `agac/` dizinine açılır. Dizin önceden doluysa betik durur ve üzerine yazmaz.
6. Derleme bu ağaçtan yapılır. Etiketler, yük sınırları, temizlik ve geri alma ADR-0018'deki gibidir. Etikette `org.opencontainers.image.revision=<tam sha>` bulunur.

**Onay kuralı:**
- Müdür yalnız denetçi ONAY raporunda adı geçen commit kimliğini paketler. Derleme log'u ve `sirket/sunucu.md` işlem günlüğü bu kimliği ONAY raporu yoluyla birlikte kaydeder.
- Sunucuya deploy key konmaz, GitHub'a erişmez. Taşıma dalları GitHub'a push edilmez; `master`'a birleştirme G18'de kurucu onayıyla yapılır.

**Temizlik:** `kaynak/` altındaki dizinler imajlarla aynı kuralla tutulur: son 3 sürüm, ayrıca kullanımdaki sürümler silinmez. Bu silme kalıcı iznin "geçici klasör" kapsamındadır.

### Sonuçlar
- **Olumlu:**
  - Push yok, Vercel preview'u yok, kurucunun deploy key adımı yok.
  - Sunucuda GitHub kimliği yok.
  - Paketin hangi commit'ten geldiği hem kimlikle hem özetle iki kez doğrulanır.
- **Olumsuz:**
  - Aktarım elle yapılır (iki komut + `scp`).
  - GitHub Actions (CI testleri G1, derleme kontrolü `imaj.yml`) taşıma dallarında çalışmaz; ilk koşuları G18 birleştirmesinde olur. Bu arada eşdeğer test ve derleme kontrolü sunucuda ya da test ortamında elle koşulur, sonuç `[İNCELEME HAZIR]` mesajına eklenir.
- **Riskler:**
  - Yanlış commit'in paketlenmesi. Önlem: üçlü kimlik eşleşmesi + ONAY raporu kaydı.
  - Sunucuda `git` bulunmaması (`get-tar-commit-id` için gerekir). Ubuntu 24.04 sunucu kurulumunda git normalde yüklüdür (VARSAYIM, D15). Yoksa devops sunucu-altyapi'ye ekler.
  - `.gitattributes`'ta `export-ignore` işaretli dosyalar pakete girmez. Derlemenin bu dosyalara ihtiyacı olmamalı.

---

## ADR-0020: Geçiş DNS'i müdür tarafından Cloudflare API ile, denetlenmiş bir betik ve Caddy'nin tek zonlu token'ıyla çevrilir; geri alma kayıttan

- **Tarih:** 2026-10-28
- **Durum:** kabul edildi (müdür, 2026-10-28). Dayanak: kurucunun koşullu geçiş onayı ("testler geçerse çevir", müdür aktardı). Kabul sırasında karar verildi: betik ve ortam kontrolü devops'ta, sunucu-altyapi'de. Deneme kaydı (`dnstest`) açılmaz; `uygula` ve `geri-al` sahte Cloudflare API'siyle sınanır, gerçek API'de yalnız `plan` çalışır (aşağıdaki risk önlemini bu karar belirler).
- **Karar verenler:** mimar; müdür

### Bağlam
Kurucu geçişi koşullu onayladı ve müdürün kurucuya ihtiyaç duymadan yürütmesini istedi. DNS Cloudflare'de, ama ajanların panel erişimi yok. Sunucuda zaten Caddy için oluşturulmuş bir token var (`/srv/caddy/.env`, `CLOUDFLARE_API_TOKEN`). Yetkisi `Zone:DNS:Edit` + `Zone:Zone:Read` ve yalnız `beautyossapp.com` zonu. Değişecek dört kayıt var (`@`, `app`, `www`, `api`); `api` şu an Railway'i gösteriyor. Ajanlar `.env` okuyamaz.

### Alternatifler
- **Kurucu panelden değiştirir:** en az yetki, ama "kurucu gerekmeden" isteğine aykırı ve geri alma da kurucuya bağlı kalır.
- **Ayrı, geçişe özel bir token:** en temiz ayrım, ama kurucunun panelde yeni bir token oluşturmasını gerektirir. Kapsam Caddy token'ıyla aynı olacağı için güvenlik kazancı yok.
- **Ajanın token'ı görüp elle `curl` atması:** şirket kuralına aykırı (gizli değer ajan bağlamına girer).

### Karar
`dns-cevir.sh` (devops yazar, `projeler/sunucu-altyapi/betikler/`, denetçi inceler) sunucuda çalışır. Token'ı geçici bir konteynere `--env-file /srv/caddy/.env` ile alır. Token komut satırına, log'a ya da çıktıya girmez: `curl` başlığı bir dosyadan ya da standart girdiden okunur, `set -x` yoktur. Alt komutlar:
- **`plan`:** Adı verilen kayıtların mevcut halini (tür, değer, proxy, TTL, kimlik) `dns-oncesi.json`'a, tüm zon dışa aktarımını `zone-oncesi.txt`'e yazar. Aynı ada birden fazla kayıt varsa durur. Hiçbir şey değiştirmez.
- **`ttl-dusur`:** Yalnız gri (proxy kapalı) kayıtlarda TTL'i 60'a indirir. Turuncu kayıtta hiçbir şey yapmaz.
- **`uygula <ip>`:** Her kaydı A + proxied + TTL Auto yapar. Tür değişiyorsa (ör. CNAME → A) önce yeni kaydı oluşturmaya çalışır; API buna izin vermezse silip oluşturur. Kesinti saniyelerle sınırlıdır. Her kayıt API'den geri okunarak doğrulanır.
- **`geri-al`:** `dns-oncesi.json`'daki tür, değer, proxy ve TTL'e döner ve geri okuyarak doğrular.

Betik yalnız `@`, `app`, `www`, `api` adlarını kabul eder (sabit liste). MX/TXT ve diğer kayıtlara dokunmaz; liste dışı ad → çıkış 2. Müdür, kurucunun koşullu onayı ve §10.1 koşulları sağlandığında `uygula`'yı, §10.5 ölçütünde `geri-al`'ı çalıştırır (devops yürütür).

### Sonuçlar
- **Olumlu:** Kurucu gerekmeden, tekrarlanabilir ve geri alınabilir geçiş. Önceki durumun makine okunur kaydı var. Kapsam dört kayıtla sınırlı.
- **Olumsuz:** Caddy'nin sertifika token'ı ikinci bir amaçla kullanılıyor.
- **Riskler:**
  - Betik hatasıyla yanlış kaydın değişmesi. Önlem: sabit ad listesi, `plan` kaydı, geri okuyarak doğrulama, denetçi incelemesi. Denetimde gerçek zonda yalnız `plan` (salt okuma) çalışır. `uygula`, `geri-al` ve `ttl-dusur` yerel bir HTTP taklidiyle (sahte Cloudflare API) sınanır; deneme kaydı açılmaz (müdür kararı).
  - Tür değişiminde kısa çözümleme boşluğu. Kabul edildi: gerçek kullanıcı yok.
  - Token'ın açığa çıkması. Önlem: argümanda yok, çıktıda yok; sızıntıda kurucu token'ı yeniler (Caddy de etkilenir).

---

<!-- Yeni ADR şablonu: aşağıdaki bloğu dosyanın sonuna kopyala, numarayı artır, dizine satır ekle.

## ADR-NNNN: <karar başlığı>

- **Tarih:** YYYY-AA-GG
- **Durum:** önerildi
- **Karar verenler:** <roller>

### Bağlam
<sorun, kısıtlar, etkenler; 2-5 cümle>

### Alternatifler
- **<seçenek 1>:** artıları / eksileri / neden seçilmedi
- **<seçenek 2>:** artıları / eksileri / neden seçilmedi

### Karar
<1-3 cümle, şimdiki zamanla: "X kullanıyoruz">

### Sonuçlar
- **Olumlu:** ...
- **Olumsuz:** ...
- **Riskler:** <risk ve önlem>
-->
