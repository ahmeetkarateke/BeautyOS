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
| ADR-0008 | Cloudflare proxy açık (turuncu), SSL modu Full (strict) | kabul edildi (kurucu 2026-10-28; hukuk-uyum şartlı). **Uygulaması ertelendi: ADR-0021** | 2026-10-27 |
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
| ADR-0021 | Geçişte kayıtlar gri (proxy kapalı) kalır; turuncu bulut, kurucu SSL modunu Full (strict) yaptıktan sonra ayrı adım | kabul edildi (müdür kararı) | 2026-10-28 |
| ADR-0022 | Yeni arayüz ve güvenlik işi tek entegrasyon dalı `gelistirme`'de; birleştirme yerel, push yok | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0023 | Eski ve yeni arayüz bir arada: iki kök düzen, derleme anı yüzey bayrağı, `proxy.ts` eşlemesi | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0024 | Next 16 + React 19; imajlar Node 22 | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0025 | Tailwind v4 tek sürüm; tasarım tokenları üç katman, `@theme inline` | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0026 | Bileşenler: kendi tasarım sistemimiz, davranış için Radix Primitives | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0027 | Yazı tipi depodan `next/font/local`: Hanken Grotesk + yalnız ₺ için Inter | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0028 | İkon seti lucide-react | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0029 | Takvim: kendi CSS Grid bileşenimiz + `@dnd-kit/core`; zaman `date-fns` + `@date-fns/tz` | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0030 | Yetki: tek izin tablosu (`packages/shared`), sunucu `requirePermission` ile zorlar, ön yüz `/auth/me`'den gösterir | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0031 | Terim setleri: kiracıda `termSet` + `termOverrides`, isimler hâl ekleriyle | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0032 | v2 API istemcisi: erişim token'ı yalnız bellekte, tek yenileme sözü, hata kodundan metin | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0033 | Web testleri: Vitest + RTL birim, Playwright + axe E2E | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0034 | SMS sağlayıcısı yokken online randevu doğrulamasız, zorunlu salon onayıyla | kabul edildi (müdür, 2026-10-29; kurucu kararı 5) | 2026-10-29 |
| ADR-0035 | Sürüm etiketleri gizli olmayan `surum.conf`'ta; yayın yalnız `yayinla.sh` ile | kabul edildi (müdür, 2026-10-29; kurucu kararı 3) | 2026-10-29 |
| ADR-0036 | Eski arayüzün W1 sonrası gerçekten Inter ile çizilmesi kabul edildi | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0037 | Doğrulanmamış online talep müşteri kaydına bağlanmaz; eşleştirme salonun onayda açık seçimiyle | kabul edildi (mimar, kalıcı izin 4; S2 denetimi + hukuk-uyum). **`create` çakışma kuralı ve CHECK biçimi yerini aldı: ADR-0038** | 2026-10-29 |
| ADR-0038 | Aynı telefonla birden çok müşteri olabilir; telefon tek yardımcıyla çözülür, belirsizlikte otomatik bağlama yok | kabul edildi (mimar, kalıcı izin 4; W10 denetimi Kritik 2) | 2026-10-29 |
| ADR-0039 | Telegram sohbet numarası telefon alanında değil `telegramChatId`'de; bot müşterisi telefonsuz olabilir | kabul edildi (mimar, kalıcı izin 4; inceleme M9 / gelistirici #5) | 2026-10-29 |
| ADR-0040 | zod 3 yüksek danışma kaydı geçici kabul; zod 4 geçişi ayrı görev | kabul edildi (müdür, 2026-10-29) | 2026-10-29 |
| ADR-0041 | Randevu taşıma ikiye ayrılır: saat/gün (`appointment.reschedule`, uzman yalnız kendi randevusu) ve personel değiştirme (`appointment.reassign_staff`) | kabul edildi (kurucu kararı R3; mimar kaydı, kalıcı izin 4) | 2026-10-29 |
| ADR-0042 | Personel daveti: tek kullanımlık, hash'li, 7 günlük bağlantı; kullanıcı ve profil kabulde oluşur | kabul edildi (mimar, kalıcı izin 4; kurucu kararı R8). **Bağlantı/uç biçimi ve profil kuralı yerini aldı: ADR-0046** | 2026-10-29 |
| ADR-0043 | Müşterinin randevu bağlantısı: sunucuda hash'li rastgele token (HMAC değil); değiştir/iptal 2 saat kuralı; online fiyat ayarı | kabul edildi (mimar, kalıcı izin 4; kurucu kararları M1, T2/K-varsayılanlar). **Uç biçimi yerini aldı: ADR-0046** | 2026-10-29 |
| ADR-0044 | Hatırlatma işleri: geçici hata yeniden denenir, kalıcı hata ve geçersiz randevu atlanır; klinikte hizmet adı yok; gece uzlaştırma | kabul edildi (mimar, kalıcı izin 4; kurucu kararı M2). Ek: ADR-0045 | 2026-10-29 |
| ADR-0045 | Personelin panelden açtığı randevu `confirmed` başlar (ADR-0044'e ek); `pending` yalnız onay bekleyen online talep demektir | kabul edildi (müdür kararı; teknik yol mimar) | 2026-10-29 |
| ADR-0046 | Gizli bağlantı tokenları URL yolunda taşınmaz: web'de `#` parçası, API'de istek gövdesi (ADR-0042 ve ADR-0043'ün uç biçimlerinin yerini alır); davette profil yalnız `staff` rolüne | kabul edildi (mimar, kalıcı izin 4; denetim A3-1 Önemli 1) | 2026-10-29 |
| ADR-0047 | Şablonlu iletilerde gövde saklanmaz: `message_deliveries` şablon anahtarı + sürümü tutar; şablonlar kodda sürümlü ve değişmez; teslim kaydı 1 yıl sonra anonimleşir | kabul edildi (mimar, kalıcı izin 4; hukuk-uyum KVKK kararı) | 2026-10-29 |
| ADR-0048 | Kayıtta sözleşme ve rıza kabulleri `legal_acceptances` tablosunda belge başına ayrı satır | kabul edildi (gelistirici, kalıcı izin 4; W30) | 2026-10-30 |

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
- **Durum:** kabul edildi (kurucu 2026-10-28; hukuk-uyum ŞARTLI ONAY, `docs/kvkk-tasima-degerlendirmesi.md` §4). **Uygulaması ertelendi (2026-10-28, müdür kararı): ADR-0021.** Geçişte kayıtlar gri kalıyor; turuncuya geçiş ayrı ve sonraki bir adım.
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

## ADR-0021: Geçişte kayıtlar gri (proxy kapalı) kalır; turuncu bulut, kurucu SSL modunu Full (strict) yaptıktan sonra ayrı adım

- **Tarih:** 2026-10-28
- **Durum:** kabul edildi (müdür kararı). ADR-0008'in uygulamasını erteler; ADR-0008 iptal edilmedi.
- **Karar verenler:** müdür; mimar (kayıt)

### Bağlam
`dns-cevir.sh plan` çıktısına göre dört kayıt bugün gri (`proxied=false`): `@` A (Vercel), `app` ve `www` CNAME (Vercel), `api` CNAME (Railway). Zonun Cloudflare SSL/TLS modunu kurucu henüz teyit etmedi. Kayıtlar turuncuya alınırken mod "Flexible" kalmışsa Cloudflare origin'e HTTP ile gider, Caddy HTTPS'e yönlendirir ve sonsuz yönlendirme döngüsü oluşur. Sertifikalar zaten DNS-01 ile alındı, yani gri bulutta da TLS geçerli.

### Alternatifler
- **Geçişle birlikte turuncu (ADR-0008 aynen):** origin gizlenir ve DDoS koruması gelir, ama teyit edilmemiş SSL moduna bağımlı ve geçişte iki değişkeni birden değiştirir.
- **Önce SSL modunun teyidi, sonra turuncu geçiş:** doğru sıra, ama kurucu adımı bekleyerek geçişi geciktirir.

### Karar
- **Geçişte** `uygula` yalnız hedefi değiştirir (A 209.38.237.171) ve her kaydın `proxied` değerini `dns-oncesi.json`'daki gibi korur (bugün `false`). TTL de plandaki değerinde kalır; `ttl-dusur` çalıştıysa 60'tır. Geçiş oturunca 300'e alınabilir.
- **Turuncu bulut ayrı ve sonraki bir adımdır** (G20):
  - Önce kurucu panelden SSL/TLS modunu **Full (strict)** ve minimum TLS'i 1.2 yapar.
  - Sonra hukuk-uyum'un ADR-0008'deki şartları (API'de önbellek kapalı, analitik/Zaraz/Logpush kapalı, 2FA) uygulanır.
  - Ardından kayıtlar turuncuya alınır.
  - Bu bir DNS değişikliğidir ve kurucunun geçiş onayının dışındadır, kurucuya sorulur.
- Staging hostları (`yeni`, `yeni-api`) da aynı gerekçeyle turuncuya geçişe kadar gri tutulur.

### Sonuçlar
- **Olumlu:** Geçiş SSL moduna bağlı değil, tek değişken değişiyor. Trafik Cloudflare'den geçmiyor (KVKK açısından daha az üçüncü taraf; hukuk-uyum'un turuncu bulut şartları bu aşamada konusuz). Gerçek istemci IP'si doğrudan geliyor; ADR-0010 düzeni değişiklik gerektirmeden doğru çalışıyor, `CF-Connecting-IP` yalnız Cloudflare aralıklarından kabul edildiği için sahtelenemiyor.
- **Olumsuz:** Origin IP DNS'te görünüyor; DDoS koruması ve kenar önbelleği yok. Kayıt değişikliği TTL kadar gecikmeyle yayılıyor (en çok 300 sn; `ttl-dusur` sonrası 60 sn).
- **Riskler:**
  - Doğrudan saldırı. Önlem: DO Cloud Firewall + ufw (yalnız 22/80/443), uygulama hız sınırları, izleme. Turuncuya geçiş (G20) bu riski kapatır.
  - Turuncu adımın unutulması. Önlem: G20 görev listesinde, ilk gerçek müşteriden önce.

---

> **ADR-0022 – ADR-0035 için ortak not:** Kaynak `docs/kodlama-plani.md` §2'dir (taslak adları ADR-UI-01 … ADR-UI-14, sırayla). Öneriyi mimar yaptı, müdür 2026-10-29'da kabul etti; dayanak kurucunun kalıcı izni 4 (teknik kararlar kurucuya sorulmaz). Uygulamayı denetim döngüsü doğrular. Görev numaraları (S, A, W, T, D, L) planın §3'üne aittir.

## ADR-0022: Yeni arayüz ve güvenlik işi tek entegrasyon dalı `gelistirme`'de; birleştirme yerel, push yok

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Üç ajan paralel çalışacak: gelistirici, frontend-gelistirici ve test-muhendisi. Push kurucu onayına bağlı. Sunucu yayını push'tan bağımsız, paket `git archive` ile aktarılıyor (ADR-0019). Canlı kod `tasima/docker` dalında, `master` ise taşıma öncesinden kaldı.

### Alternatifler
- **Doğrudan `master`:** `master` canlı kodu içermiyor. Birleştirmek kurucu kararı istiyor ve hızı ona bağlıyor.
- **`tasima/docker`'da sürdürmek:** adı ve "master'a birleştirilmez" kuralı yanıltıcı olur.

### Karar
- `tasima/docker@e27e880`'den `gelistirme` açılır; `tasima/docker` dondurulur.
- Görevler `gorev/<no>-<kisa-ad>` dallarında, her ajanın kendi worktree'sinde yürür.
- Müdür, denetçinin ONAY verdiği dalı `--no-ff` ile yerelde birleştirir. Çakışma çıkarsa dal sahibi rebase eder ve dal kısa kontrol için yeniden incelenir.
- `package-lock.json`'u değiştiren görevler sırayla yürür.
- `gelistirme` → `master` birleştirmesi ve push kurucu kararıdır.

### Sonuçlar
- **Olumlu:** Kimse onay beklemez; her commit hem canlıya hem staging'e derlenebilir.
- **Olumsuz:** GitHub CI çalışmaz. Eşdeğer kontroller (tip, lint, birim, E2E) birleştirmeden sonra test-muhendisi'nin yeşil kapısında koşar.
- **Riskler:** Push yapılmadıkça kodun tek kopyası bu bilgisayarda ve sunucudaki paketlerde. Önlem: push kurucu karar listesinde ilk sırada.

---

## ADR-0023: Eski ve yeni arayüz bir arada: iki kök düzen, derleme anı yüzey bayrağı, `proxy.ts` eşlemesi

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Yeni arayüz ekran ekran yazılacak ve staging'de gösterilecek. Bu sürede canlıda eski arayüz kalmalı, güvenlik düzeltmeleri canlıya çıkabilmeli. Bir commit'ten `web-prod` ve `web-staging` imajları çıkıyor; ikisi yalnız `derleme.conf` değerleriyle ayrılıyor (ADR-0018). Eski ve yeni Tailwind temaları aynı adları taşıyor (`--color-primary`).

### Alternatifler
- **Uzun ömürlü arayüz dalı:** güvenlik düzeltmeleriyle sürekli ayrışır, staging her derlemede elle birleştirme ister.
- **Çalışma anı bayrağı (kiracı başına):** gerçek kullanıcı yokken gereksiz; ölü kodu canlı pakete taşır.

### Karar
- **Yüzey bayrağı:** derleme anında okunan `NEXT_PUBLIC_UI_V2` değişkeni açık yüzeyleri virgülle ayrılmış liste olarak taşır (`site,auth,panel,book,admin`). `derleme.conf` iki değer verir: `NEXT_PUBLIC_UI_V2_PROD` (boş) ve `NEXT_PUBLIC_UI_V2_STAGING`.
- **İki kök düzen:** eski rotalar `app/(legacy)/` altında, yeniler `app/(v2)/` altında durur. Her kök düzen yalnız kendi CSS'ini yükler.
- **Yollar (`proxy.ts`):**
  - Yeni panel `/panel/[slug]/…` adresindedir. Bayrak açıksa `/tenant/[slug]/*` buraya yönlendirilir, kapalıysa `/panel/*` 404 verir.
  - Herkese açık yollar değişmez: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/book/[slug]`, `/admin/*`. Bayrak açıksa bu yollar iç `/v2/*` yoluna yeniden yazılır.
- **Ara dönem:** henüz yazılmamış ekran "Eski ekranda açın" bağlantısı gösterir. v2 kodu eski klasörlerden içe aktarma yapamaz (ESLint kuralı).
- **Geçiş:** kurucu onayıyla canlı bayrak açılır. Sonraki sürümde `(legacy)` silinir ve `/tenant/*` → `/panel/*` yönlendirmesi kalıcı (308) olur.

### Sonuçlar
- **Olumlu:** Tek ana hat; aynı commit staging'de yeniyi, canlıda eskiyi gösterir. Eski kod tek hamlede silinir.
- **Olumsuz:** Geçişe kadar iki CSS girişi var. Gruplar arası geçiş tam sayfa yüklemesi. Bayrak değişimi yeni derleme ister.
- **Riskler:** Yanlış eşleme yüzünden canlıda v2'nin görünmesi. Önlem: tanımsız bayrak boş sayılır (kapalı başarısızlık); her eşleme testli.

---

## ADR-0024: Next 16 + React 19; imajlar Node 22

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Next 14'ün desteği bitti; 15.x'in iki yıllık bakım süresi 2026-10-21'de doldu. Canlı web herkese açık. Node 20 Nisan 2026'da destek dışı kaldı; yükseltme ADR-0014'te taşıma sonrasına bırakılmıştı. Yeni kodu eski çatıda yazıp sonra taşımak iki kez iş demek.

### Alternatifler
- **Next 15:** bakım süresi doldu.
- **Yükseltmeyi geçişe bırakmak:** canlı web haftalarca yamasız kalır.

### Karar
- Next 16'nın güncel yamasına ve React 19'a çıkıyoruz. Async `params` ve `proxy.ts` dönüşümü resmî codemod'larla yapılır; eski sayfalar çalışır kalır.
- Web ve API imajları Node 22 LTS'e geçer (S9).
- **Uygulama:** W1 `5e734c9` (denetim `raporlar/denetim/beautyos-W1-1.md` ONAY) ile next 16.4.3 ve react/react-dom 19.3.1'e geçildi.

### Sonuçlar
- **Olumlu:** Desteklenen çatı; yeni kod son hâline göre yazılır.
- **Olumsuz:** Codemod gereksiz biçim değişikliği üretebilir (W1'de bir sayfa tümüyle yeniden girintilendi). Kural: yalnız gereken satırlar değişir.
- **Riskler:** Eski arayüzün kırılması. Önlem: eski arayüz dumanı kabul ölçütü. Görünür yazı tipi farkı için bkz. ADR-0036. İlk imaj derlemesi ONAY koşuludur.

---

## ADR-0025: Tailwind v4 tek sürüm; tasarım tokenları üç katman, `@theme inline`

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Derleme fiilen Tailwind v4 ile çalışıyordu. `tailwindcss@3` ve `tailwind.config.ts` ölü kalıntıydı. Tasarımın token kaynağı `docs/tasarim/prototip/tokens.css`. Koyu tema şimdi çizilmeyecek ama tokenlar ona hazır olmalı (kurucu 13).

### Alternatifler
- **Tailwind'siz düz CSS modülleri:** mevcut kodla iki stil sistemi olur.
- **Tokenları doğrudan `@theme` değerine yazmak:** koyu tema derleme ister.

### Karar
- Yalnız Tailwind v4 kullanılır. `tailwindcss@3` ve `tailwind.config.ts` silindi (W1).
- Tokenlar `apps/web/src/styles/tokens.css`'e taşınır. Ham (`--ref-*`) ve anlamsal (`--color-*`, `--status-*`, `--person-*` …) adlar **birebir** korunur. Türkçe takma adlar (`--renk-*`) taşınmaz.
- `styles/app.css`: `@import "tailwindcss" source(none)`, yalnız v2 klasörleri `@source` ile taranır, eşleme `@theme inline` ile yapılır.
- Koyu tema için kodda `[data-theme="dark"]` bloğu boş durur; tema anahtarı yok.
- v2 klasörlerinde hex, `bg-white`, `text-gray-*`, `dark:` ve 12 px altı yazı kullanılmaz. Bunu `scripts/ui-lint` denetler.
- Animasyon kendi `@keyframes`'imizle yapılır; `prefers-reduced-motion`'da süre 0.

### Sonuçlar
- **Olumlu:** Koyu tema yalnız bir anlamsal blok doldurmak demek. Tasarım ile kod aynı adları konuşur.
- **Olumsuz:** Eski CSS geçişe kadar yan yana durur (ADR-0023).
- **Riskler:** Token dışı renk sızması. Önlem: `ui-lint` her UI görevinde kabul ölçütü.

---

## ADR-0026: Bileşenler: kendi tasarım sistemimiz, davranış için Radix Primitives

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Tasarım kendi bileşen kurallarını tanımlıyor (`tasarim.md` §4). Odak tuzağı, klavye ve ARIA davranışını elle yazmak hata kaynağı. Radix zaten bağımlılıkta.

### Alternatifler
- **shadcn CLI:** kendi token adlarını ve `tailwindcss-animate`'i getirir; tasarım sistemimizle çakışır.
- **vaul (alt sayfa):** bakımı durdu.
- **Tümüyle elle yazmak:** erişilebilirlik yükü.

### Karar
- Davranış Radix ilkellerinden gelir: Dialog (diyalog ve alt sayfa), DropdownMenu, Tabs, Popover, Switch, Checkbox, RadioGroup, Toast, VisuallyHidden.
- Görünüm tümüyle bizimdir: `src/ui/*`, `cva`.
- Bileşen adları İngilizcedir. Prototip sınıf adı eşlemesi `src/ui/README.md`'de tutulur.

### Sonuçlar
- **Olumlu:** Erişilebilir davranış hazır, görünüm tek elde.
- **Olumsuz:** Radix sürüm yükseltmeleri izlenir.
- **Riskler:** Yok denecek kadar az; Radix başsız ve yaygın.

---

## ADR-0027: Yazı tipi depodan `next/font/local`: Hanken Grotesk + yalnız ₺ için Inter

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Tasarım yazı tipi olarak Hanken Grotesk'i seçti; bu ailede ₺ (U+20BA) glifi yok. Türkçe karakterler `latin-ext` alt kümesinde. Hukuk-uyum U7 üçüncü taraf istek istemiyor. `next/font/google` derlemede ağa çıkıyor.

### Alternatifler
- **`next/font/google`:** derleme ağa bağımlı ve belirlenimci değil.
- **Tam Inter:** gereksiz ağırlık.

### Karar
- Hanken Grotesk değişken woff2 (latin + latin-ext, 400–600) ile yalnız ₺ glifini içeren küçük bir Inter dosyası (`unicode-range: U+20BA`) kullanılır.
- Dosyalar ve `OFL.txt` `apps/web/src/fonts/` altında durur.

### Sonuçlar
- **Olumlu:** Derleme ağsız ve belirlenimci; dış istek yok; lisans OFL.
- **Olumsuz:** Yazı tipi güncellemesi elle yapılır.
- **Riskler:** Glifin sistem yazı tipine düşmesi. Önlem: Playwright'ta `document.fonts` ve ekran görüntüsü kontrolü (`İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü ₺`).

---

## ADR-0028: İkon seti lucide-react

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Prototip lucide çizgi diliyle çizildi (1,6 çizgi, 24'lük kutu). lucide-react zaten bağımlılıkta ve adlandırılmış içe aktarımla ağaç sarsmaya uygun.

### Alternatifler
- **Başka set:** prototiple dil farkı.
- **Elle SVG:** bakım yükü.

### Karar
- lucide-react kullanılır. Tek `Icon` sarmalayıcısı boyutları 20 ve 24 px ile sınırlar.
- Dekoratif ikon `aria-hidden` taşır; yalnız ikondan oluşan düğmede `aria-label` zorunludur.
- Emoji kullanılmaz.

### Sonuçlar
- **Olumlu:** Prototiple aynı görsel dil.
- **Olumsuz:** Yok.
- **Riskler:** Yok.

---

## ADR-0029: Takvim: kendi CSS Grid bileşenimiz + `@dnd-kit/core`; zaman `date-fns` + `@date-fns/tz`

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Kurucu kararı T1: kendi takvim bileşenimiz olacak, sürükle-bırak ilk sürümde var, FullCalendar'ın ücretli paketi alınmaz. Takvim personel sütunlu. Gün sınırları bugün UTC'ye göre hesaplanıyor (ekran envanteri §0-10).

### Alternatifler
- **FullCalendar:** personel sütunu için ücretli paket gerekiyor.
- **Elle işaretçi kodu:** erişilebilirlik ve kenar durumlarında bakım yükü.
- **HTML5 sürükle-bırak:** dokunmatikte zayıf.

### Karar
- Gün ızgarası CSS Grid ile çizilir: saat başına 72 px, 15 dk'lık dilim, örtüşen randevular sütun içinde yan yana.
- Sürükle-bırak yalnız masaüstünde ve işaretçiyle çalışır: `@dnd-kit/core`, 15 dk'ya yaslama.
- Dokunmatik ekranda ve klavyede aynı iş "Saati değiştir" ile yapılır.
- Tüm gün ve saat hesapları `Europe/Istanbul` ile yapılır (`date-fns` + `@date-fns/tz`).
- FullCalendar geçişe kadar yalnız eski arayüzde kalır.

### Sonuçlar
- **Olumlu:** Lisans maliyeti yok, tasarıma birebir uyum.
- **Olumsuz:** Yerleşim ve sürükle-bırak kodu bizde.
- **Riskler:** Karmaşıklık. Önlem: yerleşim algoritması saf ve birim testli fonksiyon; W12, W13 ve W15 ayrı görevler.

---

## ADR-0030: Yetki: tek izin tablosu (`packages/shared`), sunucu `requirePermission` ile zorlar, ön yüz `/auth/me`'den gösterir

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Bugün rol kontrolü uç uç elle yazılmış ve tutarsız (denetim #2: personel kasaya ve primlere erişiyor). Kurucu R1 dört rol istedi: sahip, müdür, resepsiyon, uzman. Klinikte hekim ve sağlık personeli ekleniyor (K2). Menü ile sunucu kuralının ayrışmaması gerekiyor.

### Alternatifler
- **Kiracı başına özel izin seti:** şimdilik gereksiz karmaşıklık.
- **Ön yüzde ayrı izin hesabı:** sunucuyla ayrışır.

### Karar
- **Roller:** `owner`, `manager`, `receptionist` (yeni) ve `staff` (arayüzde "Uzman"; veritabanı değeri değişmez). Klinikte `doctor` ve `health_staff` (Faz 6). Rolü yalnız sahip atar; unvan (`title`) yetki taşımaz.
- **İzin tablosu:** tek kaynak `packages/shared/src/permissions.ts`. Anahtar biçimi `alan.eylem[.kapsam]`; her anahtar `roller-ve-akislar.md` §1.4 matris satırına bağlanır.
- **Sunucu:** her rotada `requirePermission(key)` çalışır; "kendi kaydı" kapsamı sorguda uygulanır.
- **Ön yüz:** etkin izinleri `/auth/me`'den alır (`useCan`, `RequirePermission`, `navConfig`). Rol dışı öğe gizlenir; adres çubuğundan girilirse "Yetkisiz" ekranı çıkar.

### Sonuçlar
- **Olumlu:** Matris tek yerden yönetilir; menü ile sunucu ayrışmaz.
- **Olumsuz:** Paylaşılan paket imaj derlemesine eklendi (S0).
- **Riskler:** Eksik anahtar yüzünden açık kalan uç. Önlem: her matris satırı için rol × uç tablo testi (izinli ve izinsiz rol).

---

## ADR-0031: Terim setleri: kiracıda `termSet` + `termOverrides`, isimler hâl ekleriyle

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Kurucu S1/K4: hazır terim setleri gelecek (Salon / Klinik-danışan / Klinik-hasta) ve sahip ana terimleri değiştirebilecek. Türkçe ekler terime göre değişir; parça birleştirme yanlış ek üretir (metin rehberi §2b).

### Alternatifler
- **Yalnız hazır setler:** K4'ü karşılamaz.
- **Serbest metinle birleştirme:** ek uyumu bozulur.

### Karar
- Kiracıda `termSet` (`salon | clinic_client | clinic_patient`) ve zod ile doğrulanan `termOverrides` (jsonb) tutulur.
- İsimler `packages/shared/src/terms.ts`'te beş biçimle durur: yalın, çoğul, belirtme, yönelme, tamlayan.
- Cümleler `apps/web/src/content/tr.ts`'te set başına tam cümle olarak yazılır. Özel terimde biçim yer tutucusu kullanılır (`{client.dat}`).
- Ayarlar ekranı ünlü uyumuna göre ek önerir, sahip düzeltir ve önizler.
- İşletme türleri tek kaynaktan gelir (`packages/shared/src/business-types.ts`).

### Sonuçlar
- **Olumlu:** Doğru Türkçe; SMS şablonları da aynı kaynağı kullanabilir.
- **Olumsuz:** Sahip özel terim girerken beş biçimi onaylar.
- **Riskler:** Eksik biçim. Önlem: zod beş biçimi zorunlu tutar.

---

## ADR-0032: v2 API istemcisi: erişim token'ı yalnız bellekte, tek yenileme sözü, hata kodundan metin

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Bugün erişim token'ı `localStorage`'da iki kopya tutuluyor (denetim #4). Eşzamanlı 401'ler yenileme yarışı yaratıyor. Üç ayrı fetch sarmalayıcısı var. Sunucu mesajı olduğu gibi gösteriliyor.

### Alternatifler
- **Eski istemciyi onarmak:** eski kod geçişte silinecek; iki kez iş olur.

### Karar
- Tek `apiClient` kullanılır; erişim token'ı yalnız bellekte durur, açılışta `/auth/refresh` çağrılır.
- Eşzamanlı 401'ler tek `refreshPromise`'i bekler. 401'de `?next=` ile giriş sayfasına yönlendirilir.
- 402 ve 429 `error.code` ile ayrılır; 429'da `retryAfterSec` kullanılır.
- Hata metinleri `content/errors.ts`'ten gelir (metin rehberi §6).
- Eski `lib/api.ts` geçişe kadar dokunulmadan kalır. Sunucu oturumu (S6) iki istemciyle de uyumludur.

### Sonuçlar
- **Olumlu:** XSS ile token çalınma yüzeyi daralır; rastgele "Bir sorun oluştu" hataları kalkar.
- **Olumsuz:** Her sayfa açılışında bir yenileme isteği.
- **Riskler:** Yenileme döngüsü. Önlem: yarış için birim testi (5 eşzamanlı 401 → tek yenileme).

---

## ADR-0033: Web testleri: Vitest + RTL birim, Playwright + axe E2E

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** mimar (öneri), müdür (kabul)

### Bağlam
Web'de test altyapısı yok, E2E yok (test-muhendisi incelemesi). Hedef WCAG 2.2 AA (kurucu 18). Bu makinede node ve docker yok; testlerin nerede koşacağı ayrıca belirlenecek (T1).

### Alternatifler
- **Jest:** API zaten Vitest kullanıyor; iki koşucu gereksiz.
- **Cypress:** Playwright çoklu genişlik ve axe entegrasyonunda daha sade.

### Karar
- **Birim testleri:** Vitest + React Testing Library + jsdom; testler dosyanın yanında durur. Kapsam: izin, terim, biçim (Türk I'sı dahil), `apiClient` yarışı, formlar, takvim yerleşimi.
- **E2E:** Playwright + `@axe-core/playwright`, `apps/web/e2e/` altında; hedef staging ya da yerel yığın.
  - axe'ta "serious" ve "critical" ihlal sayısı 0 olmalı.
  - 390, 768 ve 1440 px ekran görüntüleri yalnız artefakttır, doğrulama değildir.
- Seçiciler tasarımın `data-testid`'leri ile rol/ad sorgularıdır.

### Sonuçlar
- **Olumlu:** Erişilebilirlik ve davranış otomatik kapıda.
- **Olumsuz:** E2E'nin çalıştığı ortam bellek ister.
- **Riskler:** Sunucuda koşarsa canlıyı etkilemesi. Önlem: T1 bellek ölçümü ve yoğun olmayan saat.

---

## ADR-0034: SMS sağlayıcısı yokken online randevu doğrulamasız, zorunlu salon onayıyla

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29; kurucu kararı 5)
- **Karar verenler:** kurucu (karar), mimar (tasarım), müdür (kabul)

### Bağlam
NetGSM kapalı ve ne zaman açılacağı belirsiz. `e27e880`'de sağlayıcı yokken `/verify/send` 503 döndüğü için online randevu fiilen kapalı. Kurucu kararı: sağlayıcı yokken doğrulama olmadan, Turnstile + hız sınırı + zorunlu salon onayıyla çalışılacak. T3 (salonda otomatik onay) yalnız doğrulanmış telefonla güvenli.

### Alternatifler
- **Online randevuyu kapalı tutmak:** kurucu kararına aykırı.
- **E-posta ile doğrulama:** müşteri için sürtünme yaratır; Resend henüz hazır değil.

### Karar
- **Mod:** API açılışta `phoneVerification = 'sms' | 'none'` belirler ve log'a yazar. `GET /public/tenants/:slug` `bookingMode` döndürür (`verified` / `approval_required`); akış baştan buna göre çizilir.
- **`none` iken:** kod adımı yoktur. Talep, T3 ne olursa olsun `pending` ve `phoneVerified=false` düşer, slotu tutar. Panelde "Telefon doğrulanmadı" işareti görünür.
- **Tavanlar:**
  - Turnstile zorunlu; üretimde gizli anahtar yoksa `/book` 503 döner.
  - IP başına saatte 3 talep.
  - Kiracıda normalize edilmiş aynı telefonla en çok 1 bekleyen talep.
  - Kiracı başına günde en çok 20 bekleyen talep.
- **Süre dolumu:** onaylanmayan talep, talepten 24 saat sonra ya da randevudan 2 saat önce (hangisi önceyse) iptal olur. Belirlenimci iş kimliği: `online-expire-<id>`.
- **Salon tarafı:** onay ve ret uçları sahip, müdür ve resepsiyona açık. Ret, `rejected` nedenli iptaldir. Müşteriye otomatik bildirim gitmez; ekran metni dürüsttür (teknik-yazar).
- **`sms` olunca:** doğrulama kendiliğinden devreye girer ve T3 uygulanır; tavanlar sürer. OTP sağlamlaştırılır: `crypto.randomInt`, kodun hash'i, atomik sayaç, telefon + IP sınırı.

### Sonuçlar
- **Olumlu:** Online randevu SMS'siz açılır; sağlayıcı gelince kod değişikliği gerekmez.
- **Olumsuz:** Doğrulanmamış talepler salona onay yükü getirir.
- **Riskler:** Sahte talep ve slot işgali. Önlem: tavanlar, Turnstile, süre dolumu, işaret.

---

## ADR-0035: Sürüm etiketleri gizli olmayan `surum.conf`'ta; yayın yalnız `yayinla.sh` ile

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29; kurucu kararı 3)
- **Karar verenler:** kurucu (sorun), mimar (öneri), devops (uygulama, D1), müdür (kabul)

### Bağlam
`BEAUTYOS_VERSION` ve `BEAUTYOS_STAGING_VERSION` `.env`'deydi. Ajanlar `.env`'e dokunamadığı için her yayında kurucunun elle değişiklik yapması gerekiyordu; bu bir darboğazdı.

### Alternatifler
- **`.env`'de bırakmak:** darboğaz sürer.
- **Etiketi compose dosyasına yazmak:** her yayında depo değişikliği gerekir.

### Karar
- Etiketler gizli olmayan `/srv/beautyos/surum.conf`'ta durur. Compose `--env-file .env --env-file surum.conf` ile çalışır.
- Yayın yalnız `deploy/betikler/yayinla.sh` ile yapılır: önce api, sonra web; sağlık kontrolü; hata olursa ikisi birlikte geri alınır.
- **Uygulamada sıkılaştırma (D1):** taslaktaki "çakışmada `surum.conf` kazanır" yerine, `.env`'de `BEAUTYOS_*VERSION` satırı kalırsa betik durur.
- Canlı yayın kurucunun açık onayıyla yapılır. TEST GEÇTİ almış güvenlik düzeltmeleri kalıcı izin 4 kapsamındadır.

### Sonuçlar
- **Olumlu:** Staging yayını kurucusuz; etiket gizli dosyada değil.
- **Olumsuz:** Elle compose komutu iki env dosyası ister.
- **Riskler:** Düz `docker compose up` canlıyı eski sürüme döndürebilir. Önlem: proje `CLAUDE.md` kuralı ve betik zorunluluğu.

---

## ADR-0036: Eski arayüzün W1 sonrası gerçekten Inter ile çizilmesi kabul edildi

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** müdür (kabul); denetçi (kayıt isteği); mimar (kayıt)

### Bağlam
W1 (`5e734c9`) sonrası Next 16 Turbopack ile derleniyor. Eski arayüz `Inter`'i istiyordu, ama webpack'in hash'li yazı tipi adı yüzünden önceden fiilen sistem yazı tipiyle çiziliyordu. Turbopack'te Inter gerçekten uygulanıyor ve metinler %3–5 genişledi. Yerleşim aynı kaldı; mobil "Bugünün Geliri" taşması düzeldi, metin artık alt satıra iniyor. Denetçi bu görünür değişikliğin kayda geçmesini istedi (`raporlar/denetim/beautyos-W1-1.md`, Önemli 2).

### Alternatifler
- **Eski görünümü korumak için sistem yazı tipine zorlamak:** amaçlanmayan önceki davranışı geri getirir; eski arayüz zaten geçişte silinecek.

### Karar
Eski arayüzdeki Inter görünümü olduğu gibi kabul edilir; ek düzeltme yapılmaz.

### Sonuçlar
- **Olumlu:** Eski arayüz tasarlandığı yazı tipiyle çiziliyor; bir taşma kendiliğinden düzeldi.
- **Olumsuz:** Canlıya çıkınca kullanıcılar küçük bir görsel fark görür.
- **Riskler:** Başka bir ekranda taşma. Önlem: eski arayüz dumanı ve ekran görüntüleri (T1).

---

## ADR-0037: Doğrulanmamış online talep müşteri kaydına bağlanmaz; eşleştirme salonun onayda açık seçimiyle

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). ADR-0034'ü tamamlar. **`create` çakışmada 409 kuralının ve CHECK biçiminin yerini aldı: ADR-0038.** Geri kalanı geçerli.
- **Karar verenler:** mimar; istek: denetçi (`raporlar/denetim/beautyos-S2-1.md` Kritik 2) ve hukuk-uyum (KVKK m.4 doğruluk ilkesi)

### Bağlam
ADR-0034'teki `none` modunda telefon doğrulanmıyor. S2'nin ilk sürümü talebi telefonu eşleşen mevcut müşteriye bağlıyor ve girilen adı atıyordu. Bu durumda başkasının numarasıyla açılan talep gerçek müşterinin kartına yazılır. Kısıtlar:
- `appointments.customerId` NOT NULL.
- `customers` üzerinde `unique(tenantId, phone)`.
- Panel listeleri `customer.fullName`'i okuyor.

### Alternatifler
- **customerId zorunlu kalsın, eşleşen müşteriye bağlansın, yalnız `requestedName` eklensin:** sorunu çözmez; denetçi ve hukuk-uyum yetersiz buldu.
- **Onayda en eski eşleşen müşteriye otomatik bağlama:** doğrulanmamış telefonla sessiz bağlamayı yalnızca onay anına taşır.

### Karar
- **Şema:**
  - `appointments.customerId` boş olabilir; `requestedName` ve `requestedPhone` (normalize) sütunları eklenir.
  - `CHECK (customer_id IS NOT NULL OR (phone_verified = false AND requested_name IS NOT NULL AND requested_phone IS NOT NULL))`.
- **Onay:** `customerAction` alanı `create` ya da `link` olur.
  - `create`: requested* alanlarıyla yeni müşteri oluşturur. Telefon kiracıda kayıtlıysa 409 `CUSTOMER_MATCH_REQUIRED` döner.
  - `link`: kiracıda bulunan ve normalize telefonu talepteki telefonla aynı olan `customerId` ister; aksi halde 409.
  - Aday listesi `GET /appointments/:id/customer-candidates` ucundan gelir.
  - Yazım koşullu ve atomiktir (`status='pending' AND customerId IS NULL`).
- **Eski arayüz:** durum ucunun gövdesiz onayı `create` gibi çalışır.
- **Reddedilen ya da süresi dolan talep** müşteri oluşturmaz.
- **Bağlanmamış talep:**
  - Listelerde `{fullName: requestedName, phone: requestedPhone, unverified: true}` olarak görünür.
  - Müşteri araması, müşteri kartı, anamnez, sayaçlar ve dışa aktarma bu talepleri görmez.
  - Log'a requested* alanları yazılmaz.

### Sonuçlar
- **Olumlu:** Doğrulanmamış veri, bir insan seçmeden gerçek kişinin kaydına girmez.
- **Olumsuz:** Randevu sorgularının müşterisiz satıra dayanıklı olması gerekir. Telefonu kayıtlı bir talebi eski arayüz onaylayamaz (409); gerçek kullanıcı olmadığı için kabul edildi, yeni arayüzde aday seçimi var (W10/W14).
- **Riskler:** Reddedilen ve süresi dolan taleplerde kişisel veri birikir. Önlem: requested* alanları L4 saklama işiyle temizlenir; süreyi hukuk-uyum verir.

---

## ADR-0038: Aynı telefonla birden çok müşteri olabilir; telefon tek yardımcıyla çözülür, belirsizlikte otomatik bağlama yok

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). ADR-0037'nin `create` çakışma kuralının ve CHECK biçiminin yerini alır.
- **Karar verenler:** mimar; istek: denetçi (`raporlar/denetim/beautyos-W10-1-ek.md` Kritik 2), frontend-gelistirici

### Bağlam
ADR-0037'ye göre onayda `create`, aynı telefonlu bir aday varsa 409 dönüyordu. Ayrıca `customers` tablosunda `@@unique([tenantId, phone])` var. Salonlarda aile içinde telefon paylaşımı olağan bir durum (ör. anne kızı için kendi numarasıyla randevu alır). Gerçek kişi adaylar arasında değilse salonun önünde iki yol kalıyordu: talebi reddetmek ya da yanlış karta bağlamak. Telefon biçim farkları (`05…` / `+905…`) zaten tekilliği fiilen delmişti.

### Alternatifler
- **Aday varken arayüzden "Yeni müşteri" seçeneğini kaldırmak:** sorun sürer; denetçi bunu Kritik saydı.
- **Telefonsuz yeni müşteri oluşturmak:** iletişim bilgisi kaybolur.

### Karar
- **Şema:** `@@unique([tenantId, phone])` → `@@index([tenantId, phone])`. Telefon her yerde normalize edilmiş biçimde saklanır ve aranır.
- **Tek yardımcı:** `resolveCustomerByPhone` sonucu `none`, `single` ya da `multiple` olur.
  - Herkese açık randevu ve bot: `none` → yeni müşteri oluşturulur. `single` → yalnız doğrulanmış kanalda bağlanır (`sms` modu; bot bugünkü davranışıyla). `multiple` → hiçbir kanal otomatik bağlamaz; talep `requested*` alanlarıyla `pending` bekler ve salon eşleştirir.
  - CHECK kısıtı: `customer_id IS NOT NULL OR (requested_name IS NOT NULL AND requested_phone IS NOT NULL)`.
- **Onay:** `create` aday kontrolü yapmadan yeni müşteri oluşturur; `link` kuralı ADR-0037'deki gibi kalır.
- **Panel:** müşteri oluşturma ve güncellemede varsayılan 409 `DUPLICATE_PHONE` korunur (eski arayüz değişmez). `allowSharedPhone: true` gönderilirse kayıt yapılır; yeni arayüz bunu "Yine de ekle" onayıyla gönderir.

### Sonuçlar
- **Olumlu:** Gerçek hayattaki paylaşılan telefon durumu doğru kaydedilir. Belirsizlikte karar insanda kalır.
- **Olumsuz:** Telefonla arama birden çok sonuç döndürebilir. Hatırlatmalar paylaşılan numaraya her kişi için ayrı gider.
- **Riskler:**
  - Gereksiz tekrar kayıtlar. Önlem: panelde varsayılan 409 ve açık onay; ileride müşteri birleştirme aracı.
  - Geri alma: tekrarlı telefon varken `unique` yeniden eklenemez. Migration notunda tekrar taraması adımı yazılı.

---

## ADR-0039: Telegram sohbet numarası telefon alanında değil `telegramChatId`'de; bot müşterisi telefonsuz olabilir

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). ADR-0038'deki randevu CHECK biçimini genişletir.
- **Karar verenler:** mimar; öneri: gelistirici

### Bağlam
Bot, Telegram müşterisinin sohbet numarasını `customer.phone`'a yazıyor (inceleme M9, gelistirici #5). Bunun sonuçları:
- SMS normalizasyonu bozuluyor.
- Telefonla eşleştirme yanlış kartları birleştirebiliyor: sohbet numarası 5 ile başlayan 10 haneli olabilir ve geçerli bir TR telefonuna benziyor.
- İptal sahipliği belirsiz kalıyor.
`customer.phone` bugün NOT NULL.

### Alternatifler
- **Sohbet numarasını `phone`'da önek ile tutmak (`tg:…`):** tür karışıklığı sürer; her telefon kullanımında ayrım gerekir.
- **Ayrı kanal-kimlik tablosu:** M8'deki `channel_accounts` işiyle birlikte düşünülmeli; bugün için fazla.

### Karar
- **Müşteri:** `Customer.telegramChatId String?` + `@@unique([tenantId, telegramChatId])`. `Customer.phone` boş olabilir, ama `CHECK (phone IS NOT NULL OR telegram_chat_id IS NOT NULL)`. Panel uçlarında telefon zorunlu kalır.
- **Randevu:** `Appointment.requestedChatId String?`. CHECK: `customer_id IS NOT NULL OR (requested_name IS NOT NULL AND (requested_phone IS NOT NULL OR requested_chat_id IS NOT NULL))`.
- **Bot:** müşteriyi yalnız `telegramChatId` ile, tam eşleşmeyle çözer; telefonla bağlamaz. İptal sahipliği sohbet numarasıyla doğrulanır. Telefon ileride `request_contact` ile alınacaksa ayrı karar gerekir (paylaşılan kişi gönderenin kendisi olmalı).
- **Telefonu olmayan müşteri:** hatırlatma ve SMS denenmez; iş başarısız sayılmaz.
- **Veri migration'ı (ayrı adım):** bir kart yalnız iki koşul birlikte sağlanırsa taşınır: tüm randevuları `bookingChannel = telegram` ve en az bir randevusu var. Taşınan kartta `phone` → `telegramChatId`, `phone` NULL olur. Telefon biçimi ölçüt alınmaz. Sayım log'a yazılır, kişisel veri yazılmaz. Canlıda beklenen sayı 0 (bot canlıda kapalı).

### Sonuçlar
- **Olumlu:** Telefon alanı yalnız telefon tutar. Bot ve panel kimlikleri birbirine karışmaz.
- **Olumsuz:** Telefon kullanan her kod null'a dayanıklı olmalı. Eski web'de null'da patlayan yerler taranıp frontend-gelistirici'ye bildirilir; bot canlıda kapalı olduğu için eski web düzeltilmez.
- **Riskler:** Yanlış kartın taşınması. Önlem: randevu kanalına dayalı ölçüt ve "telegram dışı randevusu olan taşınmaz" testi. `telegramChatId` kişisel veri envanterine girer (hukuk-uyum'a bildirilir).

---

## ADR-0040: zod 3'teki yüksek önemli danışma kaydı geçici olarak kabul edildi; zod 4 geçişi ayrı görev

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür, 2026-10-29)
- **Karar verenler:** müdür (risk kabulü); gelistirici (etki analizi); denetçi (kayıt isteği)

### Bağlam
S10 (`7b09372`) sonrası `npm audit --omit=dev` kritik bulgu vermiyor; tek yüksek bulgu zod 3.25.76. zod 4 kırıcı değişiklikler içeriyor (hata biçimi, `nativeEnum`, `refine`/`preprocess`) ve 36 dosyada kullanılıyor (gelistirici etki notu, `raporlar/denetim/beautyos-S10-2.md`). Girdi koleksiyonları `.max()` ile sınırlı olduğundan sömürü riski düşük değerlendirildi.

### Alternatifler
- **Hemen zod 4'e geçmek:** güvenlik ve arayüz işini birlikte bloke eder; 36 dosyada davranış değişikliği riski.

### Karar
zod 3 bulgusu geçici olarak kabul edilir. zod 4 geçişi Faz 1 sonunda ayrı görev olarak yapılır; o zamana kadar her yeni şemada dizi/metin girdileri `.max()` ile sınırlanır.

### Sonuçlar
- **Olumlu:** Güvenlik ve arayüz işleri beklemez.
- **Olumsuz:** Bilinen bir yüksek bulgu bir süre açık kalır.
- **Riskler:** Sınırsız girdi eklenmesi. Önlem: denetçi her yeni şemada `.max()` arar.

---

## ADR-0041: Randevu taşıma ikiye ayrılır: saat/gün (`appointment.reschedule`, uzman yalnız kendi randevusu) ve personel değiştirme (`appointment.reassign_staff`)

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (kurucu kararı R3; mimar kaydı, kalıcı izin 4). Uygulama: `gorev/R-uzman-tasima` @ `335ce12`.
- **Karar verenler:** kurucu (R3: uzman kendi randevusunu taşır, fiyatı değiştiremez); gelistirici (uygulama); mimar (kayıt)

### Bağlam
Taşıma (`roller-ve-akislar.md` §1.4 satır 6) bugün yalnız sahip ve müdüre açıktı. R3'e göre uzman da kendi randevusunu taşıyabilmeli. Ama taşıma uzmana tek izin olarak verilirse, uzman randevuyu başka bir personele de aktarabilir; bu da başkasının takvimine yazmak demektir (ADR-0030 ilkesine aykırı).

### Alternatifler
- **Tek `appointment.reschedule` izni + rotada "uzman staffId gönderemez" kuralı:** kural izin tablosunda görünmez; menü ile sunucu ayrışabilir.
- **Uzmana taşımayı hiç vermemek:** R3'e aykırı.

### Karar
- **`appointment.reschedule`:** tüm personel rollerinde var.
  - Kapsam rotada uygulanır: `reassign_staff` izni olmayan rol yalnız kendi randevusunu taşır.
  - Bu rol yalnız başlangıç saatini ve günü değiştirir.
  - Gövdede mevcut personelden farklı bir `staffId` gelirse 403 döner. Başkasının randevusunu taşımaya çalışırsa da 403 döner.
- **`appointment.reassign_staff`** (sahip, müdür, resepsiyon): aynı uçta (`PATCH …/reschedule`, isteğe bağlı `staffId`) randevunun personelini de değiştirir.
  - Hedef personel aynı kiracıda olmalı ve o hizmete etkin olarak atanmış olmalı; değilse 400 `STAFF_NOT_ASSIGNABLE` döner.
- Çakışma, hedef personelin takviminde aranır ve iki yolda da tek kodla döner (`SLOT_TAKEN`; veritabanı kısıtı S3).
- Ön yüz bu iki izni ayrı okur: uzmanın "Saati değiştir" katmanında personel seçimi gösterilmez (W14). Sürükle-bırakta uzman randevuyu başka personelin sütununa bırakamaz (W15).

### Sonuçlar
- **Olumlu:** R3 karşılanır; personel değiştirme yetkisi izin tablosunda açıkça görünür.
- **Olumsuz:** Taşıma rotası iki izni birlikte değerlendirir.
- **Riskler:** Uzmanın gövdeye `staffId` koyarak başka sütuna yazması. Önlem: rotada izin kontrolü ve bunu sınayan negatif test (`appointment-reschedule.test.ts`).

---

## ADR-0042: Personel daveti: tek kullanımlık, hash'li, 7 günlük bağlantı; kullanıcı ve profil kabulde oluşur

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). Görev A3 (`docs/kodlama-plani.md`). **Bağlantı ve uç biçimi ile "profil kabulde, her rol için" kuralı yerini aldı: ADR-0046.** Geri kalanı geçerli.
- **Karar verenler:** kurucu (R8: davet bağlantısı, personel kendi şifresini belirler); mimar

### Bağlam
Bugün sahip personelin şifresini kendisi belirliyor (`POST /staff`). Kimlik modeli kiracı başına kullanıcı: `users.tenantId` ve `@@unique([tenantId, email])`. Personel eklenirken e-posta küresel olarak kontrol ediliyor (S7). Ortak üyelik modeli (M5) yok. E-posta gönderimi (Resend) çalışmayabilir, bu yüzden bağlantı kopyalanıp WhatsApp ile iletilebilmeli. `StaffProfile.userId` zorunlu.

### Alternatifler
- **İmzalı JWT bağlantı:** iptal edilemez ve yeni bir gizli anahtar ister.
- **Davette kullanıcı açıp şifresiz bırakmak:** yarım hesap oluşur, girişte özel durum gerekir.

### Karar
- **Tablo `invitations`:**
  - Alanlar: `id uuid`, `tenantId` (FK), `email` (küçük harf), `fullName`, `role` (`manager | receptionist | staff`), `title`, `invitedById` (FK users), `tokenHash` (sha-256 hex, UNIQUE), `expiresAt` (oluşturma + 7 gün), `acceptedAt?`, `acceptedUserId?`, `revokedAt?`, `createdAt`.
  - İndeksler: `(tenantId, createdAt)` ve `(tenantId, email)`.
  - Token 32 bayt rastgele değerdir (base64url). Veritabanına yalnız hash'i yazılır; token log'a yazılmaz.
- **İzin:** `staff.invite` yalnız sahipte (`roller-ve-akislar.md` §1.4 satır 31). `owner` ve `superadmin` davet edilemez (zod enum).
- **Sahip uçları (kiracı içi):**
  - `POST /invitations {email, fullName, role, title}` → 201 `{id, link, expiresAt, emailSent}`.
    - `link` = `FRONTEND_URL/invite/<token>`; yalnız bu yanıtta ve yeniden göndermede bir kez döner.
    - Aynı kiracıda etkin kullanıcı ya da bekleyen davet aynı e-postayla varsa 409 `DUPLICATE_EMAIL` döner (sahip kendi personelini zaten görüyor).
  - `GET /invitations` → bekleyen ve süresi dolmuş davetler, token olmadan.
  - `POST /invitations/:id/resend` → eski hash iptal edilir, yeni token ve 7 gün verilir.
  - `DELETE /invitations/:id` → `revokedAt` yazılır.
  - Kiracı başına günde en çok 20 davet.
- **Herkese açık uçlar** (IP başına 15 dakikada 20 istek):
  - `GET /auth/invitations/:token` → `{tenantName, role, email, fullName, expiresAt}`.
  - `POST /auth/invitations/:token/accept {password, fullName?, phone?}`:
    - Şifre için `strongPassword` kuralı uygulanır.
    - Tek işlemde koşullu kabul yapılır: `updateMany where tokenHash, acceptedAt null, revokedAt null, expiresAt > now` → `count === 1`.
    - Aynı işlemde `User` (rol davetten, e-posta davetten; değiştirilemez) ve `StaffProfile` (unvan davetten) oluşturulur.
    - Ardından S6 oturumu açılır; yanıt girişle aynıdır.
  - Geçersiz, süresi dolmuş, kullanılmış ya da iptal edilmiş bağlantıların hepsi tek yanıt döner: 404 `INVITATION_INVALID`.
  - E-posta başka kiracıda kayıtlıysa kabul 409 `INVITATION_EMAIL_IN_USE` döner (S7 küresel kontrolü).
- **E-posta:** gönderim yapılandırılmışsa davet e-postası kuyruğa atılır; sonuç `emailSent` alanına yazılır. Gönderilemezse yeni arayüz bağlantıyı kopyalatır.
- **Personel listesi:** `GET /staff` yalnız profili olan kullanıcıları döndürür; bekleyen davetler ayrı listelenir (W21).
- **Saklama:** süresi dolan ya da iptal edilen davetler 30 gün sonra silinir (L4).

### Sonuçlar
- **Olumlu:** Personel kendi şifresini belirler; yarım hesap oluşmaz; bağlantı iptal edilebilir.
- **Olumsuz:** Hizmet ataması ve çalışma saatleri yalnız kabulden sonra girilebilir.
- **Riskler:**
  - **Hesap varlığı sızıntısı:** kötü niyetli bir salon sahibi, başka bir kiracıdaki e-postanın varlığını kabul adımında öğrenebilir. Bugün `POST /staff` (S7) de aynı bilgiyi veriyor. Önlem: günlük davet tavanı. Kalıcı çözüm, kiracı başına kullanıcı yerine ortak üyelik modeline (M5) geçmek.
  - **Bağlantının yanlış kişiye gitmesi:** tek kullanımlık ve 7 günlük; sahip iptal edebilir. Davet sayfasında `Referrer-Policy: no-referrer`.

---

## ADR-0043: Müşterinin randevu bağlantısı: sunucuda hash'li rastgele token (HMAC değil); değiştir/iptal 2 saat kuralı; online fiyat ayarı

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). Görev A7. **Uç biçimi (token yolda) yerini aldı: ADR-0046.** Geri kalanı geçerli.
- **Uygulama notu (A7 `45ddccb`, mimar uygun buldu):** `showPricesOnline` ayrı sütunda değil, mevcut `tenants.settings` (jsonb) içinde tutulur; migration gerekmez. Anlam aynıdır:
  - Anahtar yoksa ya da değeri boolean değilse varsayılan uygulanır: `isHealthRegulated` doğruysa kapalı, değilse açık.
  - Okuma tek yardımcıdan yapılır (`lib/booking-link.ts` `showPricesOnline`). Yazma, ayarlar ucunda zod (`z.boolean().optional()`) ile ve mevcut ayarlarla birleştirilerek yapılır.
  - Kabul edilen sınır: eşzamanlı iki ayar güncellemesinde son yazan kazanır. Ayarları yalnız sahip ve müdür, nadiren değiştirir.
- **Karar verenler:** kurucu (M1: randevudan 2 saat öncesine kadar değiştir/iptal; klinikte online fiyat varsayılan kapalı); mimar

### Bağlam
Müşteri hesabı yok. SMS yokken müşteri randevusunu yalnız onay ekranında aldığı bağlantıyla yönetebilir (ADR-0034). Online sayfada bugün fiyat hiç dönmüyor (B5). Klinik türlerinde online fiyat varsayılan olarak gizli (`tasarim.md` §7.2). Bilgi taşıyan HMAC bağlantı iptal edilemez ve yeni bir gizli anahtar ister.

### Alternatifler
- **HMAC imzalı bağlantı (yeni `BOOKING_LINK_SECRET`):** iptal edilemez; anahtar döndürmek tüm bağlantıları bozar.
- **Telefon koduyla yönetim:** SMS yok.

### Karar
- **Token:**
  - 32 bayt rastgele değer (base64url).
  - `appointments.manageTokenHash` (sha-256, UNIQUE, nullable) olarak saklanır.
  - Yalnız online randevu oluşturulunca üretilir ve yalnız oluşturma yanıtında döner.
  - Randevu başlangıcına kadar geçerlidir.
  - Yeni ortam değişkeni **yok**.
  - Taşımada token aynı kalır.
  - Panel randevuları için token üretimi, hatırlatmaya bağlantı eklendiğinde ayrıca kararlaştırılır.
- **Uçlar** (`/public/bookings/:token`, IP başına 15 dakikada 30 istek; tokenlar ve kişisel veri log'a yazılmaz):
  - **`GET`** → `{tenant {name, slug, phone, address}, appointment {referenceCode, status, startAt, endAt, serviceName, staffName, price?}, canModify, modifyDeadline}`.
    - `modifyDeadline` = `startAt - 2 saat`.
    - Klinikte `serviceName` döner; ekranı yalnız bağlantı sahibi görür.
  - **`POST …/cancel`** → 200 `{status: 'cancelled'}`.
    - İptal nedeni `cancelled_by_customer` olarak kaydedilir.
    - Hatırlatma ve süre dolumu işleri silinir.
  - **`POST …/reschedule {startAt, staffId?}`** → 200.
    - Boş saat ve çakışma kuralı panelle aynıdır (S3).
    - Durum yeni online talep kuralıyla yeniden belirlenir: `approval_required` modunda ya da T3 "Ben onaylayayım" ise `pending`, aksi halde T3'e göre.
    - İşler yeniden kurulur.
  - **`GET …/calendar.ics`** → `text/calendar`.
    - İçerik: UID `<appointmentId>@beautyossapp.com`, başlangıç ve bitiş UTC, konum olarak salon adresi.
    - `SUMMARY`: salon adı + hizmet adı; klinikte yalnız "Randevu".
    - Fiyat ve müşteri bilgisi yer almaz.
  - **Hata kodları:**
    - 404 `BOOKING_NOT_FOUND`: geçersiz ya da süresi dolmuş token, tek yanıt.
    - 409 `MODIFY_WINDOW_CLOSED`: randevuya 2 saatten az kalmış; ekranda "salonu arayın" gösterilir.
    - 409 `BOOKING_NOT_MODIFIABLE`: tamamlanmış, iptal edilmiş ya da gelinmemiş randevu.
    - 409 `SLOT_TAKEN`.
- **Fiyat:**
  - `tenants.showPricesOnline Boolean?`. Değer null ise varsayılan uygulanır: `isHealthRegulated(businessType)` doğruysa kapalı, değilse açık. Bu yardımcı `packages/shared`'e taşınır.
  - Açıkken `price` şu uçlarda döner: `/public/services`, oluşturma yanıtı, `GET /public/bookings/:token`. Kapalıyken bu uçların hiçbirinde alan **bulunmaz**; `null` olarak da dönmez.
  - Ayarı ayarlar izni olan rol değiştirir. Klinikte açarken yeni arayüz uyarı penceresi gösterir.

### Sonuçlar
- **Olumlu:** İptal edilebilir bağlantı, yeni gizli anahtar yok, M1 karşılanır.
- **Olumsuz:** Bağlantıyı kaybeden müşteri salonu aramak zorunda; SMS açılınca bağlantı hatırlatmayla gönderilebilir.
- **Riskler:** Bağlantının paylaşılması. Önlem: bağlantı yalnız bu randevuyu yönetir, süre randevu başlangıcıyla sınırlı, hız sınırı var. Sayfada `Referrer-Policy: no-referrer`.

---

## ADR-0044: Hatırlatma işleri: geçici hata yeniden denenir, kalıcı hata ve geçersiz randevu atlanır; klinikte hizmet adı yok; gece uzlaştırma

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). Görev A8.
- **Karar verenler:** kurucu (M2: SMS, e-posta yedek); mimar

### Bağlam
Bugünkü kuyruk yapılandırması `attempts: 3` ve 5 sn'den başlayan üssel bekleme kullanıyor, ama işçi başarısızlıkta hata fırlatmıyor. Bu yüzden yeniden deneme hiç çalışmıyor (gelistirici incelemesi #6). Ayrıca silinmiş randevuya da gönderim yapılıyor. No-show işi UTC gün sınırıyla çalışıyor, koşulsuz güncelleme yapıyor ve yanlış "iptal" SMS'i gönderiyor (#7). Klinikte mesajda hizmet adı geçmemeli (hukuk-uyum). Redis yedeklenmiyor (ADR-0005).

### Alternatifler
- **Redis'i yedeklemek:** uzlaştırma işi hem daha sade hem daha sağlam.

### Karar
- **Yeniden deneme:** `attempts: 5`, üssel bekleme 60 sn'den başlar (yaklaşık 1, 2, 4, 8, 16 dk).
  - Geçici hata (ağ, zaman aşımı, sağlayıcıdan 5xx) fırlatılır ve iş yeniden denenir.
  - Kalıcı hata (geçersiz ya da eksik telefon, sağlayıcının kalıcı kodları) `UnrecoverableError` olur.
- **İşlemeden önce kontrol:** iş verisindeki `tenantId` ile randevu `findFirst({id, tenantId, isDeleted: false})` ile okunur. Durum `confirmed` değilse iş başarılı sayılır ve atlanır (bekleyen, iptal edilmiş, tamamlanmış ya da gelinmemiş randevuya hatırlatma gitmez). Log'a yalnız `appointmentId` ve neden yazılır.
- **Kanal seçimi:** SMS sağlayıcısı varsa ve telefon geçerliyse SMS gider. Yoksa müşterinin e-postası var ve e-posta yapılandırılmışsa e-posta gider (M2 yedeği). İkisi de yoksa iş atlanır.
- **İçerik:** `isHealthRegulated(businessType)` doğruysa mesajda hizmet adı yer almaz ("Yarın 14:30'da {işletme} randevunuz var."). Şablon metinlerini teknik-yazar onaylar.
- **İşlerin kurulması ve silinmesi:** onay, taşıma, iptal ve onay ret/süre dolumu olaylarında tek yardımcı kullanılır (`scheduleReminders`, `cancelReminders`, belirlenimci iş kimlikleriyle).
- **No-show gece işi:**
  - "Bugün" `lib/time.ts` ile İstanbul gün sınırına göre hesaplanır.
  - Güncelleme koşulludur: `updateMany where id, tenantId, status IN ('pending','confirmed')`. `in_progress` hariç tutulur.
  - **Müşteriye SMS gönderilmez:** "gelmedi" mesajı ayrı bir ürün kararıdır.
- **Gece uzlaştırma işi:** önümüzdeki 48 saatteki `confirmed` randevular için hatırlatma işleri belirlenimci kimlikle yeniden eklenir. Var olan iş tekrarlanmaz; Redis kaybında hatırlatmalar geri gelir.
- **Paylaşılan yardımcı:** `isHealthRegulated` `packages/shared/src/business-types.ts`'e taşınır. Dosya sahibi gelistirici'dir; gelistirici-2 onunla hizalanır.

### Sonuçlar
- **Olumlu:** Hatırlatma güvenilir hâle gelir, yanlış mesaj gitmez, Redis kaybı telafi edilir.
- **Olumsuz:** Uzlaştırma işi gece kısa bir yük getirir.
- **Riskler:** Aynı hatırlatmanın iki kez gitmesi. Önlem: belirlenimci iş kimliği; gönderim kaydında `(appointmentId, tür)` için tekil kısıt ya da gönderim öncesi kontrol.

---

## ADR-0045: Personelin panelden açtığı randevu `confirmed` başlar (ADR-0044'e ek); `pending` yalnız onay bekleyen online talep demektir

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (müdür kararı: panelde açılan randevu hatırlatma alır; teknik yol mimar). ADR-0044'ü değiştirmez, tamamlar.
- **Karar verenler:** müdür; mimar; istek: denetçi (`raporlar/denetim/beautyos-A8-1.md` Önemli 1)

### Bağlam
ADR-0044 hatırlatmayı yalnız `confirmed` randevuya gönderiyor. Panelde oluşturulan randevu (`tenant.route.ts`, `bookingChannel: 'manual'`) ise `pending` açılıyor. Salon ayrıca onaylamazsa müşteri hatırlatma almıyor. `pending` aynı zamanda online talebin "salon onayı bekliyor" anlamını taşıyor (ADR-0034); iki anlam karışıyor.

### Alternatifler
- **Hatırlatma kuralına "`pending` + müşteri bağlı + kanal web değil" eklemek:** `pending` iki anlamda kalır; Bugün ekranındaki onay listesi ve sayaçlar kanal ayrımı yapmak zorunda kalır.
- **ADR'yi aynen bırakıp ekranda uyarı göstermek:** salon her randevuyu iki kez işler; müdür kararına aykırı.

### Karar
- Personelin açtığı randevu `confirmed` başlar ve hatırlatma işleri oluşturulduğu anda kurulur. Bu kural iki yolu kapsar:
  - panelden randevu oluşturma,
  - bekleme listesinden "randevuya çevir".
- `pending` yalnız online talebin salon onayı beklediği durumdur (ADR-0034, T3). Bot randevusu bugünkü gibi `confirmed` açılır.
- Hatırlatma kuralı (ADR-0044) değişmez: yalnız `confirmed` randevuya gider.
- Personel bir randevuyu elle `pending`'e çekerse hatırlatma işleri silinir.
- Veri dönüşümü yapılmaz. Canlıda gerçek kullanıcı yok; staging'deki eski `pending` panel randevuları demo verisidir (gerekirse T3 betiği yeniden çalıştırılır).

### Ekranlara etkisi
- **W13 (Randevu oluştur):** kod değişikliği gerekmez. Yeni randevu takvimde ve ayrıntıda "Onaylandı" görünür. "Bekliyor" bekleyen testler ve görüntüler güncellenir.
- **W10 (Bugün):**
  - "Onay bekliyor" şeridi ve onay listesi artık yalnız online talepleri gösterir.
  - Liste sorgusu yalnız `status = pending` ile yeterlidir; yine de `bookingChannel = web` koşulu eklenir (ileride başka `pending` kaynağı çıkarsa diye).
  - Panel randevularında "Onayla" eylemi görünmez.
  - E2E `kabul/w10-bugun.spec.ts:202` online talep (`Aday Uc`) için `pending` bekliyor ve doğru kalır.
- **W14 (Randevu ayrıntısı):** "Onayla" eylemi yalnız `pending` randevuda görünür. Yeni panel randevularında görünmez.
- **Eski arayüz:** panel randevusu "Onaylandı" olarak açılır; ek değişiklik gerekmez.

### Sonuçlar
- **Olumlu:** Durum tek anlama iner. Panel randevusu ek işlem olmadan hatırlatma alır.
- **Olumsuz:** Panel randevularında "Bekliyor → Onaylandı" adımı kalkar. Bunun ürün değeri yoktu: randevuyu açan salonun kendisi.
- **Riskler:** Başka bir oluşturma yolunun `pending` bırakılması. Önlem: oluşturma yolları tek yardımcıyı kullanır ve kanal başına durumu sınayan bir tablo testi yazılır (manual / waitlist / bot → `confirmed`; web → `bookingMode`/T3 kuralı).

---

## ADR-0046: Gizli bağlantı tokenları URL yolunda taşınmaz: web'de `#` parçası, API'de istek gövdesi; davette profil yalnız `staff` rolüne

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). ADR-0042'nin bağlantı ve uç biçiminin ve profil kuralının yerini alır. ADR-0043'ün uç biçiminin yerini alır.
- **Karar verenler:** mimar; öneri: denetçi (`raporlar/denetim/beautyos-A3-1.md` Önemli 1)

### Bağlam
ADR-0042 (`/invite/<token>`, `/auth/invitations/:token`) ve ADR-0043 (`/public/bookings/:token`) tokenı URL yolunda taşıyor. Yol; Caddy, Next ve API erişim log'larına, Sentry'ye ve tarayıcı geçmişine düşüyor. Bu, iki ADR'deki "token log'a yazılmaz" kuralıyla çelişiyor. Caddy ve Sentry maskelemesi yalnız kısa vadeli bir önlem. URL parçası (`#…`) sunucuya hiç gönderilmez.

### Alternatifler
- **Yalnız log maskelemesi:** her yeni log noktasında unutulabilir; tarayıcı geçmişi ve önbellek yine tokenı tutar.
- **Sorgu dizgisi (`?t=`):** log'a düşer; yolla aynı sorun.

### Karar
- **Web bağlantıları:** davet `FRONTEND_URL/invite#<token>`, randevu yönetimi `FRONTEND_URL/book/manage#<token>`.
  - Sayfa tokenı `location.hash`'ten okur ve hemen `history.replaceState` ile adresten siler.
  - Token yalnız bellekte tutulur. `Referrer-Policy: no-referrer` kalır.
- **API: token yalnız JSON gövdesinde, yalnız POST ile:**
  - Davet: `POST /auth/invitations/lookup {token}` (eski `GET …/:token`) ve `POST /auth/invitations/accept {token, password, fullName?, phone?}`.
  - Randevu: `POST /public/bookings/lookup {token}`, `POST /public/bookings/cancel {token}`, `POST /public/bookings/reschedule {token, startAt, staffId?}`, `POST /public/bookings/calendar {token}`.
    - `calendar` yanıtı `text/calendar` gövdesidir. Web bunu Blob olarak indirir; doğrudan `.ics` bağlantısı yoktur.
  - Hata kodları, hız sınırları ve "tek yanıt" kuralları ADR-0042 ve ADR-0043'teki gibidir.
  - İstek gövdesi log'a yazılmaz. Mevcut Sentry gövde temizliği (G5-K5) bunu zaten sağlıyor.
- **Kısa vadeli maskeleme:** Caddy ve Sentry'deki maskeleme kalır (savunma derinliği), ama artık tek önlem değildir.
- **Profil kuralı:** davet kabulünde `StaffProfile` yalnız `staff` (Uzman) rolüne açılır. `manager` ve `receptionist` profilsiz açılır (A2 ile tutarlı). Hizmet veren bir müdür ya da resepsiyon için profil açmak ayrı karardır.

### Sonuçlar
- **Olumlu:** Token sunucu log'larına, ara katmanlara ve geçmişe düşmez.
- **Olumsuz:** Bağlantıyı açan sayfanın JavaScript çalıştırması gerekir. `.ics` tek tıkla açılmaz; indirme düğmesiyle alınır.
- **Riskler:** Eski biçimli (yol tokenlı) bağlantıların dolaşımda kalması. Önlem: A3 henüz canlıda değil, A7 başlamadı; eski yol uçları hiç yayınlanmaz ya da 404 döner. Test: Caddy ve API log'larında token dizgisinin geçmediği bir E2E kontrolü (test-muhendisi).

---

## ADR-0047: Şablonlu iletilerde gövde saklanmaz: `message_deliveries` şablon anahtarı + sürümü tutar; şablonlar kodda sürümlü ve değişmez; teslim kaydı 1 yıl sonra anonimleşir

- **Tarih:** 2026-10-29
- **Durum:** kabul edildi (mimar kararı, kalıcı izin 4). Dayanak: hukuk-uyum KVKK kararı (`docs/kvkk-tasima-degerlendirmesi.md` E9 ve §5; taslak, avukat görüşü değil).
- **Karar verenler:** hukuk-uyum (veri ilkesi); mimar (teknik biçim)

### Bağlam
`message_deliveries.body` (NOT NULL) her SMS'in ve e-postanın tam metnini saklıyor; doğrulama kodu da buna dahil (denetim #22). A8 ile e-posta hatırlatmaları başladı ve panel randevuları da hatırlatma alıyor (ADR-0045), yani hacim artıyor. Metin; şablon, randevu ve salon bilgisinden yeniden üretilebilir. Hukuk-uyum veri en aza indirme gereği gövdenin saklanmamasını, ama ispat için şablonların sürümlü ve değiştirilemez tutulmasını istiyor.

### Alternatifler
- **Gövdeyi 1 yıl saklayıp sonra boşaltmak:** gereksiz kişisel veri bir yıl durur; OTP de saklanmış olur.
- **Şablonları veritabanı tablosunda tutmak:** değişmezliği uygulama kuralıyla sağlamak gerekir. Kodda sürümlü sabit ve hash kilidi daha sade.

### Karar
- **Şema (migration):**
  - `message_deliveries.body` boş olabilir; `templateKey` ve `templateVersion` (int) eklenir.
  - `CHECK (body IS NOT NULL OR (template_key IS NOT NULL AND template_version IS NOT NULL))`.
- **Şablon kaydı:** `apps/api/src/lib/messages/templates.ts`.
  - Her şablon `(key, version)` olarak durur (ör. `reminder_24h@1`, `reminder_24h_health@1`, `phone_verification@1`).
  - Bir sürümün metni bir kez yayınlandıktan sonra **değişmez**; değişiklik yeni sürüm olarak eklenir.
  - Bir test, her `(key, version)` metninin sha-256 özetini sabit listeyle karşılaştırır. Mevcut sürümün metni değişirse test kırmızı olur.
- **Gönderim:** şablonlu iletilerde (hatırlatma, doğrulama, onay, iptal) `body = null` olur; anahtar ve sürüm yazılır. İletinin tekrar üretilmesi `appointmentId` + şablon sürümüyle yapılır.
- **OTP:** doğrulama kodu hiçbir kanalda saklanmaz: ne gövdede ne log'da. `phone_verifications`'ta yalnız kodun hash'i tutulur.
- **Serbest metinli ileti:** ileride gelirse (salonun kendi yazdığı mesaj) yalnız onun gövdesi saklanır ve 1 yıl sonra boşaltılır.
- **Bir kerelik veri geçişi:** şablonlu amaçlardaki mevcut kayıtlarda `body` boşaltılır, uygun anahtar ve sürüm yazılır. Eşleşmeyen kayıtlarda anahtar `legacy`, sürüm `0` olur.
  - Staging'de serbestçe çalışır.
  - Canlıda veri silme sayılır; kurucu onaylı canlı yayınla (`yayinla.sh --onayli`) birlikte çalışır.
- **Saklama (L4):** gece işi, 1 yılı geçmiş teslim kayıtlarında `phone` ve `email` alanlarını NULL yapar ve varsa gövdeyi boşaltır. Kanal, amaç, durum, zaman ve maliyet kalır (sayım ve fatura için).

### Sonuçlar
- **Olumlu:** İleti içeriği ve OTP veritabanında birikmez; ispat şablon sürümüyle yapılır.
- **Olumsuz:** "Tam olarak ne gönderildi" sorusu metni yeniden üreterek cevaplanır. Randevu sonradan değiştiyse üretilen metin gönderim anındakinden farklı olabilir.
- **Riskler:**
  - Şablon metninin sessizce değiştirilmesi. Önlem: hash kilidi testi.
  - Randevu verisinin sonradan değişmesi. Önlem: gerekirse gönderim anındaki değişkenler (saat, salon adı; kişisel veri değil) ayrı bir `templateParams` jsonb alanında tutulur. Bu ilk sürümde yok; ihtiyaç doğarsa ayrı karar.

---

## ADR-0048: Kayıtta sözleşme ve rıza kabulleri `legal_acceptances` tablosunda belge başına ayrı satır olarak saklanır

- **Durum:** kabul edildi (gelistirici, kalıcı izin 4; kaynak `tasarim-girdisi/yasal-ekran-gereksinimleri.md` K1/K3). Görev W30.
- **Bağlam:** Yeni kayıt ekranı K1 (zorunlu: Kullanım Şartları + Veri İşleme Sözleşmesi) ve K3 (isteğe bağlı: ürün/kampanya e-postası) kutularını gösterir; sunucuda bunları saklayan alan yoktu. Ticari ileti onayı sözleşme kabulüne bağlanamaz; kabul kaydı her belge için ayrı satır olmalıdır.
- **Karar (hukuk-uyum W30-1 ile güncellendi):** İki yalnız-ekleme tablo (UPDATE tetikleyiciyle engelli): `legal_acceptances` (tenantId, userId, documentType `terms|dpa|privacy_notice`, documentVersion, acceptedAt, ipAddress, userAgent, channel `signup|reaccept`, labelVersion; belge başına ayrı satır) ve `marketing_consents` (K3; channel email, status `granted|revoked`, source `signup_form`, consentTextVersion, at, ipAddress, userAgent). `POST /auth/register` gövdesine isteğe bağlı `consents: { terms: true, termsVersion, dpaVersion, labelVersion, marketingEmail? }` eklenir; sürümler sunucu sabitleriyle (`GET /auth/legal-versions`) eşleşmezse `400 LEGAL_VERSION_MISMATCH`, `terms` true değilse 400. Kayıt ve kabuller aynı işlemdedir; K3 işaretsizse satır yazılmaz. `consents` yoksa (canlıdaki eski arayüz) kabul satırı yazılmaz; eski arayüz kalkınca zorunlu yapılır. Kampanya e-postası İYS netleşene kadar gönderilmez. IP ve user-agent kabul kanıtı olarak saklanır (hukuk-uyum). Saklama süreleri hukuk-uyum teyidine bağlı.
- **Sonuçlar:** Geri çekme ve yeniden kabul (G1) yeni satırdır; satırlar güncellenmez. Tablo `tenantId` taşır, kiracı silinince düşer (KVKK silme). `docs/kvkk` envanterine "kabul kaydı: belge, sürüm, zaman" eklenmeli (hukuk-uyum). Migration `20261030090000_legal_acceptances`, geri alma DROP TABLE.
- **Güncelleme (2026-10-30, müdür kararı):** Kayıtlar kiracı/kullanıcı silinince düşmez (saklama 10 yıl kabul, 3 yıl ticari ileti izni): `tenantId`/`userId` yabancı anahtarları `ON DELETE SET NULL`, satırda `tenantSlug`, `tenantName`, `userEmail` anlık görüntü olarak saklanır; yalnız-ekleme tetikleyicisi yalnız SET NULL'un yaptığı `tenantId`/`userId` -> NULL güncellemesine izin verir. Migration `20261030100000_legal_records_set_null`. Yukarıdaki "kiracı silinince düşer" cümlesi bu güncellemeyle geçersizdir.

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
