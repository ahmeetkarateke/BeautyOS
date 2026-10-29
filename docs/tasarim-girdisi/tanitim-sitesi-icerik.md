# BeautyOS Tanıtım Sitesi: İçerik ve Mesaj Girdisi

- **Sahibi:** pazarlama · **Sürüm:** 1 · **Tarih:** 2026-10-28 · **Mod:** Persuade (tanıtım sitesi)
- **Okuyanlar:** `ui-ux-tasarimci` (tasarım), `teknik-yazar` (ton), `hukuk-uyum` (ifade kontrolü), `urun-analisti` (özellik teyidi)
- **Kaynaklar:** `docs/tasarim-brief.md` (özellikle madde 9, 10, 14, 15, 16, 17), `raporlar/inceleme/beautyos-2026-10-28/pazarlama.md` + `is-gelistirme.md`, `design-taste-frontend/references/copy.md`.
- **Dışarı yayınlanmaz.** Site yayına girmeden önce metin `giden-mesaj-onayi` sürecinden geçer (kurucu onayı).

## 0. Nasıl okunur: durum etiketleri

Her özellik iddiasının yanında durum etiketi vardır. Tasarımcı etiketi arayüzde görünür yapar (ör. "Yakında" rozeti).

| Etiket | Anlamı | Sitede |
|---|---|---|
| **VAR** | Canlı kodda çalışıyor (inceleme raporlarıyla doğrulandı) | Normal anlatılır |
| **VAR (koşullu)** | Kod var, canlıda açılması ayrı bir ayara bağlı | Yalnız o ayar açıldıktan sonra "var" yazılır; açılana dek "Yakında" |
| **YAKINDA** | Kodda yok ya da kapalı; geliştirilebilir | "Yakında" rozeti, tarih verilmez, "yol haritasında" dürüstlüğüyle |
| **YOK** | Yapılmayacak / söylenmeyecek | Sitede geçmez |

**Teyit notu:** `urun-analisti`'nin "var / yakında" listesi henüz gelmedi. Aşağıdaki etiketler kod ve inceleme raporlarından çıkarılan **geçici** etiketlerdir. Liste gelince tek tek eşlenir; çelişen satır varsa bu dosya güncellenir (sürüm 2). `[TEYİT]` işareti taşıyan cümleler teyit gelmeden yayına girmez.

### Özellik durum tablosu (geçici)

| Özellik | Durum | Dayanak / not |
|---|---|---|
| Personel takvimi, randevu oluşturma/taşıma | VAR | `Appointment`, takvim ekranı |
| Sürükle-bırak ile yeniden planlama | VAR (urun-analisti düzeltmesi: yalnız gelecekteki randevu, yalnız sahip/müdür; telefonda zor) | Öne çıkarılmaz; en çok "Bilgisayarda randevuyu sürükleyerek taşıyabilirsiniz" cümlesi, yalnız bilgisayar bağlamında. Telefon mesajı "randevuyu taşıma" |
| "Yapay zekâ çakışma tespiti" | **YOK** | Doğrulanamadı. Sitede geçmez. Çakışma uyarısı varsa "çakışma uyarısı" [TEYİT] |
| Koltuk / oda / cihaz takibi | **YOK / YAKINDA** (urun-analisti: oda/cihaz yok) | Sitede geçmez |
| Müşteri kartı, geçmiş işlemler | VAR | `Customer` |
| Anamnez (müşteri formu), özel sorular | VAR | `AnamnesisQuestion`, `CustomerAnamnesisAnswer`. Sağlık verisi: ifade `hukuk-uyum` onayında |
| Öncesi / sonrası fotoğraf arşivi | VAR | `CustomerPhoto` |
| Online randevu sayfası (`/book/<salon>`) | VAR (koşullu) | SMS doğrulamalı; SMS kapalıyken fiilen çalışmıyor, bot koruması anahtarı da boş. SMS açılana dek "Yakında" |
| Otomatik onay ve hatırlatma (SMS, 24s/2s) | **YAKINDA** (urun-analisti: kod var, SMS kapalı) | SMS açılıp kota kararı (finans) verilene dek "Yakında" |
| Müşterinin kendi randevusunu iptali, kapora, sadakat/kampanya, çoklu şube, Google Takvim | **YOK / YAKINDA** | Sitede geçmez |
| Dışa aktarma (Excel/CSV) | **YOK / YAKINDA** | "Yakında"; muhasebeci raporu cümlesi çıkar |
| Depozito ile no-show koruması | **YAKINDA** | Kodda depozito yok |
| Bekleme listesi | VAR | `Waitlist` |
| Hizmet paketleri / seans takibi | VAR | `ServicePackage`, `CustomerPackage`, `PackageUsage` |
| Personel primi (yüzde, sabit, hizmet bazlı) | VAR [TEYİT kural türleri] | `StaffPayout` |
| Bahşiş dağıtımı | VAR | `TipEntry`, `TipDistribution` |
| İzin ve mesai | VAR | `StaffLeave` |
| Kasa, gelir-gider | VAR | `Transaction`, `Expense` |
| Cari hesap, tedarikçi | VAR | `CurrentAccountEntry`, `Supplier` |
| Alış faturası kaydı, stok girişi | VAR | `PurchaseInvoice` (yalnız alış faturası kaydı; e-Fatura kesmez) |
| Stok takibi, hizmet başına malzeme düşümü, düşük stok **listesi** (stok sayfasında) | VAR; "anında bildirim" **YOK** | `InventoryItem`, `StockMovement`, `ServiceInventoryRecipe` |
| Hesaplar arası virman | VAR (urun-analisti teyit) | `FinancialAccount`, `FinancialTransaction` |
| Uzman yalnız kendi randevularını görür | VAR (sunucu tarafında) | Ayrı "Günüm" / "Benim primim" ekranları **YAKINDA** (yeni tasarımla) |
| Rol bazlı yetki (sahip, müdür, resepsiyon, uzman) | **YAKINDA** (bugün pratikte yalnız sahip + personel) | Backend yapılana dek "yetkiler unvana göre" cümlesi yazılmaz |
| Mesaj asistanı (WhatsApp / Telegram ile randevu; sözlük terimi "bot" değil) | **YAKINDA** | Canlıda kapalı, WhatsApp bağlantısı yok |
| e-Fatura / e-Arşiv kesme | **YOK** | Sitede "e-Fatura" geçmez; SSS'te açıkça "kesmez" yazılır |
| Online kart ödemesi (iyzico vb.) | **YOK** | Geçmez |
| İnternetsiz çalışma | **YOK** | Doğrulanamadı; SSS'te "internet gerekir" dürüstçe yazılır |
| Müşteri listesi içe aktarma aracı | **YAKINDA** [TEYİT] | Aracı yoksa "listenizi bize iletin, aktarımda yardımcı oluruz" yalnız kurucu kabul ederse |
| Sektör kapsamı (kurucu kararı S1, 2. tur) | Kuaför, berber, güzellik merkezi, tırnak/kirpik stüdyosu, lazer-epilasyon **ve klinikler** (estetik kliniği, diş hekimi, randevuyla çalışan diğer sektörler) | Klinik sayfaları var. Sağlık iddiası yok (bkz. bölüm 5.4). "Klinikler için henüz tasarlanmadı" ifadesi kaldırıldı |
| Ürün dilinin sektöre uyarlanması (Salon / Klinik-danışan setleri; "Hasta" seti kurucu + hukuk-uyum onayı bekliyor, vitrinde kullanılmaz; metin-rehberi §2b) | **YAKINDA** (kod gelince rozet kalkar) | Canlıda yok; klinik sayfalarında "yakında" rozetiyle anılır, hazır gibi yazılmaz |
| Veri saklama (kurucu V1) | 30 gün sonra silinir | SSS ve fiyat sayfasında kesin süre |
| Kayıt aktarımı yardımı (V5) | VAR (hizmet olarak): yeni salonun Excel müşteri listesi için ücretsiz yardım | Araç değil, elle yardım; "aktarma aracı" yazılmaz |
| Veri talebi (V4) | VAR (elle): talep eden salona veri iletilir | Dışa aktarma aracı yine "Yakında" |

### Brif madde 15 yasak listesi (sitede hiçbir yerde geçmez)

AWS, iyzico / PCI-DSS, e-Fatura entegrasyonu, "#1 / Türkiye'nin bir numarası", "500+ salon güveniyor", "42/50 kontenjan" ve her tür kontenjan sayacı, "uçtan uca şifreli", "KVKK uyumlu / uyumluluk" (yerine somut önlem yazılır), "ömür boyu fiyat", "sınırsız yapay zekâ", "yapay zekâ destekli" (özellik kanıtlanana dek), "%100 kişiselleştirilebilir", tanıtım videosu (yoksa), sahte müşteri yorumu/logo/puan, `beautyos.com` / `app.beautyos.com` alan adı görüntüleri.

## 1. Mesaj özeti (argüman)

- **Okur:** bağımsız kuaför, berber, güzellik merkezi sahibi ve (S1 ile) klinik yöneticisi: estetik kliniği, diş hekimi ve randevuyla çalışan diğer işletmeler. Defter, Excel ya da eski masaüstü programı kullanıyor; zamanı kısıtlı, ekranı çoğunlukla telefon.
- **Bu nedir (arkadaşa anlatır gibi):** Randevuyu, müşteri kartını, kasayı ve personel ödemelerini tek uygulamada tutan, telefondan kullanılan salon yönetim programı.
- **Tek inanç:** "Günüm telefonumdan, tek yerden yönetiliyor."
- **İnandıran:** gerçek ürün ekranları (büyük), neyin nasıl çalıştığının somut anlatımı, açık süreç ("30 günlük deneme").
- **Sonraki adım:** Ücretsiz deneyin (`/signup`). İkincisi: demo isteyin (`/iletisim`).
- **Farklılaşma (iddia değil, ürün gerçeği):** randevu + kasa + cari + stok + personel primi + paket seansı + müşteri formu aynı yerde; Türkçe muhasebe diline uygun terimler (cari, virman, alış faturası); sınırsız personel [TEYİT].
- **Ton:** net, hızlı, modern; "Siz" hitabı; kısa cümleler; abartı yok; sade profesyonel iş aracı. `teknik-yazar` metin rehberiyle uyumlanır (bkz. bölüm 11).

Sayfa sırası = argümanın sırası:

1. Ne olduğu ve tek faydası (hero, ürün ekranı)
2. Günlük işin tek yerde toplandığı (ekran + kısa kanıt)
3. Telefonda kullanıldığı
4. Kim için olduğu / olmadığı
5. Nasıl başlanır
6. Ne kadar tutar
7. Ne yakında geliyor
8. Sorular

## 2. Site haritası

| # | Sayfa | URL | Amaç | Birincil CTA |
|---|---|---|---|---|
| 1 | Ana sayfa | `/` | Anlat, güven ver, dene | Ücretsiz deneyin |
| 2 | Özellikler | `/ozellikler` | Modül modül detay + "Yakında" listesi | Ücretsiz deneyin |
| 3 | Fiyat | `/fiyat` | Paket ve soru giderme | Ücretsiz deneyin |
| 4 | Sıkça sorulan sorular | `/sss` | İtirazları gider | Ücretsiz deneyin |
| 5 | İletişim ve demo isteği | `/iletisim` | Gerçek iletişim kanalı | Mesaj gönder (form) / e-posta |
| 6 | Hakkımızda | `/hakkimizda` | Kim olduğumuzu söyle | İletişime geçin |
| 7 | Kuaförler için | `/kuafor-programi` | SEO + sektöre özel mesaj | Ücretsiz deneyin |
| 8 | Berberler için | `/berber-programi` | SEO + sektöre özel mesaj | Ücretsiz deneyin |
| 9 | Güzellik merkezleri için | `/guzellik-merkezi-programi` | SEO + sektöre özel mesaj | Ücretsiz deneyin |
| 9a | Klinikler için (merkez sayfa) | `/klinik-programi` | SEO + klinik mesajı | Ücretsiz deneyin |
| 9b | Estetik klinikleri için | `/estetik-klinik-programi` | SEO + sektöre özel mesaj | Ücretsiz deneyin |
| 9c | Diş hekimleri için | `/dis-hekimi-programi` | SEO + sektöre özel mesaj | Ücretsiz deneyin |
| 10 | KVKK aydınlatma metni | `/kvkk` | Yasal | İçeriği `hukuk-uyum` yazar |
| 11 | Gizlilik politikası | `/gizlilik` | Yasal | `hukuk-uyum` |
| 12 | Kullanım şartları | `/sartlar` | Yasal | `hukuk-uyum` |
| 13 | Çerez politikası | `/cerez` | Yasal | `hukuk-uyum` |

Ana gezinme (en çok beş bağlantı, tek eylem): **Özellikler · Fiyat · SSS · İletişim** + sağda metin bağlantısı **Giriş** + tek buton **Ücretsiz deneyin**. "Hakkımızda" ve sektör sayfaları footer'dadır.

Yardım merkezi (`/yardim`) bu sürümde yok; eski sitede ölü bağlantıydı. Açılana kadar hiçbir yerde bağlantı verilmez.

### Bağlantı hedef tablosu (ölü bağlantı yok)

| Etiket | Hedef | Not |
|---|---|---|
| Ücretsiz deneyin | `/signup` | Mevcut kayıt rotası; alan adı tek (bölüm 12 madde 1) |
| Giriş | `/login` | Mevcut rota |
| Demo isteyin | `/iletisim#demo` | Sayfa içi çıpa, form orada |
| E-posta (iletişim ve destek, tek adres) | `mailto:[DESTEK_E-POSTASI]` | `teknik-yazar` kararı: tek yer tutucu. Kurucu adresi ve alan adı sahipliğini belirler/doğrular. Aşağıda "e-posta adresi" geçen her yerde bu yer tutucu kullanılır; `beautyos.app` adresleri kullanılmaz |
| WhatsApp | **yok** (kurucu hat vermedi) | Hat gelirse `https://wa.me/90XXXXXXXXXX` eklenir; o zamana dek hiçbir yerde WhatsApp düğmesi çizilmez |
| Sosyal medya | **yok** | Hesaplar açılıp doğrulanana dek simge çizilmez |
| Yasal sayfalar | `/kvkk` `/gizlilik` `/sartlar` `/cerez` `/veri-isleme-sozlesmesi` (+ künye `/iletisim`) | **Bu sayfalar (Veri İşleme Sözleşmesi dahil) yazılıp yayınlanmadan site yayına çıkmaz.** `/signup` gerçek salona açılmadan önce kayıt ekranında şartlar + DPA kabul kutusu canlıda olmalı |

---

## 3. Ana sayfa (`/`)

### SEO

- **Title** (~46 krk): `BeautyOS: Salon ve Klinik Randevu Programı`
- **Meta description** (~125 krk): `Randevu, müşteri kartı, kasa ve personel takibi tek uygulamada. Telefondan yönetin, 30 gün ücretsiz deneyin.`
- **OG başlık:** `BeautyOS: işletmenizi telefondan yönetin`
- **OG açıklama:** `Salon ve klinikler için randevu, müşteri kartı, kasa ve personel takibi. 30 gün ücretsiz deneyin.`
- **OG görseli:** 1200×630, ana ekran görüntüsü (takvim, telefon çerçevesinde) + wordmark. Metin yok ya da yalnız wordmark. Tasarımcı üretir.
- **Canonical:** `https://beautyossapp.com/` [alan adı kararı bekler]
- **Yapısal veri:** `Organization` (ad, e-posta) + `SoftwareApplication` (kategori: BusinessApplication, fiyat alanı **yalnız fiyat kesinleşince**). Puan/yorum yapısal verisi **eklenmez** (gerçek yorum yok).

### Başlık hiyerarşisi

```
H1  İşletmenizi telefondan yönetin
  H2  Günün tüm işi tek ekranda
  H2  Telefonda çalışır
  H2  İşletmenizdeki her iş için
  H2  Kimler için
  H2  Nasıl başlarsınız
  H2  Fiyat
  H2  Yakında
  H2  Sık sorulanlar
  H2  Denemeye başlayın (kapanış)
```

### Bölüm A: Üst gezinme

Wordmark **BeautyOS** · Özellikler · Fiyat · SSS · İletişim · Giriş · [Ücretsiz deneyin]

Mobilde: wordmark + hamburger menü; "Ücretsiz deneyin" menü içinde ve ekranın alt kenarında yapışkan çubuk olarak (yalnız hero'dan sonra).

### Bölüm B: Hero

- **H1:** `İşletmenizi telefondan yönetin` (30 krk; 390 px'te iki satır sığar). Sektör (salon / klinik) belirleyici değil; alt metin ve sektör bağlantıları ayırır.
- **Alt metin:** `BeautyOS; salon ve klinikler için randevu, müşteri kartı, kasa ve personel takibini tek uygulamada toplar.`
- **Birincil CTA:** `Ücretsiz deneyin` → `/signup`
- **İkincil (metin bağlantısı):** `Demo isteyin` → `/iletisim#demo`
- **CTA altı küçük not:** `30 gün ücretsiz. Kart bilgisi istenmez.` (kod: deneme otomatik, ödeme altyapısı yok; **deneme sonrası koşul fiyat kararıyla birlikte netleşir, bu cümle yalnız doğru olduğu sürece**)
- **Görsel:** Telefon çerçevesinde **günlük takvim ekranı** (390 px, dolu gün: 6–8 randevu, 3 personel renkli) + yanında kesişen ikinci küçük ekran: **günün özeti (kasa)**. Gerçek prototip ekranı; sahte rakam değil, kendi içinde tutarlı örnek veri (brif: gerçekçi Türkçe isim, hizmet, ₺). Ekran görüntüsü altında alt yazı yok.
- **Hero'da olmayacaklar:** rozet şeritleri, "güveniyor" logosu, istatistik bandı, video düğmesi, yüzen kartlar.

### Bölüm C: Günün tüm işi tek ekranda (kanıt: takvim + kasa)

- **H2:** `Günün tüm işi tek ekranda`
- **Giriş (1 cümle):** `Kim hangi saatte nerede, kasada ne var, hangi müşteri bugün geliyor. Üç ayrı defter yerine bir ekran.`
- **Üç kısa kanıt satırı** (ikon yok, metin + her biri bir ekranın parçası):
  1. **Randevu takvimi.** `Personel bazında renkli takvim. Randevuyu açın, taşıyın, iptal edin.` (sürükle-bırak yalnız bilgisayar bağlamında ve ikincil anılır). Ekran: takvim.
  2. **Müşteri kartı.** `Geçmiş işlemler, notlar, fotoğraflar ve müşteri formu müşterinin kartında durur. Randevu açılınca karşınıza gelir.` Ekran: müşteri kartı (geçmiş + not).
  3. **Kasa.** `Gün sonunda kasa, gelir ve giderler tek tabloda.` Ekran: günün özeti.

### Hareketli sürüm metinleri (kurucu A1, pazarlama onayı: `inceleme-pazarlama.md` "Hareket")

- **Beyan (hero sonrası):** `Randevu defteri, kasa defteri, telefon rehberi. Üçünün yerine tek ekran.` (onaylı)
- **"Telefonda çalışır" hikâyesi, dört ekran** (örnek salon, kurgusal veri; "Tasarım önizlemesi" notu):
  1. **Randevu oluştur.** `Telefon çalar: “Bugün saat dörtte yeriniz var mı?” Müşteriyi bulun, hizmeti ve boş saati seçin.` (sayı yok)
  2. **Hatırlatma** `Yakında`. `Randevudan önce müşteriye kısa bir hatırlatma gider.` (etki iddiası yok; ekrandaki tarih/saat tutarlı)
  3. **Tamamla ve ödeme al.** `İş bitince tek ekranda: tutar hazır, nakit ya da kart, istenirse bahşiş. Prim kendiliğinden hesaplanır.`
  4. **Kasa** (gün sonu değil). `Akşam tahsilat, nakit, kart ve gider tek tabloda.` ("Günü kapat" düğmesi yok; gün sonu canlıya çıkınca adım "Gün sonu" olur.)
- **"Kimler için" sekmeleri:** terim uyarlaması vaadi yok ("Klinik terimleri yakında" rozetli); klinik sekmelerinde sınır cümlesi onaylı tam metin.

### Bölüm D: Telefonda çalışır

- **H2:** `Telefonda çalışır`
- **Metin:** `Uygulama mağazasından bir şey indirmenize gerek yok. Tarayıcıdan açın; randevu açmak, müşteriyi bulmak ve ödeme almak telefonda başparmakla yapılır. Tablet ve bilgisayarda da aynı hesapla çalışır.` [TEYİT: PWA/ana ekrana ekle yoksa yazılmaz]
- **Görsel:** 390 px'te üç ekran yan yana değil, **tek büyük telefon ekranı** (hızlı randevu açma akışı) + yan sütunda bilgisayar görünümü (1440 px takvim). Yalnız gerçek ekran.
- **İnternet notu:** `BeautyOS internet bağlantısıyla çalışır.` (dürüst; SSS'te de geçer)

### Bölüm E: İşletmenizdeki her iş için (modül özeti)

- **H2:** `İşletmenizdeki her iş için` (sürüm 3: klinik okuru da kapsasın)
- **Düzen notu (tasarımcıya):** altı eşit kart yerine, farklı ağırlıkta bir liste ya da alternatif satırlar; 3'lü kart ızgarası yok. Her satır: ad + bir cümle + (varsa) "Yakında" rozeti. Tam anlatım `/ozellikler` sayfasında; bu bölüm özet.

| Satır | Metin | Durum |
|---|---|---|
| Randevu | `Personel bazında renkli takvim.` | VAR |
| Müşteri kartı | `Geçmiş, notlar, öncesi/sonrası fotoğrafları ve müşteri formu.` | VAR |
| Paket ve seans | `Paket satın alan müşterinin kalan seansı kendiliğinden düşer.` [TEYİT] | VAR |
| Personel ve prim | `Yüzde, sabit ya da hizmet bazlı kural tanımlayın; personel ödemesi ve bahşiş dağıtımı hesaplanır.` | VAR |
| Kasa ve cari | `Gelir-gider, cari hesaplar ve tedarikçi bakiyeleri.` | VAR |
| Stok | `Ürün girişi, çıkışı ve düşük stok uyarısı. Alış faturasını kaydedince stok güncellenir.` [TEYİT] | VAR |
| Online randevu | `Müşterileriniz bağlantıdan kendi randevusunu alır.` | VAR (koşullu) → açılana dek YAKINDA |
| Bekleme listesi | `Boş yer açılınca bekleyen müşteriye haber verin.` | VAR |

### Bölüm F: Kimler için

- **H2:** `Kimler için`
- **Metin:** `BeautyOS randevuyla çalışan işletmeler için: kuaförler, berberler, güzellik merkezleri, tırnak ve kirpik stüdyoları, lazer ve epilasyon merkezleri, estetik klinikleri ve diş hekimleri.`
- (Eski "klinikler için henüz tasarlanmadı" cümlesi kurucu kararıyla kaldırıldı.)
- **Bağlantılar:** `Kuaförler için` · `Berberler için` · `Güzellik merkezleri için` · `Klinikler için` (metin bağlantısı)
- (Sektör ikonu ızgarası ve 11 sektörlük liste kalkar.)

### Bölüm G: Nasıl başlarsınız

- **H2:** `Nasıl başlarsınız`
- Dört madde (içeriğin sayısı kadar; üç değil), numara süs değil sıra anlamı taşır:
  1. **Kayıt olun.** `E-posta ve salon adıyla hesabınız açılır.`
  2. **Salonunuzu tanıtın.** `Çalışma saatleri, personel ve hizmetleri kurulum adımlarında girersiniz.` (ilk kurulum sihirbazı; `urun-analisti` adım sayısını teyit eder)
  3. **Müşterilerinizi ekleyin.** `Müşterilerinizi tek tek ekleyebilir ya da Excel listenizi gönderin, aktarmanıza ücretsiz yardım edelim.` (kurucu kararı V5)
  4. **İlk randevuyu açın.** `Takvimden saate dokunun, müşteriyi ve hizmeti seçin.`
- **Metin altı:** `Kurulum için eğitim gerekmez; takıldığınız yerde [DESTEK_E-POSTASI] adresine yazın.` [destek süresi/saatleri kurucu kararı; söz verilmez]
- **Görsel:** kurulum sihirbazının ilk adımı + boş takvim ekranı (boş durum ekranı gerçek ürün tasarımından).

### Bölüm H: Fiyat (özet; tam bölüm bölüm 6)

- **H2:** `Fiyat`
- Fiyat kartı bileşeni burada kısa gösterilir; ayrıntı `/fiyat` sayfasında. Rakam yer tutucu.

### Bölüm I: Yakında

- **H2:** `Yakında`
- **Giriş:** `Üzerinde çalıştığımız özellikler. Tarih vermiyoruz; hazır olunca burada ve hesabınızda duyururuz.`
- Liste (yalnız `urun-analisti` listesinde onaylananlar; geçici):
  - **Mesaj asistanı.** `Müşteriniz WhatsApp ya da Telegram'dan mesaj yazarak randevu alsın.`
  - **Depozito.** `Randevu için ön ödeme alarak boşa giden randevuları azaltın.`
  - **Personel görünümü.** `Her personel yalnız kendi gününü görür.` [tasarım kapsamında; teyit]
  - **Dışa aktarma aracı (Excel/CSV).** `Verilerinizi kendiniz indirin.` (şimdilik talep üzerine elle iletiyoruz)
- Her satırda soluk "Yakında" rozeti; bağlantı yok. "Haber verin" e-posta toplama formu **yok** (İYS/KVKK).

### Bölüm J: Sık sorulanlar (ana sayfada 5 soru; tamamı `/sss`)

Ana sayfada: Deneme nasıl işler? · Verilerim nerede? · Telefondan kullanılır mı? · e-Fatura keser mi? · İnternet kesilirse? Cevaplar bölüm 7'dekiyle birebir aynıdır. Altında: `Tüm soruları görün` (metin bağlantısı → `/sss`).

### Bölüm K: Kapanış CTA

- **H2:** `Denemeye başlayın`
- **Metin:** `Salonunuzu kurmak birkaç dakika sürer. İlk 30 gün ücretsiz.` [süre iddiası "birkaç dakika" kurulum sihirbazı ölçülünce kesinleşir; ölçülmeden "kısa sürer" yazılır]
- **Birincil:** `Ücretsiz deneyin` → `/signup`
- **İkincil (metin):** `Önce demo isteyin` → `/iletisim#demo`

### Bölüm L: Footer

Dört sütun değil, iki sade blok.

- **Sol:** wordmark **BeautyOS** · `Salon ve klinik yönetim uygulaması.` · `[DESTEK_E-POSTASI]` (`mailto:`)
- **Bağlantılar:** Özellikler · Fiyat · SSS · İletişim · Hakkımızda · Kuaförler için · Berberler için · Güzellik merkezleri için · Klinikler için
- **Yasal:** KVKK aydınlatma metni · Gizlilik politikası · Kullanım şartları · Çerez politikası · Veri İşleme Sözleşmesi (`/veri-isleme-sozlesmesi`) · Künye ve İletişim (`/iletisim`)
- **Alt satır:** `© 2026 [Unvan] · BeautyOS markası` + **satıcı kimliği** alanları: unvan, adres, e-posta, telefon, vergi dairesi + VKN (TC kimlik no yayımlanmaz), varsa MERSİS, sicil, KEP. Kurucu doldurur; boş bırakılırsa yayın yok. Alan listesi 6563 m.3'e göre avukatla teyit edilir (`hukuk-uyum`, sürüm 2).
- Sosyal simge yok (hesap yok). Alan adı tek yazım: BeautyOS (marka), `beautyossapp.com` (yalnız adres).

---

## 4. Özellikler (`/ozellikler`)

### SEO

- **Title** (56 krk): `Özellikler: Randevu, Müşteri Kartı, Kasa | BeautyOS`
- **Meta description** (~140 krk): `Personel takvimi, müşteri kartı, paket seansları, prim hesabı, kasa, cari ve stok. BeautyOS özellikleri ve yakında gelecekler.`
- **OG başlık:** `BeautyOS özellikleri`
- **OG açıklama:** `Randevudan kasaya, stoktan personel primine: salonunuzun günlük işi tek uygulamada.`

### Başlık hiyerarşisi

```
H1  Salonun günlük işi için neler var
  H2  Randevu
  H2  Müşteri kartı
  H2  Paket ve seans
  H2  Personel ve prim
  H2  Kasa ve cari
  H2  Stok
  H2  Online randevu              (koşullu / yakında rozeti)
  H2  Yakında
```

### İçerik

- **H1:** `Salonun günlük işi için neler var` (34 krk)
- **Alt metin:** `Her bölümde gerçek ekranı görürsünüz. Henüz hazır olmayanları ayrı işaretledik.`

Her modül bölümü: **H2 + 2–3 cümle + 3–4 somut madde + bir gerçek ekran görüntüsü**. Üç maddeli şablon zorunlu değil; içerik kaç tane ise o kadar.

**Randevu** (ekran: takvim, 390 ve 1440 px)
`Personelin gününü renklere ayrılmış tek takvimde görürsünüz. Randevuyu açmak için saate dokunmanız yeterli.`
- Personel bazında günlük ve haftalık görünüm [TEYİT hafta görünümü]
- Randevuyu taşıma ve iptal
- Bekleme listesi: boş yer açılınca bekleyen müşteriye haber verme

**Müşteri kartı** (ekran: müşteri detay, geçmiş sekmesi; fotoğraf sekmesi)
`Müşterinin geçmiş işlemleri, notları ve fotoğrafları kartında durur.`
- Geçmiş randevular ve harcama
- Öncesi/sonrası fotoğraf arşivi
- Müşteri formu (anamnez): hazır sorularla başlayın, kendi sorularınızı ekleyin [hazır şablon sayısı iddiası yok]
- Alerji ve özel notlar

> Sağlık bilgisi yazım kuralı (`hukuk-uyum`, sürüm 2): rol ayarı ve rıza akışı canlıya çıkana kadar müşteri formu için **gizlilik / erişim iddiası yazılmaz**; yalnız özellik anlatılır (bugün tüm roller formu görüyor). Rıza akışı çıkınca kullanılabilir: "Sağlık bilgisi kaydetmeden önce müşterinizden açık rızasını alır ve bunu kayıt altında tutarsınız; bu bilgiyi kimin göreceğini siz belirlersiniz." "KVKK uyumlu" yazılmaz. Sektör sayfalarında (özellikle lazer/epilasyon) anamnez öne çıkarılmaz.

**Paket ve seans** (ekran: paket satış + kalan seans)
`Seans paketi satın alan müşterinin kalan hakkını BeautyOS takip eder.`
- Paket tanımlama ve satış
- Her randevuda seans düşme
- Kalan seans müşteri kartında

**Personel ve prim** (ekran: prim kuralı ve personel ödemesi tablosu)
`Her personel için prim kuralı tanımlayın; ay sonunda personel ödemesi hesaplı gelir.`
- Yüzde, sabit ya da hizmet bazlı prim
- Bahşiş dağıtımı
- İzin ve mesai kaydı
- Personel ödemesi kaydı

**Kasa ve cari** (ekran: günün özeti; cari ekstre)
`Gün sonu kasa, gelir-gider ve cari hesaplar aynı yerde.`
- Gelir ve gider kaydı
- Tedarikçi cari hesabı ve bakiyesi
- Banka ve kasa arasında virman [TEYİT]
- Dışa aktarma (Excel/CSV): **Yakında** rozetiyle (şimdilik yok)

> Net sınır cümlesi (zorunlu): `BeautyOS e-Fatura ya da e-Arşiv fatura kesmez ve yazarkasa yerine geçmez. Alış faturalarınızı kayıt altına alır.` Bu cümle bu bölümün altında küçük ama okunur yazılır.

**Stok** (ekran: stok listesi + düşük stok uyarısı)
`Ürün girişi, çıkışı ve kalan miktar. Eşiğin altına düşen ürünü liste size gösterir.`
- Ürün ve tedarikçi kaydı
- Alış faturası girişi stoğu artırır [TEYİT]
- Hizmet başına malzeme tüketimi tanımlama
- Düşük stok listesi stok sayfasında görünür ("anında bildirim" yazılmaz, yok)

**Online randevu** (ekran: müşterinin randevu sayfası, 390 px)
- Ayar açık olduğunda: `Salonunuza özel bağlantı. Instagram biyografinize ya da QR koda koyun; müşteri uygun saati seçip randevusunu alır.`
- Ayar açılana kadar: aynı bölüm **"Yakında"** rozetiyle ve "Hazır olunca duyurulur" cümlesiyle; kimlik doğrulama/depozito iddiası yok.

**Yakında** (bölüm I ile aynı liste, daha ayrıntılı iki cümle; ana sayfada kısa)

**CTA (sayfa sonu):** `Ücretsiz deneyin` → `/signup`; metin bağlantısı `Demo isteyin` → `/iletisim#demo`.

---

## 5. Sektör sayfaları (SEO; kısa, 3 sayfa)

Her sayfa aynı iskelet: H1 + alt metin + 3 sektöre özel kanıt + ekran + CTA + SSS 3 soru. İçerik iddiası yalnız yukarıdaki VAR modüllerden gelir.

### 5.1 `/kuafor-programi`
- **Title:** `Kuaför Randevu Programı | BeautyOS` (36 krk)
- **Meta:** `Kuaför salonunuzda personel takvimi, müşteri kartı, prim ve kasa tek uygulamada. Telefondan yönetin, 30 gün ücretsiz deneyin.`
- **OG:** `Kuaförler için salon yönetimi` / `Randevu, müşteri geçmişi ve personel primi telefonunuzda.`
- **H1:** `Kuaför salonunuz için randevu programı` (38 krk, hero 36 px'e iner)
- **H2'ler:** `Her personelin takvimi ayrı` · `Müşterinin son boyası kartında` · `Ay sonunda prim hesabı hazır` · `Sık sorulanlar`
- Alt metin: `Kuaför salonunun günü saat saat ilerler. BeautyOS randevuyu, müşterinin geçmişini ve personelin primini aynı ekranda tutar.`
- Kanıtlar: renkli personel takvimi; müşteri kartında geçmiş işlem + not + fotoğraf; yüzde/sabit/hizmet bazlı prim. Ekranlar: takvim, müşteri kartı, prim.

### 5.2 `/berber-programi`
- **Title:** `Berber Randevu Programı | BeautyOS` (35 krk)
- **Meta:** `Berber dükkânınızda randevu, müşteri defteri ve günlük kasa telefonunuzda. 30 gün ücretsiz deneyin.`
- **OG:** `Berberler için randevu programı` / `Randevu defteri ve günlük kasa tek uygulamada.`
- **H1:** `Berber randevu programı` (23 krk)
- **H2'ler:** `Randevu defteri telefonda` · `Günlük kasa` · `Müşteriyi tanıyın` · `Sık sorulanlar`
- Alt metin: `Defter, hesap makinesi ve telefon rehberi yerine tek uygulama. Tek koltuktan başlayıp büyüyebilirsiniz.` [koltuk sınırı/paket tek koltuk fiyatı karar bekler; "tek koltuk" cümlesi fiyat kararıyla doğrulanır]
- Kanıtlar: hızlı randevu açma (3 dokunuş [ölç]), günün kasa özeti, müşteri kartı notu.
- Dürüstlük: segment doğrulaması yok; berber için ürünün fazla geniş olabileceği `is-gelistirme` riski; bu sayfa son sırada yayınlanır, tek koltuk fiyatı netleşmeden yayınlanmaz.

### 5.3 `/guzellik-merkezi-programi`
- **Title** (50 krk): `Güzellik Merkezi Programı | Randevu ve Seans | BeautyOS`  (uzun; alternatif 48 krk: `Güzellik Merkezi Programı: Randevu ve Seans | BeautyOS`)
- **Meta:** `Güzellik merkezinizde randevu, seans paketi, müşteri formu ve personel primi tek uygulamada. 30 gün ücretsiz deneyin.`
- **OG:** `Güzellik merkezleri için yönetim programı` / `Seans paketleri, müşteri formu ve randevu aynı yerde.`
- **H1:** `Güzellik merkezi için salon programı` (36 krk)
- **H2'ler:** `Seans paketleri kendiliğinden düşer` · `Müşteri formu ve fotoğraflar kartta` · `Prim ve bahşiş hesabı` · `Sık sorulanlar`
- Alt metin: `Paketli seanslar, müşteri kartı ve personel primi. Güzellik merkezinin işleyişine göre tasarlandı.`
- Kanıtlar: paket/seans takibi, öncesi/sonrası fotoğraf, prim ve bahşiş dağıtımı. Müşteri formu (anamnez) öne çıkarılmaz; hukuk-uyum notu. Oda/cihaz takvimi yok, yazılmaz.

### 5.4 Klinik sayfaları (kurucu kararı S1)

Üç sayfa: merkez `/klinik-programi`, `/estetik-klinik-programi`, `/dis-hekimi-programi`. Merkez sayfa klinik okuru ortak mesajla karşılar; ikisi sektöre özel kısa sayfadır (aynı iskelet, aynı ekranlar).

**Yazım kuralları (klinik metinleri için, `hukuk-uyum` kontrolünden geçmeden yayına girmez):**
- **Sağlık iddiası yok.** Tedavi, teşhis, iyileşme, sonuç, "hasta güvenliği", "hasta memnuniyeti artar", "tıbbi", "klinik olarak kanıtlanmış" gibi ifadeler geçmez. Ürün tıbbi cihaz ya da klinik karar aracı değildir; yalnız randevu, kayıt, kasa ve personel işini düzenler. Hedef kitle klinik yöneticisidir (B2B); hasta/müşteriye yönelik reklam metni yazılmaz.
- **Gizlilik / KVKK iddiası yok.** "KVKK uyumlu", "güvenli", "gizliliği korur" yazılmaz. Rol bazlı sağlık verisi erişimi (kurucu R9: resepsiyon anamnez ve fotoğrafı görmez) rol akışı canlıya çıkana kadar **Yakında**. Rıza cümlesi yalnız rıza akışı canlıya çıkınca (bölüm 4 notu).
- **Ürün dili uyarlaması** ("danışan" / "hasta", "klinik") canlıda yok, **Yakında** rozetli. `teknik-yazar` sözlüğü (metin-rehberi §2b): klinik sayfaları "Danışan / Klinik" kullanır, **"Hasta" kullanılmaz** (sağlık iddiası riski); sayfada tek terim, "müşteri/danışan" karışmaz. Ürün ekranı görseli bugünkü hâliyle ("müşteri") gösterilir ve "Yakında: terimleri kliniğinize göre ayarlayın" notu verilir. Sözlük çelişkisi: `teknik-yazar` sözlüğü "danışan / hasta" kaçınıyordu; S1 bunu klinik sayfalarında geçersiz kılıyor, terimi `teknik-yazar` ile eşleştirmeliyim (mesaj gönderildi).
- **Hasta verisi örnek ekranlarda yok:** örnek müşteri formu soruları genel (alerji, notlar), tanı/ilaç/hastalık içermez.
- **Meslek kuralları:** diş hekimi ve estetik klinikleri için reklam yasakları hasta/tüketiciye dönük reklamları kapsar; bu sayfa yazılımı klinik işletmesine anlatır. Yine de `hukuk-uyum` bu çerçeveyi teyit eder.

#### 5.4.1 `/klinik-programi` (merkez)
- **Title** (~41 krk): `Klinik Randevu Programı | BeautyOS`
- **Meta:** `Klinikte randevu, müşteri kartı, kasa ve personel takibi tek uygulamada. Telefondan yönetin, 30 gün ücretsiz deneyin.`
- **OG:** `Klinikler için randevu programı` / `Randevu, müşteri kartı ve kasa tek uygulamada.`
- **H1:** `Klinik randevu programı` (23 krk)
- **H2'ler:** `Doktor ve uzman bazında takvim` · `Müşteri kartı ve randevu geçmişi` · `Kasa ve personel ödemeleri` · `Yakında` · `Sık sorulanlar`
- **Alt metin:** `Randevuyla çalışan kliniğinizde takvim, kayıt, kasa ve personel işleri tek uygulamada. Telefondan yönetirsiniz.`
- **Kanıtlar (VAR):** personel/uzman bazlı renkli takvim; müşteri kartı (geçmiş randevular, notlar; fotoğraf klinik sayfalarında anılmaz); paket/seans takibi; kasa, cari, stok; personel primi ve ödemesi; bekleme listesi.
- **Yakında:** rol bazlı erişim (resepsiyon sağlık bilgisini görmez), hekim rolü, sağlık verisine erişimde iki adımlı doğrulama, hatırlatma mesajında işlem adının gösterilmemesi, ürün dilinin sektöre uyarlanması, SMS hatırlatma. Canlıya çıkınca güven öğesi olarak "var" yazılabilir.
- **Klinik modunda yazılmaz (hukuk-uyum):** "müşteri kazanın", "kampanya gönderin", kampanya SMS'i, online randevu sayfasında fiyat/indirim listesi, önce/sonra galerisi, fotoğrafların tanıtımda kullanımı. Bu özellikler klinik modunda varsayılan kapalıdır; sayfalar bunları öne çıkarmaz. Online randevu klinik sayfalarında anılmaz.
- **Yayın sırası:** klinik sayfaları son sırada; avukat görüşü (sağlık verisinin yurt içinde barındırılması gerekip gerekmediği, `hukuk-uyum` §10.9 madde 4) gelene kadar yayına girmez.
- **Ekranlar:** takvim (uzman bazlı), müşteri kartı (geçmiş + not; sağlık verisi içermeyen örnek), günün özeti.
- **CTA:** `Ücretsiz deneyin`; metin bağlantısı `Demo isteyin`.

#### 5.4.2 `/estetik-klinik-programi`
- **Title:** `Estetik Klinik Randevu Programı | BeautyOS` (~43 krk)
- **Meta:** `Estetik kliniğinizde randevu, seans paketleri, müşteri kartı ve kasa tek uygulamada. 30 gün ücretsiz deneyin.`
- **OG:** `Estetik klinikleri için randevu programı` / `Seans paketleri, müşteri kartı ve kasa aynı yerde.`
- **H1:** `Estetik klinik randevu programı` (31 krk)
- **H2'ler:** `Seans paketleri kendiliğinden düşer` · `Fotoğraf arşivi müşteri kartında` (dosya yükleme canlıya çıkana kadar Yakında rozetli) · `Uzman bazında prim ve ödeme` · `Sık sorulanlar`
- **Alt metin:** `Paketli seanslar, müşteri kartı ve uzman primi. Randevudan kasaya aynı uygulama.`
- Fotoğraf cümlesi yalnız arşiv işlevini anlatır; "önce / sonra", sonuç/etki iddiası ve tanıtımda kullanım ifadesi yok.

#### 5.4.3 `/dis-hekimi-programi`
- **Title:** `Diş Hekimi Randevu Programı | BeautyOS` (~38 krk)
- **Meta:** `Diş kliniğinizde hekim bazında randevu takvimi, müşteri kartı, kasa ve stok tek uygulamada. 30 gün ücretsiz deneyin.`
- **OG:** `Diş hekimleri için randevu programı` / `Hekim takvimi, kasa ve stok tek yerde.`
- **H1:** `Diş hekimi randevu programı` (27 krk)
- **H2'ler:** `Hekim bazında takvim` · `Geçmiş randevular` · `Kasa, cari ve stok` · `Sık sorulanlar`
- **Alt metin:** `Hekimlerinizin günü, danışanlarınızın randevu geçmişi ve kasanız tek uygulamada.` (panel ekran görüntüsünde panel terimi "Müşteri" görünür, metin onu gizlemez)
- Diş hekimliğine özel işlev iddiası yok (diş şeması, tedavi planı, radyoloji entegrasyonu **YOK**). Bu eksiklik sayfada dürüstçe, tek cümleyle: `BeautyOS bir muayene ya da tedavi kayıt programı değildir; e-Nabız bildirimleri ve yasal tıbbi kayıt yükümlülükleriniz için kullandığınız sistemin yerine geçmez. Randevu, kasa ve işletme işlerini düzenler.` (`hukuk-uyum` ifadesi.) Sitede, kurulumdaki bilgi ekranında ve klinik sayfalarında **tek bir metin** kullanılır (hukuk-uyum). Bu cümle üç klinik sayfasında da **okunur büyüklükte** yer alır, dipnot boyutunda değil. Klinik sayfalarında "kayıt" kelimesi "tıbbi kayıt" okunacağı için müşteri kartı / randevu geçmişi denir.

**Önemli ürün riski (`urun-analisti`'ye iletildi):** diş ve estetik klinikleri çoğunlukla tedavi/muayene kaydı, e-Nabız/SGK/MEDULA entegrasyonu, diş şeması ister; BeautyOS'ta bunlar yok. Klinik sayfaları yalnız "randevu + kasa + personel" talebine hitap eder. Bu sınır cümlesi pazarlama gerçeğidir ve silinmez.

**Kapsam dışı (urun-analisti, "yakında" da yazılmaz):** muayene/tedavi notu, diş şeması, reçete, dosya/röntgen ekleme, e-Nabız / MEDULA / SGK. Sayfalarda yalnız sınır cümlesiyle anılır. "Ürün dili uyarlaması" yalnız "Yakında" rozetiyle yazılır, "sektörünüze göre dil" gibi mevcut ifade kullanılmaz (uygulama tasarım onayından sonraki kodlama aşamasında).

#### Berber sayfası kararı (kurucu S1 çerçevesinde; `urun-analisti` ile)
Geçici karar: `/berber-programi` **kalır** (SEO değeri var, berber de randevuyla çalışır; kapsam daraltılmadı). Koşul: tek koltuk fiyatı netleşmeden yayına girmez; berber için ürün geniş kalıyorsa sayfa "kuaför ve berber" tek sayfada birleştirilir (alternatif `/kuafor-ve-berber-programi`). **KESİNLEŞTİ:** `urun-analisti` ayrı berber sayfasını önerdi (roller-ve-akislar.md 8.3); sayfa kalır, tek koltuk fiyatı koşulu geçerli. `urun-analisti` ayrıca klinik sınırını doğruladı: bugün tıbbi kayıt, reçete, MEDULA/sigorta, diş şeması yok; kayıtta klinik türü seçilemiyor; hasta/hekim/tedavi terimleri ekranlarda yok; rol bazlı sağlık verisi erişimi ve rıza kapısı yapılınca "var" denir. Bu yüzden klinik sayfaları bu sınırla yazıldı.

---

## 6. Fiyat (`/fiyat`) ve ana sayfa fiyat bileşeni

**Durum:** Kurucu fiyat kararı vermedi. Bölüm tasarlanır, rakamlar yer tutucu kalır. Aşağıdaki köşeli parantezli her değer kurucu/finans kararıdır. Sahte kıtlık, sayaç, "ömür boyu", "son X kişi" yok.

### SEO

- **Title** (33 krk): `Fiyat | BeautyOS Salon Programı`
- **Meta:** `BeautyOS fiyatı ve 30 günlük ücretsiz deneme. Neyin pakete dahil olduğunu ve neyin ayrıca ücretlendirildiğini açıkça yazıyoruz.`
- **OG:** `BeautyOS fiyatı` / `Açık fiyat, 30 gün ücretsiz deneme.`

### Başlık hiyerarşisi

```
H1  Fiyat
  H2  Neler dahil
  H2  Ayrıca ücretlendirilenler
  H2  Fiyat hakkında sorular
```

### İçerik

- **H1:** `Fiyat`
- **Alt metin:** `Önce 30 gün ücretsiz deneyin. Neyin pakete dahil olduğunu, neyin ayrı ücretlendirildiğini burada açıkça yazıyoruz.`

**Paket kartı bileşeni (1 ile 3 kart arasında esner; tasarımcı hem tek hem çoklu düzeni çizer):**

| Alan | Metin |
|---|---|
| Paket adı | `[PAKET ADI]` (öneri taslağı: Başlangıç / Pro; karar `is-gelistirme` + `finans`) |
| Fiyat | `₺[AYLIK FİYAT]` `/ay` + `KDV hariç` (KDV ibaresi zorunlu, yan yana ve okunur) |
| Yıllık seçenek | `[YILLIK FİYAT / indirim]` (kurucu karar verirse; yoksa satır çizilmez) |
| Birincil CTA | `Ücretsiz deneyin` → `/signup` |
| Dahil olanlar | Yalnız VAR modüller: randevu, müşteri kartı, paket ve seans, personel ve prim, kasa ve cari, stok. Personel/randevu sayısı: **"sınırsız" yazılır yalnız finans/urun-analisti teyit ederse**; aksi halde `[LİMİT]` |
| Çok şubeli | Kart yerine tek satır: `Birden fazla şubeniz mi var? Bize yazın.` → `/iletisim#demo` |

**Ayrıca ücretlendirilenler** (finans kararı; SMS maliyeti kotasız verilemez):
- `SMS hatırlatmaları: [KULLANIMA GÖRE / AYLIK KOTA DAHİL, AŞIMDA ÜCRET]`
- `Yakında gelecek özellikler (ör. WhatsApp randevu): ayrı ücretlendirilebilir.` (yalnız karar verildiyse; yoksa satır çizilmez)

**Deneme açıklaması (zorunlu, açık):**
- `30 gün boyunca tüm özellikleri deneyebilirsiniz. Kart bilgisi istenmez.`
- `Deneme bittiğinde hesabınız durdurulur. Verileriniz 30 gün saklanır; bu sürede aboneliğe geçebilir ya da verilerinizi talep edebilirsiniz. Süre sonunda kalıcı olarak silinir. Devam etmek için bizimle iletişime geçersiniz. [ÖDEME YÖNTEMİ: havale/EFT, fatura düzeni finans kararı]` (kurucu kararı V1: 30 gün; Kullanım Şartları'na da yazılır)

**Fiyat sözü (varsayılan KAPALI; kurucu kararı V2):** `İlk 12 ay fiyat sabit` ifadesi yalnız fiyat kesinleşip kurucu açarsa eklenir; `finans` ve `hukuk-uyum` yazılı şartı (kime, koşul) belirler ve ilgili şart kullanım şartlarında yer alır. "Ömür boyu", "kurucu üye", kontenjan, sayaç hiçbir koşulda yok.

**Fiyat hakkında sorular** (3 soru; cevaplar bölüm 7 ile aynı):
1. Deneme nasıl işler?
2. Taahhüt var mı? → `Taahhüt yok. Hangi paketten devam edeceğinizi deneme sonunda siz seçersiniz.` [ödeme/iptal akışı finans kararına bağlı; teyitsiz yayına girmez]
3. KDV dahil mi? → `Fiyatlara KDV dahil değildir.` 

**Rakip karşılaştırma tablosu: yok** (doğrulanmış fiyat/özellik verisi yok; karalayıcı ifade riski).

**Tasarım notu:** rakamlar `tabular-nums`; yer tutucu değerler prototipte `₺XXX` değil, **net bir yer tutucu etiketle** (ör. gri "Fiyat kararı bekleniyor" kutusu) gösterilir ki hiçbir ekran görüntüsü gerçek fiyat izlenimi vermesin. Prototipte örnek rakam göstermek gerekirse "ÖRNEK" damgası taşır; onaylı site metninde bulunmaz.

---

## 7. Sık sorulan sorular (`/sss`)

### SEO

- **Title** (40 krk): `Sık Sorulan Sorular | BeautyOS`
- **Meta:** `BeautyOS deneme süresi, veri güvenliği, telefondan kullanım, e-Fatura ve yakında gelecek özellikler hakkında yanıtlar.`
- **OG:** `BeautyOS hakkında sık sorulanlar` / `Deneme, veri, telefon ve fatura soruları.`
- **Yapısal veri:** `FAQPage` JSON-LD (sorular + aşağıdaki cevaplar birebir).

### Başlık hiyerarşisi

```
H1  Sık sorulan sorular
  H2  Başlangıç
  H2  Veri ve güvenlik
  H2  Kullanım
  H2  Fatura ve muhasebe
  H2  Yakında gelecekler
  (her soru H3; accordion düğmesi, içerik DOM'da)
```

**H1:** `Sık sorulan sorular` · **Alt metin:** `Aradığınız cevabı bulamazsanız [DESTEK_E-POSTASI] adresine yazın.` (`mailto:`)

**Başlangıç**

- **Deneme nasıl işler?** `Kayıt olunca 30 günlük deneme kendiliğinden başlar. Kart bilgisi istenmez. Süre bittiğinde hesabınıza erişim durur; devam etmek için bizimle iletişime geçersiniz.`
- **Taahhüt var mı?** `Deneme için taahhüt yoktur. Devam koşulları fiyat sayfasında yazar.` [fiyat kararıyla güncellenir]
- **Hangi işletmeler için uygun?** `Randevuyla çalışan işletmeler için: kuaför, berber, güzellik merkezi, tırnak ve kirpik stüdyosu, lazer ve epilasyon merkezi, estetik kliniği ve diş hekimi.`
- **Klinikler için sağlık bilgisi nasıl korunuyor?** `Sağlık bilgilerine yalnız yetki verdiğiniz hekim ve personel erişir. Erişimler kayıt altına alınır ve iki adımlı doğrulama istenir.` [yalnız rol ayarı, erişim kaydı ve 2FA canlıya çıkınca (hukuk-uyum §10.6); o güne kadar bu soru yayında olmaz. Klinikte tedavi amaçlı sağlık verisi için "rıza alırsınız" cümlesi kullanılmaz, m.6/3 avukatla teyit]
- **Salonlar için sağlık bilgisi:** rıza cümlesi (bölüm 4 notu) yalnız salon / güzellik merkezi sayfalarında ve rıza akışı canlıya çıkınca geçerli.
- **Kurulum ne kadar sürer?** `Hesap açtıktan sonra salonunuzu, personelinizi ve hizmetlerinizi kurulum adımlarında girersiniz. Süre işletmenizin büyüklüğüne bağlıdır.` (ölçülmeden süre vaat edilmez)
- **Mevcut müşteri listemi aktarabilir miyim?** `Evet. Müşteri listenizi Excel olarak bize gönderin, aktarmanıza ücretsiz yardım edelim. Kendiniz toplu aktarma aracı yakında.` (kurucu kararı V5; yalnız "ücretsiz yardım" var, araç yok)

**Veri ve güvenlik**

- **Verilerim nerede tutuluyor?** `Salonunuzun ana veritabanı Almanya'da (Frankfurt) bulunan sunucularda tutulur. Bağlantılar TLS ile şifrelenir. E-posta gönderimi ve hata izleme gibi işler için çalıştığımız hizmet sağlayıcıların listesi Veri İşleme Sözleşmesi'nde yer alır.` (`hukuk-uyum` ifadesi; "yedekler şifreli" cümlesi `devops` teyidiyle eklenir; yedeklerin AB'de olduğu teyitsiz yazılmaz; "KVKK uyumlu", "uçtan uca", "AWS" yok)
- **Verilerimi kimler görebilir?** `Salonunuzun verilerine yalnız sizin tanımladığınız kullanıcılar erişir. Kullanıcıların yetkileri unvanlarına göre belirlenir. BeautyOS ekibi verilerinize yalnız destek ve bakım için, Veri İşleme Sözleşmesi'ndeki kurallar çerçevesinde erişebilir.` [TEYİT: rol bazlı yetki canlıda mı; değilse ilk iki cümle yazılmaz, yalnız üçüncü cümle kalır]
- **Verilerimi dışa aktarabilir miyim?** `Dışa aktarma aracı yakında. O zamana kadar talep ederseniz verilerinizi size iletiriz.` (kurucu kararı V4)
- **Hesabımı kapatırsam verilerime ne olur?** `Hesabınız kapandıktan sonra verileriniz 30 gün saklanır; bu sürede talep edebilirsiniz. Süre sonunda kalıcı olarak silinir.` (kurucu kararı V1; hukuk-uyum son ifade)
- **Klinik sayfalarına özel SSS ek sorusu:** **Tıbbi kayıtlarımın saklanması kimin sorumluluğunda?** `Tıbbi kayıtları yasal süre boyunca saklama yükümlülüğü kliniğinize aittir.` (hukuk-uyum)
- **Kişisel veriler nasıl işleniyor?** `Ayrıntı için KVKK aydınlatma metnine ve gizlilik politikasına bakın.` → `/kvkk`, `/gizlilik`

**Kullanım**

- **Telefondan kullanılır mı?** `Evet. BeautyOS tarayıcıdan açılır; telefonda başparmakla kullanılacak şekilde tasarlandı. Tablet ve bilgisayarda da aynı hesapla çalışır. Mağazadan uygulama indirmeniz gerekmez.` [TEYİT: PWA yok]
- **İnternet kesilirse ne olur?** `BeautyOS internet bağlantısıyla çalışır; bağlantı yokken yeni kayıt açamazsınız. Bağlantı gelince kaldığınız yerden devam edersiniz.`
- **Personelim neleri görebilir?** [TEYİT: yetki durumu; doğrulanırsa] `Her personele unvanına göre yetki verirsiniz. Personel görünümü yakında: personel yalnız kendi gününü görür.`
- **Müşterilerim online randevu alabilir mi?** (koşullu) Açıksa: `Evet. Salonunuza özel bir randevu bağlantısı alırsınız; müşteri uygun saati seçer.` Kapalıysa: `Bu özellik yakında. Hazır olunca duyuracağız.`
- **Randevu hatırlatması gider mi?** `Henüz değil. SMS ile otomatik hatırlatma yakında.` (SMS açılınca: `Müşterilerinize SMS ile hatırlatma gönderilir. SMS kullanımı fiyat sayfasındaki koşullara göre ücretlendirilir.`)

**Fatura ve muhasebe**

- **BeautyOS e-Fatura keser mi?** `Hayır. BeautyOS e-Fatura ya da e-Arşiv fatura kesmez ve yazarkasa yerine geçmez. Aldığınız alış faturalarını kaydeder, kasa ve cari hesaplarınızı tutar.`
- **Muhasebecim raporları kullanabilir mi?** `Excel ve CSV dışa aktarma henüz yok, yakında. O zamana kadar kasa ve cari ekranlarını muhasebecinizle birlikte görebilirsiniz.`

**Yakında gelecekler**

- **Mesaj asistanı var mı (WhatsApp ya da Telegram ile randevu)?** `Henüz değil. Üzerinde çalışıyoruz; hazır olunca burada duyururuz.`
- **Depozito alabilir miyim?** `Henüz değil. Yol haritamızda.`

---

## 8. İletişim (`/iletisim`)

### SEO

- **Title** (30 krk): `İletişim | BeautyOS`
- **Meta:** `BeautyOS ile iletişime geçin ya da demo isteyin. Çok şubeli işletmeler ve sorularınız için bize yazın.`
- **OG:** `BeautyOS ile iletişime geçin` / `Demo isteyin ya da sorunuzu yazın.`

### Başlık hiyerarşisi

```
H1  İletişim
  H2  Demo isteyin        (id="demo")
  H2  Doğrudan yazın
```

### İçerik

- **H1:** `İletişim`
- **Alt metin:** `Demo, çok şubeli kullanım ya da herhangi bir soru için bize yazın. Bir iş günü içinde dönmeyi hedefliyoruz.` [yanıt süresi kurucu kabulü; kabul edilmezse "En kısa sürede döneriz."]

**H2 Demo isteyin**
- Metin: `Ekranları sizinle birlikte gezelim. Salonunuzu ve ihtiyacınızı kısaca yazın.`
- **Form** (backend yoksa tasarımcı formu `mailto:` yedeğiyle çizer; form çalışmadan yayın yok). Alanlar:
  - `Adınız` (zorunlu)
  - `Telefon` (telefon ya da e-postadan biri zorunlu, ikisi birden değil; "WhatsApp ile dönüş" açıklaması yok)
  - `E-posta` (isteğe bağlı)
  - `Salon adı` (isteğe bağlı)
  - `Kaç koltuk / personel?` (seçim)
  - `Notunuz` (isteğe bağlı)
- **Onay metni (zorunlu, form altında, ticari ileti onayı DEĞİL):** `Bilgileriniz yalnız talebinize dönmek için kullanılır. Ayrıntı: KVKK aydınlatma metni.` (`/kvkk` bağlantısı). **Ticari ileti onay kutusu yok**, kampanya e-postası toplanmaz (İYS). Önceden işaretli kutu yok.
- Gönder düğmesi: `Talebi gönder`
- Başarı: `Talebiniz bize ulaştı. En kısa sürede size dönüyoruz.`
- Hata: `Gönderemedik. Lütfen [DESTEK_E-POSTASI] adresine yazın.` (`mailto:`)
- **Form arka ucu ve talep nereye düşer:** `frontend-gelistirici`/`gelistirici` işi; talepler kurucuya e-postayla düşer. Önce `mailto:` yeterli.

**H2 Doğrudan yazın**
- `Sorular ve destek: [DESTEK_E-POSTASI]` (tek adres)
- (WhatsApp ve telefon: kurucu hat verirse eklenir; şimdilik çizilmez.)
- **Satıcı kimliği:** unvan, VKN, adres (footer ile aynı alanlar).

---

## 9. Hakkımızda (`/hakkimizda`)

### SEO

- **Title:** `Hakkımızda | BeautyOS` (22 krk)
- **Meta:** `BeautyOS'u kim geliştiriyor? Salon işletmeleri için yazılım geliştiren küçük bir ekibin kısa hikâyesi.` [içerik kurucu girdisine bağlı]
- **OG:** `BeautyOS'u kim geliştiriyor` / `Salonlar için, salonlarla birlikte geliştirilen yazılım.` [yalnız doğruysa]

### Başlık hiyerarşisi

```
H1  BeautyOS'u biz geliştiriyoruz
  H2  Neden yaptık
  H2  Nasıl çalışıyoruz
  H2  Bize ulaşın
```

### İçerik (kurucu doğrulamadan yayınlanmaz)

- **H1:** `BeautyOS'u biz geliştiriyoruz`
- **Neden yaptık:** `[KURUCU HİKÂYESİ: 3–4 gerçek cümle. Nasıl başladı, neden salonlar. Rakam, kullanıcı sayısı, "yüzlerce salon" gibi iddia yok.]` (pazarlama kurucudan alınacak kısa notla yazar; kurucu notu gelmeden uydurulmaz)
- **Nasıl çalışıyoruz:** `Ürünü küçük bir ekiple geliştiriyor, geri bildirimi doğrudan okuyoruz.` [yalnız doğruysa; kurucu onaylar] + `Sorularınıza geliştiren kişi yanıt verir.` [destek modeli kurucu kararı]
- **Pilot salonlar:** Gerçek pilot salon ve **yazılı izin** olana kadar müşteri adı, logosu, alıntısı yoktur. "Pilot programa katılın" çerçevesi isteğe bağlı: `Yeni açılan bir ürünüz. Geri bildirimleriyle ürünü şekillendirecek ilk salonlarla çalışmak istiyoruz.` (dürüst, kontenjansız, sayaçsız)
- **Bize ulaşın:** satıcı kimliği + e-posta.

---

## 10. Gösterilecek ekranlar (hangi bölümde ne)

Brif madde 14: gerçek ürün ekran görüntüleri, yeni tasarımın kendi ekranlarından. Tasarımcı prototipten üretir; `frontend-gelistirici` ekran görüntüleri klasörüne alır (`docs/tasarim-girdisi/ekran-goruntuleri/`).

| Bölüm | Ekran | Çözünürlük | Örnek veri (tutarlı, gerçekçi Türkçe) |
|---|---|---|---|
| Ana sayfa hero | Günlük takvim (mobil) + gün özeti (mobil) | 390 | Dolu gün, 3 personel, 6–8 randevu, Türkçe isimler, ₺ tutarlar |
| Ana sayfa C (takvim) | Takvim, personel renkleri | 390 + 1440 | Hero ile aynı salon ve gün |
| Ana sayfa C (müşteri) | Müşteri kartı: geçmiş + not (+ fotoğraf sekmesi) | 390 | Aynı müşteri, hero'daki randevudan biri |
| Ana sayfa C (kasa) | Günün özeti (gelir-gider) | 390 | Toplam hero'daki tutarlarla aynı |
| Ana sayfa D | Hızlı randevu açma akışı (tek ekran) + masaüstü takvim | 390, 1440 | Aynı salon |
| Ana sayfa G | Kurulum sihirbazı 1. adım + boş takvim durumu | 390 | — |
| `/ozellikler` Randevu | Takvim, randevu detay sayfası | 390, 1440 | — |
| `/ozellikler` Müşteri kartı | Müşteri detay + fotoğraf + form | 390 | Müşteri formunda **kişisel sağlık verisi görünmeyen** örnek sorular |
| `/ozellikler` Paket ve seans | Paket detay, kalan seans | 390 | — |
| `/ozellikler` Personel ve prim | Prim kural ekranı + personel ödemeleri tablosu | 390, 1440 | Tutarlar `tabular-nums` |
| `/ozellikler` Kasa ve cari | Günün özeti, cari ekstre | 390, 1440 | — |
| `/ozellikler` Stok | Stok listesi + düşük stok uyarısı | 390 | — |
| `/ozellikler` Online randevu | Müşterinin randevu sayfası | 390 | Salon markası tutarlı |
| `/kuafor-programi` | Takvim, müşteri kartı, prim | 390 | Kuaför hizmetleri (kesim, boya, fön) |
| `/berber-programi` | Hızlı randevu, günün kasası | 390 | Berber hizmetleri (saç, sakal) |
| `/klinik-programi`, `/estetik-klinik-programi`, `/dis-hekimi-programi` | Uzman/hekim bazlı takvim, müşteri kartı (sağlık verisi içermeyen örnek), günün özeti | 390 | Kurgusal klinik adı (gerçek işletme değil); ekranda tanı/ilaç/tedavi yok; hizmet adları genel ("kontrol", "bakım seansı") |
| `/guzellik-merkezi-programi` | Paket/seans, müşteri kartı, prim | 390 | Güzellik hizmetleri (cilt bakımı, lazer, kirpik) |
| OG görseli | Takvim telefon çerçevesinde | 1200×630 | — |

Kurallar:
- **Aynı kurgusal salon** tüm ekranlarda (ad, personel, müşteriler, tutarlar) tutarlı kalır. Salon adı **kurgusal ve gerçek bir işletme adı değildir** (kontrol: arama).
- Ekranlarda uydurma başarı rakamı yok; "bugünün cirosu ₺X" gibi örnek veri olur, "%40 artış" gibi iddia olmaz.
- Görsel altına **alt metin** (`alt`) zorunlu, ör. "BeautyOS takvim ekranı: üç personelin günlük randevuları".
- Stok görsel (fotoğraf) kullanılmaz; ekran dışı görsel gerekirse yalnız marka renkli düz zemin.
- Ekran görüntüsü üzerindeki Türkçe karakterler (ı, İ, ğ, ş, ç, ö, ü) eksiksiz.

## 11. Ton ve metin kuralları (teknik-yazar ile uyum)

`teknik-yazar` `docs/tasarim-girdisi/metin-rehberi.md` yazıyor; çelişki olursa o rehber geçer, farkı bu dosyaya işlerim. Şu an uyguladığım ilkeler:

1. "Siz" hitabı; "biz" yalnız şirket olarak ("geliştiriyoruz").
2. Cümle düzeni: kısa, etken, somut isim. "Çözüm", "platform", "ekosistem", "yenilikçi", "dijital dönüşüm" yok.
3. Başlıklar cümle düzeninde (yalnız ilk harf büyük), sonda nokta yok, ≤ 2 satır (390 px'te ~32 krk bütçesi).
4. Sözlük (`metin-rehberi.md` §2) bağlayıcı: **Randevu** (rezervasyon değil), **Online randevu** / **Online randevu sayfası** (çevrim içi değil), **Müşteri** (danışan değil), **Personel** (randevu seçiminde **Uzman**), **Prim** (komisyon değil), **Personel ödemesi** (hakediş değil), **Kasa**, **Hesaplar**, **Cari hesap**, **Alış faturası**, **Stok**, **Paket** / **seans**, **Müşteri formu** (anamnez yazılmaz; yalnız arama etiketi gerekirse parantezde bir kez), **Mesaj asistanı** (bot değil), **Deneme süresi**, **Plan**, **Bugün** (ana ekran), **Sık sorulan sorular**. Başlıklar cümle düzeni, "&" yerine "ve". "Yakında" rozeti tek biçim: metin **Yakında**. Destek adresi tek yer tutucu: **[DESTEK_E-POSTASI]**.
5. Düğme adları: birincil her yerde **"Ücretsiz deneyin"**; ikincil **"Demo isteyin"**; ok işareti süsü yok.
6. Sayı + birim arasında bölünemeyen boşluk (`30&nbsp;gün`, `₺&nbsp;…`).
7. Yasak kelimeler: abartı, üstünlük ("en iyi", "bir numara"), "kolayca", "anında", "akıllı", "sınırsız", "yapay zekâ" (kanıtlanana dek).
8. "arttırılarak" gibi yazım hataları yok ("artırarak"), "ve diğer" yığınları yok.
9. Tire (—) süsü yok; yerine nokta.
10. Rakip adı geçmez.

## 12. Açık kararlar ve teyit listesi (müdür / kurucuya)

| # | Konu | Kimde | Etki |
|---|---|---|---|
| 1 | **Alan adı tek yazım:** `beautyossapp.com` mi? Tek destek adresi [DESTEK_E-POSTASI] ve posta kutusu çalışıyor mu? | Kurucu | Tüm `mailto:` hedefleri; canonical |
| 2 | **Fiyat rakamları ve paket yapısı** (tek/çok paket, yıllık, SMS kotası, çok şube) | Kurucu + `finans` + `is-gelistirme` | Bölüm 6 |
| 3 | **Fiyat kilidi** (12 ay) ve ödeme yöntemi (havale/EFT, fatura) | Kurucu + `finans` + `hukuk-uyum` | Bölüm 6, SSS |
| 4 | **Satıcı kimliği** (unvan, VKN, adres) | Kurucu | Footer, iletişim, hakkımızda |
| 5 | **WhatsApp hattı** var mı? Sosyal hesaplar? | Kurucu | Çizilmez, gelirse eklenir |
| 6 | **Yasal sayfalar** (KVKK, gizlilik, şartlar, çerez) | `hukuk-uyum` | Yayın ön koşulu |
| 7 | **Online randevu** canlıda açılacak mı (bot koruması anahtarı)? | Kurucu + `devops` | Bölüm 4 ve SSS "var/yakında" |
| 8 | **SMS hatırlatma** canlıda açık mı, kota? | Kurucu + `finans` | SSS, fiyat |
| 9 | **Rol bazlı yetki / personel görünümü** teslim zamanı ve tanımı | `urun-analisti` | SSS, "Yakında" listesi |
| 10 | **Veri aktarım yardımı** (liste aktarma) kurucu kabulü | Kurucu | Bölüm G, SSS |
| 11 | **Hakkımızda hikâyesi** | Kurucu | Bölüm 9 |
| 12 | **Pilot salon alıntısı/logosu**: yazılı izin yok; sitede yok | Kurucu | Kanıt bölümü yok, uydurma yok |
| 13 | **Analitik**: bu sürümde yok. Eklenirse çerezsiz araç; çerez bandı kararı `hukuk-uyum` | `hukuk-uyum` | Çerez politikası |
| 14 | **Berber sayfası:** geçici karar "kalır, tek koltuk fiyatı netleşmeden yayın yok"; `urun-analisti` + `is-gelistirme` onayı | `urun-analisti` | Bölüm 5.4 sonu |
| 16 | **Klinik sayfaları** `hukuk-uyum` kontrolü (sağlık iddiası, meslek reklam kuralı); ürün sınırı cümlesi (muayene/tedavi kaydı değildir) | `hukuk-uyum` + `urun-analisti` | Bölüm 5.4 |
| 17 | **Ürün dili uyarlaması** ("danışan/hasta") ve sözlük çelişkisi | `teknik-yazar` + `ui-ux-tasarimci` | Klinik sayfaları |
| — | Çözüldü (kurucu 2. tur): saklama süresi 30 gün (V1), fiyat sözü "ilk 12 ay fiyat sabit" varsayılan kapalı (V2), veri talebi elle (V4), kayıt aktarımına ücretsiz yardım (V5); künye, destek e-postası, WhatsApp/sosyal, hakkımızda yer tutucu olarak kalır | — | — |
| 15 | **Yanıt süresi** iddiası ("bir iş günü") | Kurucu | İletişim |

## 13. Kontrol listesi (bu dosyanın durumu)

- [x] Brif madde 15 yasak ifadelerin hiçbiri metinde yok
- [x] "Yakında" dürüstçe etiketli, tarih/sayaç/kontenjan yok
- [x] Her bağlantı hedefi gerçek (rota ya da `mailto:`); WhatsApp/sosyal yokken çizilmez
- [x] Fiyat rakamı yer tutucu; "ömür boyu" ve kıtlık yok
- [x] Her sayfa için title, meta description, OG, başlık hiyerarşisi
- [x] Ekran görüntüsü planı bölüm bazında
- [ ] `urun-analisti` var/yakında listesi ile eşleme (bekliyor)
- [ ] `hukuk-uyum` ifade kontrolü (bekliyor)
- [ ] `teknik-yazar` ton uyumu (bekliyor)
- [ ] Kurucu kararları (bölüm 12)
- [ ] Yayın öncesi `giden-mesaj-onayi` (kurucu onayı): site yayına girmez, bu dosya taslaktır
