# BeautyOS — Sunucu Taşıması KVKK Değerlendirmesi

> **TASLAK — HUKUKİ GÖRÜŞ DEĞİLDİR.** Bu belge `hukuk-uyum` ajanının uyum değerlendirmesidir; avukat görüşünün yerine geçmez. Özellikle §2 (yurt dışı aktarım mekanizması, standart sözleşme imzası ve bildirimi) ve §3 (anamnez için hukuki sebep) **ilk gerçek müşteriden önce bir bilişim/KVKK avukatına kontrol ettirilmelidir.** Mevzuat bilgisi 2026-10-27 tarihinde aşağıdaki kaynaklarla doğrulanmıştır; değişmiş olabilir, resmi metinlere (kvkk.gov.tr, mevzuat.gov.tr, Resmî Gazete) bakın.

- **Tarih:** 2026-10-27 · **Hazırlayan:** hukuk-uyum · **Dal:** `tasima/sunucu`
- **Girdi:** `docs/mevcut-durum.md`, `docs/tasima-plani.md` (§9, §14), `docs/kararlar.md` (ADR-0008, ADR-0015), `apps/api/prisma/schema.prisma`, `apps/api/src/ai/intent.service.ts`, `apps/api/src/instrument.ts`, `apps/api/src/routes/customer-enrichment.route.ts`. `docs/kvkk.md` henüz yok.
- **Durum varsayımı:** Gerçek kullanıcı yok; veritabanında yalnız deneme/demo verisi var (kurucu teyit etmeli, bkz. §6 K1).

## Özet (kurucu için)

1. **Taşıma KVKK açısından durumu kötüleştirmiyor, iyileştiriyor.** Bugün veri zaten yurt dışında (Supabase, Vercel, Railway, Upstash). Taşımadan sonra veri işleyen sayısı azalır ve ana veri AB'de (Almanya) tek yerde toplanır. **Taşımayı durduracak bir KVKK engeli yok.**
2. Asıl açık konu taşımadan bağımsızdır: **2024 değişikliğinden sonra yurt dışı aktarım için Türkçe standart sözleşme + Kurum'a 5 iş günü içinde bildirim** gerekir. Büyük sağlayıcıların (DigitalOcean, Cloudflare, Google, Telegram) bunu imzalaması pratikte belirsizdir. Bu, **ilk gerçek müşteriden önce** avukatla çözülmesi gereken bir iştir. Taşıma için engel değildir.
3. **Turuncu bulut (ADR-0008): ŞARTLI ONAY** (§4).
4. **Yedek saklama 7 gün / 4 hafta / 6 ay: ONAY**, B2 sürüm ayarı ve imha kaydı şartıyla (§5).
5. Anamnez (sağlık verisi) bugün kodda Gemini'ye ve Telegram'a **gitmiyor**. Ancak **Sentry'ye hata anında istek gövdesiyle gidebilir.** Bu, geçişten önce kapatılmalı (§3).

---

## 1. Veri envanteri özeti

BeautyOS'un rolü: Salonların müşterileri ve personeli bakımından **veri işleyen**. Salon (kiracı) **veri sorumlusu**. Salon sahibinin kendi hesap/fatura/iletişim verisi bakımından BeautyOS **veri sorumlusu**.

| # | Kategori | Tablo / alan (şema) | Özel nitelikli mi | Nerede tutulacak | Hangi alt işleyene gidiyor |
|---|---|---|---|---|---|
| E1 | Salon kullanıcı kimlik/iletişim | `users` (fullName, email, phone, avatarUrl), `staff_profiles` | Hayır | DO FRA1 Postgres + B2 yedek | Resend (e-posta), Sentry (hata olursa), Cloudflare (geçiş) |
| E2 | Kimlik doğrulama | `users.passwordHash`, `password_reset_tokens`, JWT/çerez | Hayır (güvenlik verisi) | DO FRA1 | Cloudflare (geçiş). Sentry'de maskeli |
| E3 | Salon müşterisi kimlik/iletişim | `customers` (fullName, phone, email, birthDate) | Hayır | DO FRA1 + B2 | NetGSM (TR, SMS), Resend, Telegram/WhatsApp (bot), Cloudflare, Sentry (hata olursa) |
| E4 | **Sağlık verisi** | `customers.allergyNotes`, `customer_anamnesis_answers.value` (ör. "Kalp rahatsızlığınız var mı?") | **EVET (KVKK m.6, sağlık)** | DO FRA1 + B2 | Cloudflare (geçiş, TLS açık), **Sentry (risk, §3)**. Gemini/Telegram'a kodda gönderilmiyor |
| E5 | Serbest metin notları | `customers.preferenceNotes`, `appointments.notes`, `waitlist.notes`, `customer_packages.notes` vb. | Olabilir (personel sağlık bilgisi yazabilir) | DO FRA1 + B2 | Cloudflare, Sentry (hata olursa) |
| E6 | Randevu / hizmet geçmişi | `appointments`, `waitlist`, `customer_packages`, `package_usages` | Hayır (hizmet türü dolaylı sağlık bilgisi verebilir: ör. medikal cilt bakımı) | DO FRA1 + B2 | NetGSM (hatırlatma SMS'i), Telegram (bot) |
| E7 | Müşteri fotoğrafı | `customer_photos.url` (dış URL; dosya bizde değil) | Hayır (biyometrik işleme yok). Ancak öncesi/sonrası fotoğrafları hassas | Dosya **bilinmeyen dış depoda** | URL'nin barındığı servis belirsiz (bkz. §6 S3) |
| E8 | Bot konuşmaları | `bot_conversations.messages`, `customerRef` (telefon/chat ID), `bot_sessions` | Serbest metin; müşteri sağlık bilgisi yazabilir | DO FRA1 + B2 | **Telegram** (ABD dışı, BAE merkezli), **Google Gemini** (son 4 mesaj + yeni mesaj) |
| E9 | İleti kayıtları (güncelleme 2026-10-29, A8 / ADR-0044–0046) | `message_deliveries` (channel, phone ya da email, purpose, appointmentId, customerId, durum; **body yalnız gerekli amaçlarda**, aşağıya bakın), `notification_logs`, `phone_verifications` (phone, ipAddress) | Hayır. Klinik türlerinde hizmet adı içerikte yok (ADR-0044) | DO FRA1 + B2 | NetGSM (TR, SMS); **Resend (ABD, e-posta: salon müşterisine hatırlatma, salon kullanıcısına hesap e-postaları)**. Yurt dışı aktarım: m.9 standart sözleşme kurulmadı (H12, avukat) |

**E9 ayrıntısı (2026-10-29):**
- **Gönderim ve kapsam:** Hatırlatmalar SMS yoksa salon müşterisinin e-postasına Resend üzerinden gider; bugün fiilen tek kanal bu. Panelden açılan randevular da hatırlatma alır (ADR-0045). Rol: salon veri sorumlusu, BeautyOS veri işleyen, Resend alt işleyen.
- **Hukuki sebep (salon için):** Sözleşmenin ifası (m.5/2-c). Hatırlatma bir bilgilendirme iletisidir, İYS onayı gerekmez ve tanıtım içeriği eklenmez.
- **Gövde saklama:** Hatırlatma ve doğrulama iletilerinde `body` **saklanmaz** (mimar önerisi kabul, 2026-10-29). Yerine şablon anahtarı ve şablon sürümü tutulur. Şablonlar sürümlü ve değiştirilemez olarak saklanır, böylece hangi içeriğin gittiği ispatlanabilir. Doğrulama kodu (OTP) hiçbir kanalda saklanmaz. İleride kampanya iletileri gelirse aynı model kullanılır (şablon + sürüm + izin kaydı); salonun serbest yazdığı metin varsa yalnız o gövde saklanır ve 1 yılın sonunda boşaltılır.
- **Resend ayarları:** Açılma ve tıklama izleme (tracking pixel, link tracking) **kapalı** olmalı. Bu izleme ayrı bir kişisel veri işleme demek ve rıza gerektirir. Resend panelindeki içerik ve log saklama süresi mümkün olan en kısa değere çekilmeli (devops). Resend, alt işleyen listesine "e-posta gönderimi · ABD" olarak yazılmalı.
- **Mesaj içeriği:** Randevu yönetim bağlantısı (token) mesajlarda yok (ADR-0046). İçerik salon adı, tarih ve saatle sınırlı.
| E10 | Ticari ileti izni | `customers.marketingConsent*` | Hayır | DO FRA1 | (İYS kaydı salonun yükümlülüğü) |
| E11 | Finans | `transactions`, `financial_transactions`, `current_account_entries`, `staff_payouts`, `tip_entries`/`tip_distributions` (personel geliri), `suppliers` (yetkili telefonu/e-postası) | Hayır | DO FRA1 + B2 | Yok (Sentry hata anında) |
| E12 | Erişim / denetim izi | `activity_logs` (userId, ipAddress, userAgent, metadata eski/yeni değer) | Hayır (ama metadata'ya sağlık verisi düşebilir) | DO FRA1 + B2 | Yok |
| E13 | Trafik / ağ verisi | IP, user agent, çerez, Turnstile sinyalleri | Hayır | Caddy/Docker log (sunucu), Cloudflare | Cloudflare (proxy + Turnstile) |
| E14 | Doğrulanmamış online randevu talebi (2026-10-29, S2 `d9b44a7`) | `appointments.requestedName`, `appointments.requestedPhone` (`customerId` boş; SMS doğrulaması olmayan modda) | Hayır. Klinikte talebin varlığı ve işlem adı sağlık verisine dair çıkarım sağlayabilir | DO FRA1 + B2 | Cloudflare (geçiş + Turnstile), Sentry (hata olursa, maskeli) |

**E14 ayrıntısı:** Talebi giren kişi, numaranın sahibi olmayabilir.
- **Amaç:** Salonun talebi değerlendirmesi ve onaylaması. Rol: salon veri sorumlusu, BeautyOS veri işleyen.
- **Hukuki sebep (salon için):** Sözleşmenin kurulması için gerekli olması (m.5/2-c).
- **Paylaşım:** Yalnız salon paneli. Müşteri kaydına bağlanmaz; panelde "doğrulanmamış" olarak görünür.
- **Saklama:**
  - Onaylanırsa salon müşteri kaydıyla eşleştirir ya da yeni kayıt açar. Bundan sonra veri E3'ün süresine tabidir.
  - Reddedilen ya da süresi dolan talepte ad ve telefon, gece taramasıyla 30 gün sonra anonimleştirilir (`'-'`; testli).
- **Yurt dışı aktarım:** Ayrı bir aktarım yok; E13 ile aynı (Cloudflare).
- **Güvenlik tedbirleri:** Herkese açık uçta yanıt, slot ve süre telefona göre değişmez. Telefon tavanı yok. Sınırlar: IP başına saatte 3, işletme başına günde 20 talep, Turnstile, salon onayı (denetim `raporlar/denetim/beautyos-S2-2.md`).
- `docs/kvkk.md` henüz yok; ürün veri envanteri bu tabloda tutuluyor.

**Saklama süresi:** Kodda müşteri silme / anonimleştirme uç noktası ve otomatik imha işi **yok** (yalnız anamnez cevabı ve fotoğraf tek tek silinebiliyor). Saklama süreleri sözleşme döneminde salonun talimatına bağlıdır; abonelik bitince silme/iade kuralı DPA'da yazılmalı (§6 M-4).

### Alt işleyenler ve konum (taşıma sonrası)

| Alt işleyen | Konum (bilinen) | Ne görüyor | Yurt dışı mı |
|---|---|---|---|
| DigitalOcean (sunucu, droplet yedeği) | Almanya (FRA1); ABD şirketi | Tüm veri (disk) | **Evet** |
| Backblaze B2 | AB (eu-central); ABD şirketi | Yalnız istemci tarafında **şifreli** yedek | Evet (şifreli; bkz. §2) |
| Cloudflare (DNS, proxy, Turnstile) | Küresel kenar ağı; ABD şirketi | Turuncu bulutta tüm HTTP trafiği **açık metin** (geçişte) | **Evet** |
| Google Gemini API | Belirsiz (Google altyapısı) | Bot mesajları, salon menü/personel adları | **Evet** |
| Telegram | Küresel; BAE merkezli | Bot üzerinden müşteri mesajları, randevu bilgisi | **Evet** |
| Sentry (varsa) | Hesabın bölgesine bağlı (ABD veya AB) | Hata olayları, istek gövdesi (§3) | **Evet** |
| Resend | ABD şirketi | E-posta adresi, ad, e-posta içeriği | **Evet** |
| NetGSM | Türkiye | Telefon, SMS metni | Hayır |
| UptimeRobot | ABD | Yalnız `/health` sonucu (kişisel veri yok) | Kişisel veri aktarımı yok |
| GitHub / GHCR | ABD | Kaynak kod ve imaj (kişisel veri **olmamalı**) | Kişisel veri aktarımı yok (koşul: CI'da gerçek veri yok, R5) |
| 360dialog / WhatsApp | Almanya / Meta | Kapalı (VARSAYIM) | Açılırsa evet |

**Kapanacaklar:** Supabase, Vercel, Railway, Upstash. Kapatma ve silme bir **imha işlemidir**; §5'teki tutanakla kaydedilir.

---

## 2. Yurt dışı aktarım (KVKK m.9)

### 2.1 Mevzuat (2026-10-27 itibarıyla doğrulandı)

- **7499 sayılı Kanun** (RG 12.03.2024) m.9'u değiştirdi. Değişiklik **01.06.2024**'te yürürlüğe girdi. Eski "açık rıza ile yurt dışına aktarım" ana yolu kalktı.
- **Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik** RG 10.07.2024'te yayımlandı.
- Sıra şöyle:
  1. **Yeterlilik kararı** (m.9/1): Kurul henüz ülke ilan etmedi (2026-10-27 aramasında bulunamadı; kvkk.gov.tr'den teyit edin). **AB/Almanya dahil hiçbir ülke "yeterli" değil.**
  2. **Uygun güvenceler** (m.9/4): Kurul'un ilan ettiği **standart sözleşme** (4 tür: VS→VS, VS→Vİ, Vİ→Vİ, Vİ→VS), bağlayıcı şirket kuralları (BCR), yazılı taahhütname (Kurul izni).
  3. **Arızi istisnalar** (m.9/6): Açık rıza (riskler hakkında bilgilendirme sonrası), sözleşmenin ifası vb. **Yalnız arızi (düzenli olmayan) aktarımlarda** kullanılabilir. Barındırma, yedek ve proxy gibi sürekli akışlar bu kapsama girmez.
- **Standart sözleşme kuralları** (Kurum duyurusu, 05.02.2025):
  - Seçimlik maddeler dışında **değiştirilemez.**
  - Yabancı alıcı dahil iki taraf **Türkçe metni** imzalar. İki tarafın imza tarihi metinde yazılı olmalıdır.
  - İmzanın tamamlanmasından sonra **5 iş günü içinde** Kurum'a bildirilir: fiziki olarak, KEP ile ya da **Standart Sözleşme Bildirim Modülü** üzerinden (modül Ekim 2024'te açıldı).
  - Taraf ya da içerik değişirse ve sözleşme sona ererse yeniden bildirim yapılır.
- **Yaptırım:** Bildirim yapmamak idari para cezasıdır (m.18). Bir kaynak 2026 için 90.308 TL – 1.806.377 TL aralığını aktarıyor. **Tutar her yıl yeniden değerlenir; güncel tutarı Kurum'dan teyit edin.**

### 2.2 BeautyOS'a uygulanması

Aktarım zinciri şöyle: **Salon (VS, Türkiye) → BeautyOS (Vİ, Türkiye) → yabancı alt işleyen (Vİ).** Sunucunun Almanya'da olması da aktarımdır (verinin yurt dışındaki sunucuda tutulması aktarım sayılır).

| Alt işleyen | Önerilen mekanizma | Pratik durum | Taşıma için engel mi |
|---|---|---|---|
| DigitalOcean | **Vİ→Vİ standart sözleşme**, BeautyOS ile DO arasında. BeautyOS imza sonrası 5 iş günü içinde bildirir | DO'nun Türkçe KVKK standart sözleşmesi imzaladığına dair kaynak bulunamadı. DO'nun kendi DPA'sı (AB SCC) var ama **KVKK yerine geçmez** | Hayır (bugünkü Supabase/Railway durumu da aynı) |
| Backblaze B2 | Vİ→Vİ standart sözleşme. Not: Veri istemci tarafında şifreli ve anahtar yalnız bizde. Bu, **riski çok düşürür**, ama "aktarım değildir" demek için avukat görüşü gerekir | Aynı | Hayır |
| Cloudflare | Vİ→Vİ standart sözleşme (proxy + Turnstile + DNS) | Aynı. Turnstile ile Cloudflare **zaten** alt işleyen | Hayır (§4) |
| Google Gemini | Vİ→Vİ standart sözleşme; ücretli katman / Google Cloud veri işleme şartları | Bir kaynağa göre Google Cloud gizlilik bildirimine KVKK bölümü eklenmiş (2026-10, teyitsiz) | Hayır. Ama **ücretsiz katman kullanılıyorsa** sorun (§3.2) |
| Telegram | Standart sözleşme **beklenmez** (Telegram imzalamaz). Kanal, **müşterinin kendi seçtiği** iletişim aracıdır | En zayıf halka. Seçenekler: (a) bot ilk mesajında aydınlatma + arızi aktarım için açık rıza, (b) bota yalnız asgari veri (sağlık verisi asla), (c) avukat görüşü | Hayır. İlk gerçek müşteriden önce karar |
| Sentry | Vİ→Vİ standart sözleşme; **AB veri bölgesi** (Frankfurt) seçilmeli | Aynı | Hayır. Ama gövde temizliği **geçişten önce** (§3) |
| Resend | Vİ→Vİ standart sözleşme; AB bölgesi varsa seçilmeli | Aynı | Hayır |

**Gerçekçi değerlendirme (kurucu için önemli):** Türkiye'de birçok SaaS şirketi büyük bulut sağlayıcılarla Türkçe standart sözleşme imzalatamıyor. Bu, sektörün yaygın gri alanı. Seçenekler, ilk gerçek müşteriden önce avukatla değerlendirilmeli:
1. Sağlayıcılardan KVKK standart sözleşmesi talep etmek. Bazı büyük sağlayıcılar Türkçe metin sunmaya başladı. Destek talebi açılır ve cevap belgelenir.
2. Talep reddedilen sağlayıcı için risk kabulü ya da muadil (ör. Türkiye'de barındırma) kararı (kurucu).
3. Yazılı taahhütname + Kurul izni (uzun süreç).

**Sözleşmelere yansıması:**
- **Salon ↔ BeautyOS Veri İşleme Sözleşmesi (DPA):**
  - Salon VS, BeautyOS Vİ.
  - Ekte **alt işleyen listesi** (yukarıdaki tablo, ülke ve amaçla) ve salonun bu listeye **genel yazılı izni** yer alır. Yeni alt işleyen için 30 gün önceden bildirim ve itiraz hakkı tanınır.
  - Yurt dışı aktarım maddesi: BeautyOS, salon adına m.9 mekanizmasını kurmayı üstlenir. Salon da aydınlatma metninde yurt dışı aktarımı ve alıcı gruplarını belirtir.
  - Sağlık verisi maddesi (§3).
  - İhlal bildirimi: BeautyOS → salon **gecikmeksizin, en geç 24 saat**. Salon → Kurul **72 saat** (Kurul kararı 24.01.2019, 2019/10).
  - Abonelik sonunda veri iade + silme süresi, yedeklerden doğal silinme süresi (§5).
  - Denetim hakkı, gizlilik, m.12/2 müteselsil sorumluluk.
- **Salonun aydınlatma metni şablonu** (BeautyOS salonlara verir): Yurt dışı aktarım, alıcı grupları, anamnez için açık rıza metni.
- **BeautyOS gizlilik politikası:** Salon sahibi verileri için BeautyOS'un VS olduğu kısım.

---

## 3. Özel nitelikli veri (anamnez)

### 3.1 Hukuki sebep

- 2024 değişikliğinden sonra m.6/3'te sağlık verisi için hukuki sebepler şunlardır: açık rıza; kanunda açık öngörme; hayati koruma; ilgilinin alenileştirmesi; hakkın tesisi; **sır saklama yükümlülüğü altındaki kişilerce** kamu sağlığı, koruyucu hekimlik, teşhis, tedavi ve bakım. Güzellik salonu bu sonuncusuna girmez.
- **Sonuç:** Anamnez için pratik tek dayanak **açık rızadır.** Rızayı veri sorumlusu olan salon alır.
  - Rıza ayrı, belirli konuya ilişkin ve bilgilendirmeye dayalı olmalı; hizmet şartına bağlanmamalı.
  - Ürün bunu desteklemeli: anamnez formunda rıza kaydı (kim, ne zaman, hangi metin sürümü) ve rıza geri alınınca cevapların silinmesi.
  - Kodda bugün **rıza kaydı yok** (`customers` yalnız ticari ileti iznini tutuyor) → ilk gerçek müşteriden önce yapılmalı.
- Ayrıca **Kurul'un 31.01.2018 tarih ve 2018/10 sayılı "Özel Nitelikli Kişisel Verilerin İşlenmesinde Alınması Gereken Yeterli Önlemler" kararı** uygulanır (m.6/4 ile zorunlu). 2024–2026 arasında bunun yerini alan yeni bir karar bulunamadı; teyit edin. Karar VS'ye hitap eder. BeautyOS Vİ olarak bunları **sözleşmeyle üstlenir ve teknik tarafını sağlar.**

### 3.2 Dış servislere sızma riski (kodda görülen)

| Akış | Durum | Risk | Gereken |
|---|---|---|---|
| **Gemini** | `intent.service.ts`: prompt'a salon adı/menü/personel adları + müşterinin **serbest mesajı** ve son 4 mesaj gider. `customers`/anamnez **gönderilmiyor**. Ham yanıt log'lanmıyor (iyi) | **Orta.** Müşteri kendisi "alerjim var", "hamileyim" yazabilir. Bu metin Google'a gider. **Gemini API ücretsiz katmanında Google içeriği ürün iyileştirme için kullanabilir ve insan inceleyici okuyabilir** (Google şartlarına göre; teyit edin) | (1) Gemini anahtarı **ücretli katmanda** (Cloud Billing bağlı) olmalı. Kurucu teyit eder. (2) Mesajdan telefon/e-posta/TC kimlik no gibi kalıplar Gemini'ye gitmeden maskelenir (ilk gerçek müşteriden önce). (3) Bot aydınlatmasında "mesajlarınız yapay zekâ sağlayıcısında işlenir" ifadesi. (4) Anamnez/allergyNotes'un ileride prompt'a eklenmesi **yasak** (denetçi maddesi) |
| **Telegram** | Bot üzerinden randevu konuşması. Anamnez bota gönderilmiyor (kodda `anamnesis` bot/kanal dosyalarında yok) | Düşük-orta (serbest metin) | Bot hiçbir zaman sağlık verisi **göndermez/istemez**. `bot_conversations.messages` için saklama süresi (öneri 90 gün) |
| **Sentry** | `instrument.ts`: `sendDefaultPii: false`, ama `beforeSend` yalnız parola/token alanlarını maskeliyor. **İstek gövdesi (`event.request.data`) olduğu gibi gidiyor.** `PUT /customers/:id/anamnesis` ya da müşteri oluşturma/güncelleme sırasında hata olursa **anamnez cevapları, allergyNotes, telefon** Sentry'ye (yurt dışı) gider. Gövde dizgi (string) olarak gelirse maskeleme hiç çalışmaz | **Yüksek** (özel nitelikli verinin kontrolsüz yurt dışı aktarımı) | **Geçişten önce:** `beforeSend` içinde `event.request.data`, `query_string` ve çerezler tümden silinsin (izin listesi yaklaşımı). Breadcrumb'larda gövde/konsol verisi olmasın. Sentry projesi AB bölgesinde olsun ya da `SENTRY_DSN` boş bırakılsın. **En basit yol:** Bu düzeltme yapılana kadar `SENTRY_DSN` boş |
| **Uygulama logları** | `queue.ts:84` telefonu log'luyor (R10). pino-http ile gövde log'lama görülmedi | Orta (log'lar sunucuda, yurt içi değil ama Docker log rotasyonu dışında saklanmamalı) | G5'te düzeltilmesi yeterli, ama **geçişten önce** yapılırsa daha iyi (küçük değişiklik) |
| **Cloudflare** | Turuncu bulutta TLS kenarda açılır; anamnez PUT/GET gövdeleri Cloudflare belleğinden geçer | Orta (§4) | §4 şartları |

### 3.3 Teknik ve idari tedbirler (2018/10 kararına göre, BeautyOS tarafı)

| Tedbir | Bugün | Ne zaman |
|---|---|---|
| Aktarımda şifreleme (TLS, Full strict) | Var (plan) | Geçişte ✔ |
| Yedekte şifreleme (restic istemci tarafı, anahtar ayrı) | Plan var | Geçişten önce ✔ |
| Durağan veride şifreleme | DO disk şifrelemesi sağlayıcıya bağlı. Uygulama düzeyinde yok | **İlk gerçek müşteriden önce:** `customer_anamnesis_answers.value` ve `customers.allergy_notes` için uygulama düzeyinde alan şifrelemesi (anahtar `.env`'de, DB'den ayrı) — `mimar` ADR'si |
| Erişim yetkisi (rol bazlı) | Anamnez okuma/yazma `owner, manager, staff` (tüm personel). Kiracı filtresi var, RLS yok (R8) | İlk müşteriden önce: salonun anamnez erişimini rol bazında kısıtlayabilmesi (ör. "staff görmez" ayarı). Superadmin'in kiracı sağlık verisine erişimi kapalı olmalı ya da log'lanmalı (doğrulanmalı) |
| **İşlem kaydı (log)** | Anamnez okuma/yazma `activity_logs`'a **yazılmıyor** | İlk müşteriden önce: anamnez görüntüleme ve değiştirme olayları (kim, ne zaman, hangi müşteri; **değer yazılmadan**) |
| Uzaktan erişimde iki aşamalı doğrulama | SSH anahtarla (plan) | Geçişten önce: DO, Cloudflare, B2, GitHub, Sentry, Google hesaplarında 2FA açık; SSH anahtarında parola. Uygulama yöneticisi (owner/superadmin) için 2FA: ilk müşteriden önce planlanır |
| Güvenlik güncellemeleri, zafiyet taraması | Kısmi (Node 20 destek dışı, R6) | G18 (taşıma +14 gün) |
| Ayrı politika, personel gizlilik taahhüdü, eğitim | Yok | İlk müşteriden önce: kısa "Özel nitelikli veri güvenliği politikası" (`sirket/sozlesmeler/`) |
| Veri ihlali müdahale süreci | Yok | İlk müşteriden önce: 1 sayfalık prosedür (tespit → salona 24 saat → salon Kurul'a 72 saat) |

---

## 4. Turuncu bulut (ADR-0008): **ŞARTLI ONAY**

**Gerekçe:**
- Cloudflare TLS'i kenarda açtığı için kişisel veri (anamnez dahil) Cloudflare'in belleğinden açık halde geçer. Bu bir **Vİ→Vİ yurt dışı aktarımdır.** Ama:
  - Cloudflare **zaten** alt işleyen (DNS + Turnstile, herkese açık randevu formunda IP ve tarayıcı sinyalleri). Turuncu bulut yeni bir işleyen eklemiyor, kapsamını genişletiyor.
  - Gri bulutta da Almanya'daki sunucuya aktarım var; mekanizma sorunu (standart sözleşme) iki durumda da çözülmek zorunda.
  - DDoS koruması ve origin gizleme, m.12'deki "uygun güvenlik düzeyi" yükümlülüğünü **destekler.**
  - Gerçek kullanıcı yok; bugünkü risk demo veriyle sınırlı.

**Şartlar:**
1. **Önbellek yok:** `api.beautyossapp.com` için Cache Rule "Bypass cache". "Cache Everything" kuralı hiçbir hostta API ya da `/tenant/*`, `/book/*` yollarına uygulanmaz. API yanıtlarında `Cache-Control: no-store` olur (denetçi kontrol eder).
2. **Ek veri toplayan özellikler kapalı:** Web Analytics/RUM otomatik ekleme, Zaraz, Logpush, Workers, "Email Address Obfuscation" dışında içerik değiştiren özellikler.
3. SSL modu **Full (strict)**, minimum TLS 1.2. Bot Fight Mode kapalı (ADR'deki gibi).
4. Cloudflare hesabında **2FA** açık; DNS token'ı tek zona sınırlı (ADR-0009).
5. Cloudflare, DPA alt işleyen listesine ve salonlara verilecek aydınlatma şablonuna yazılır.
6. **İlk gerçek müşteriden önce** Cloudflare için m.9 mekanizması (standart sözleşme talebi) sonuçlandırılır. Kurulamazsa ve avukat risk kabulünü uygun bulmazsa **alternatif:** `api.beautyossapp.com` gri buluta alınır (sağlık verisi yalnız API'den geçer), web hostları turuncu kalır. ADR-0008'e göre Caddy değişmeden çalışır. Bedeli: origin IP açığa çıkar; ADR-0011'deki DO Cloud Firewall + hız sınırı önlemleri devreye girer.

---

## 5. Yedek saklama, silme ve imha

| Konu | Görüş |
|---|---|
| restic → B2 (AB), istemci tarafında şifreli, **7 günlük / 4 haftalık / 6 aylık** | **ONAY.** Gerekçe: güvenlik ve süreklilik amacı meşru; 6 ay, ilgili kişinin silme talebinden sonra verinin yedeklerde en geç ~6 ay kalması demek. DPA'da ve aydınlatma şablonunda "silinen veri yedeklerden en geç 6 ay içinde kendiliğinden silinir" diye yazılmalı. |
| **Şart 1: B2 sürüm ayarı** | B2 kovasının varsayılanı "tüm sürümleri sakla"dır. Bu ayarda `restic forget --prune` dosyayı yalnız gizler, **veri silinmez.** Kova yaşam döngüsü kuralı "Keep only the last version" (ya da gizlenen dosyayı 1 gün sonra sil) olmalı. Object Lock / değişmezlik kullanılacaksa süresi 6 ayı geçmemeli. |
| **Şart 2: `forget --prune` gerçekten çalışmalı** | Gece işinde `forget` + haftalık `prune`. Başarısızlık Telegram uyarısına bağlı. |
| **Şart 3: Geri yükleme sonrası silmelerin yeniden uygulanması** | Yedekten geri dönülürse, son yedekten sonra yapılmış silme/anonimleştirme talepleri yeniden uygulanır. Bunun için silme talepleri **kişisel veri içermeyen** bir kayıtta tutulur (kiracı + kayıt kimliği + tarih). İlk gerçek müşteriden önce yapılır. |
| **Şart 4: "arşiv" etiketi** | Plan §14.1'deki Supabase son dökümü `arsiv` etiketiyle alınacak. `forget` politikasında `--keep-tag arsiv` **kullanılmamalı**; kullanılırsa döküm süresiz kalır. Veri demo ise öneri: arşiv **en fazla 30 gün**, sonra silinir. Demo olduğu teyit edilemezse en fazla 6 ay. |
| Geri yükleme denemesi | Geçici konteyner deneme sonrası **hemen silinir** (volume dahil). Yerel geçici döküm kalmaz. |
| DO droplet yedeği (7 gün) | **ONAY.** Aynı sağlayıcı ve bölgede, 7 günde döner. Alt işleyen listesinde DO zaten var. |
| Yerel yedek kopyası (7 gün, plan §2) | ONAY. Dosya izinleri 600/700. |
| Taşıma dökümleri `/srv/beautyos/tasima/` | Plandaki gibi: chmod 700, kapatma (+14 gün) sonrası silinir `[ONAY]`. |
| Eski platformların silinmesi | Supabase (kendi otomatik yedekleri dahil), Railway (log'larda telefon numarası olabilir, R10), Vercel, Upstash, GitHub `DATABASE_URL` sırrı. **Her silme bir imha işlemidir:** tarih, ne silindi, kim onayladı bilgisiyle kısa bir **imha tutanağı** `sirket/` altında tutulur (içerik değil, kayıt). |
| Docker log'ları | 10 MB × 3 rotasyon yeterli. Log'a kişisel veri yazılmaması asıl kural (R10). |
| Sentry olay saklama | Sağlayıcı varsayılanı (genelde 30–90 gün) kabul. Gövde temizliği şartıyla (§3.2). |
| Uygulama içi saklama süreleri (ilk müşteriden önce) | Öneriler: `bot_conversations` 90 gün; `phone_verifications` 30 gün; `message_deliveries`: hatırlatma ve doğrulamada gövde hiç saklanmaz (şablon anahtarı + sürüm; 2026-10-29). Teslim kaydı 1 yıl tutulur, sonra alıcı alanları (phone, email) anonimleştirilir; sayım ve durum kalabilir. Mevcut kayıtlardaki `body` bir kerelik geçişle boşaltılır. Serbest metinli ileti olursa gövdesi 1 yıl sonra boşaltılır; `activity_logs` 2 yıl; `bot_sessions` süre dolunca. Müşteri kaydı: salon silene ya da abonelik bitip iade süresi (öneri 30 gün) dolana kadar. Bu süreler salonla DPA'da kararlaştırılır. Kod: gece imha işi + müşteri silme/anonimleştirme uç noktası. |

---

## 6. Ne zaman ne yapılacak

### 6.1 Geçişten ÖNCE zorunlu (az ve küçük)

| # | Madde | Sahip |
|---|---|---|
| G-1 | **Sentry gövde sızıntısı:** `beforeSend` istek gövdesini/sorgu dizgisini/çerezleri tümden siler **veya** `SENTRY_DSN` geçişte boş bırakılır. Sentry açık kalacaksa proje AB bölgesinde olmalı | gelistirici (kod) / kurucu (DSN) |
| G-2 | **B2 kovası:** AB bölgesi, yaşam döngüsü "yalnız son sürüm", restic `forget --prune` politikası 7/4/6 ve **`arsiv` etiketi süresiz tutulmuyor** | devops |
| G-3 | **Cloudflare ayarları:** API için önbellek atlama, Full (strict), Web Analytics/Zaraz/Logpush kapalı | kurucu (panel), devops (kontrol) |
| G-4 | **Hesap güvenliği:** DO, Cloudflare, B2, GitHub, Sentry, Google (Gemini) hesaplarında 2FA. restic parolası ayrı yerde (plan). Döküm klasörü 700 | kurucu |
| G-5 | **Kurucu teyidi:** Supabase'teki verinin gerçek kişilere ait olmadığı (demo/deneme). Gerçek kişi verisi varsa (ör. denenmiş gerçek bir salon) önce bana dönülür. O zaman 6.2'deki rıza/aydınlatma maddeleri öne çekilir | kurucu |

Önerilen (zorunlu değil): `queue.ts` telefon log'u (R10) geçişten önce düzeltilirse yeni sunucunun log'ları baştan temiz olur.

### 6.2 İlk gerçek müşteriden (ilk ücretli/gerçek salon) ÖNCE

1. **Avukat incelemesi:** m.9 mekanizması (her alt işleyen için standart sözleşme talebi/imza/5 iş günü bildirimi ya da risk kabulü), anamnez için açık rıza metni, DPA.
2. **Salon ↔ BeautyOS DPA**, alt işleyen listesi eki, kullanım şartları, BeautyOS gizlilik politikası (`sirket/sozlesmeler/` altında hukuk-uyum taslaklar).
3. **Salon için aydınlatma metni + anamnez açık rıza şablonu.** Üründe rıza kaydı (metin sürümü, zaman, kim) ve rıza geri alınınca anamnezin silinmesi.
4. **Anamnez alan şifrelemesi** (uygulama düzeyi) + anamnez okuma/yazma erişim kaydı + rol bazlı erişim ayarı + superadmin erişiminin kısıtlanması/log'lanması.
5. **Müşteri silme / anonimleştirme** uç noktası ve gece **imha işi** (§5 süreleri). Silme talebi kaydı (yedekten dönüşte yeniden uygulama için).
6. **Gemini:** Ücretli katman teyidi, Gemini'ye gitmeden mesajda kişisel veri maskeleme, bot ilk mesajında kısa aydınlatma ve gizlilik bağlantısı. **Telegram** için avukatla karar (açık rıza / risk kabulü).
7. **Veri ihlali prosedürü** (salona 24 saat, Kurul'a 72 saat) ve özel nitelikli veri güvenlik politikası + gizlilik taahhüdü.
8. **RLS projesi (T-B1)**: Sağlık verisi olan çok kiracılı sistemde kiracı sızıntısı en büyük ihlal riskidir. En azından anamnez ve müşteri tablolarında ilk müşteriden önce değerlendirilmeli (mimar kararı; zorunluluk değil, güçlü öneri).
9. `customer_photos.url` hangi dış depoya gidiyor (S3/Vercel Blob?) netleşmeli. O depo da alt işleyen ve yurt dışı aktarımdır.
10. VERBİS: BeautyOS'un kendi VS faaliyeti için kayıt yükümlülüğü (çalışan/bilanço eşikleri) avukatla teyit edilir. Salonlar kendi yükümlülüğüne bakar.

### 6.3 Kurucuya sorular

- **S1:** Supabase'teki veriler tamamen demo mu? Gerçek bir salonda denendi mi?
- **S2:** Gemini API anahtarı ücretli (faturalı) projede mi?
- **S3:** Müşteri fotoğrafları hangi depoda barınıyor?
- **S4:** Sentry hesabı hangi bölgede (US/EU), aktif kullanılıyor mu?

---

## 7. Kaynaklar (erişim: 2026-10-27)

- 6698 sayılı KVKK (güncel metin): https://www.mevzuat.gov.tr — m.6, m.9, m.12, m.18
- Kurum duyurusu, standart sözleşmelerde dikkat edilecek hususlar (05.02.2025): https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu
- Standart Sözleşme Bildirim Modülü duyurusu: https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu
- Kurul kararı 2018/10 (özel nitelikli veride yeterli önlemler): https://www.kvkk.gov.tr/Icerik/4110/2018-10
- Kurul kararı 2019/10 (veri ihlali bildirimi, 72 saat): kvkk.gov.tr "Kurul Kararları"
- Yurt Dışına Aktarım Yönetmeliği (RG 10.07.2024) ve 7499 sayılı Kanun (RG 12.03.2024): mevzuat.gov.tr / resmigazete.gov.tr
- İkincil kaynaklar (yaptırım tutarı, uygulama): cottgroup.com "Standart sözleşme bildirim yükümlülüğü ve yaptırımları"; erdem-erdem.av.tr bilgi bankası
