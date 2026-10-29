# BeautyOS tasarım incelemesi — teknik-yazar (metin)

- **Tarih:** 2026-10-28 · **İncelenen:** `docs/tasarim.md` (sürüm 0.9) ve `docs/tasarim/prototip/*.js|html` · **Ölçüt:** `metin-rehberi.md`
- **Yöntem:** statik tarama (Grep/Read). Tarayıcıda açıp gezmedim; yalnız kaynaktaki sabit metinlere baktım. Aşağıda "doğrulanmadı" denenler dışında satır/dosya kanıtlıdır.
- **Genel:** Tasarımın metin dili iyi: sözlük büyük ölçüde uygulanmış, eylem adları fiil+nesne, `…` doğru kullanılmış, emoji/İngilizce yok, "Tamam/Evet" yok (tek istisna aşağıda #8), hata kalıbı ("Bağlantınızı kontrol edip tekrar deneyin"), ₺ kuralları belgelenmiş. Aşağıdakiler kalan boşluklar.
- **Rehber düzeltmesi (ben):** "₺ sonda" yanlıştı; Intl tr-TR çıktısı `₺1.250,00` (başta). Rehber §5 düzeltildi. Ayrıca rehbere kişi kartı/boş durum/izin ayrımı satırları, "Davet gönder", "Tamamla ve ödeme al" eklendi.

## Bulgular

| # | Önem | Konu | Kanıt | Öneri |
|---|---|---|---|---|
| 1 | Yüksek | **Terim seti çoğu metne uygulanmamış.** `P.T()` yalnız 9 yerde var, "müşteri" sabit yazılan yer 76. Klinik modunda "Müşteri eklendi.", "Müşteri silindi.", "Müşteriye haber verildi.", "Müşteri adını yazın.", "Önce müşteri seçin." çıkar; oysa menü "Hastalar" der | `prototip.js:18-22` (set tanımı), `panel.js:385,390`, `panel-ek.js:56,59,126,339,341` | Tüm kişi/işletme/hizmet/veren sözcükleri `P.T(...)` ile alınsın; cümleler set anahtarlı **tam cümle** (ek uyumu: Müşteriyi/Danışanı/Hastayı, Müşteriye/Danışana/Hastaya). Set tanımına şu anahtarlar eklensin: `kisiSil` ("Müşteri silindi."), `kisiyeHaber`, `kisiAd` hata cümlesi, `kisiSec` |
| 2 | Yüksek | **"Klinik-danışan" seti prototipte yok.** `SETLER` yalnız `salon` ve `hasta`; klinik türleri doğrudan "Hasta" alır. Hukuk-uyum: Hasta yalnız klinik türlerinde ve "Danışan" her modda serbest; tasarım §7.1 ve §8 üç seti sayıyor | `prototip.js:17-21` | `danisan` seti ekle (Klinik / Danışan / Uzman / Uygulama / Danışan formu / Danışan kartı); klinik türünde varsayılan hangisi olacak (öneri: Danışan, sahip Ayarlar › Terimler'den Hasta'ya geçer) tasarım kararı olarak §7.1'e yazılsın |
| 3 | Yüksek | **"Hasta" kalıpları danışan modunda sızar.** "Hasta kaydı kapatıldı.", "Hasta kaydını kapat" sabit | `panel-ek.js:114,164,173` | Set anahtarı `kisiKapat`: "Danışan kaydını kapat / Hasta kaydını kapat"; salon modunda zaten "Müşteriyi sil" |
| 4 | Yüksek | **"İzin" iki ayrı anlamda.** Kampanya/SMS izni ("İzin kaydedildi.", "SMS izni ekle", "İznin kaynağı") ile personel izin günleri ("İzinler" sekmesi, "İzin kaldırma") aynı sözcük. Rehber sözlüğü ayrım istemiyordu; şimdi ekledim | `panel-ek.js:134-135` (kampanya izni), `tasarim.md` §8.1 `personel-detay` (İzinler), §1.5 ("izin kaldırma") | Kampanya tarafı: **Kampanya izni** ("Kampanya izni kaydedildi.", "Kampanya iznini kaldır", "İznin kaynağı" → "İznin nereden alındığı" yerine "Kaynak"). Personel tarafı: yalnız "İzin" ("İzin eklendi/kaldırıldı") |
| 5 | Orta | **R8 ile çelişen başarı metni.** "Personel eklendi. Giriş bilgileri e-postayla gönderildi." Brif R8: davet bağlantısı, personel kendi şifresini belirler; bilgi (şifre) e-postayla gitmez | `panel-ek.js` (personel ekleme, toast) | "Davet bağlantısı e-postayla gönderildi." Buton "Davet gönder" |
| 6 | Orta | **"Cari" tek başına.** "Fatura işlendi. Stok ve cari güncellendi." Sözlük terimi "Cari hesap" | `panel-ek.js` (fatura işleme toast) | "Fatura işlendi. Stok ve cari hesap güncellendi." |
| 7 | Orta | **Başarı bildirimi tutarsız.** "Değişiklikler kaydedildi." 7+ yerde, bir yerde yalnız "Kaydedildi." | `panel-ek.js` (toast listesi) | Tek biçim "Değişiklikler kaydedildi." (kayıt eklemede "[Nesne] eklendi.") |
| 8 | Orta | **Anket ön izlemesinde "Evet / Hayır" butonu.** Tasarım kuralı "Evet yok" eylem butonları için; burada form yanıtı olduğu için kabul edilebilir | `panel-ek.js:149` | Eylem butonu değil, yanıt seçeneği: **sorun yok, gerekçe notlansın** (kural eylem düğmeleri içindir) |
| 9 | Orta | **"Islak imzalı form"** günlük dilde yaygın ama kurum dili/jargon; kullanıcı bunu "elle imzalı kâğıt form" diye düşünür | `veri.js:94`, `panel-ek.js:45,134,187,192` | "Kâğıt üzerinde imzalı form" |
| 10 | Orta | **Sayfa başlığı "Yetkiniz yok"** rehber kalıbıyla ("Bu sayfayı görme yetkiniz yok. Gerekiyorsa salon sahibinden yetki isteyin.") farklı; sekme/başlıkta kısa hâli kabul, gövdede tam cümle olmalı. Klinikte "salon sahibi" değil **Klinik sahibi** (set anahtarı `sahip`) | `panel.js:488`, `panel-ek.js:68`, `H.yetkisiz()` | Başlık "Yetkiniz yok" kalsın; gövde `P.T('sahip')` ile: "… {sahip}ten yetki isteyin." (ek uyumu için ayrı cümleler) |
| 11 | Orta | **Hızlı sınır ve bağlantı hatası metinleri henüz çizilmemiş** (online randevu `randevu-al.html`, sistem ekranları "planlandı"). Çizilince rehber §4.7 ve §4.8'deki gerçek süreler (15 dk, 1 saat, 1 dk) kullanılsın; "birazdan" yok | `tasarim.md` §8.2, §8.6 | Çizim sonrası yeniden bakacağım (kapsam dışı değil, bekliyor) |
| 12 | Orta | **"Hekim" etiketi yalnız hekim rolü için.** Prototip rol adını bütün "personel" rolüne (Uzman) klinikte "Hekim" yazıyor; hukuk-uyum: hemşire/asistan "Sağlık personeli", güzellik merkezindeki estetisyen "Uzman" | `prototip.js:23` (`personel: P.klinik ? 'Hekim' : 'Uzman'`) | Rol anahtarlarını ayır: `hekim`, `saglik-personeli`, `uzman`. Tasarım §6 zaten ekliyor; prototipte rol değiştiriciye "Sağlık personeli" eklenmeli |
| 13 | Orta | **Kurulum adımı adı "Salon bilgileri"** klinik modunda "Klinik bilgileri" olmalı; Ayarlar bölüm adları ("Salon bilgileri", "Müşteri formu soruları") da set anahtarlı | `tasarim.md` §8.1 `ayarlar`, §8.3 kurulum | `{isletme} bilgileri`, `{form} soruları` anahtarlı tam cümleler |
| 14 | Düşük | **Menü grubu adı "Salon"** (Hizmetler, Personel) işletme adıyla karışabilir ("Defne Güzellik Salonu" başlıkta, menüde "Salon" grubu). Klinikte "Klinik" | `tasarim.md` §5 | Öneri: grup adı "İşletme" (setten bağımsız) ya da "Hizmet ve personel" |
| 15 | Düşük | **"Benim primim" / "Günüm" / "Takvimim" / "Müşterilerim"** birinci tekil karışık: "Benim primim" "Benim" ile, diğerleri eksiz | `prototip` menü (`primim`), `tasarim.md` §5 | "Primim" (diğerleriyle uyumlu). Rehberde birinci tekil yalnız kullanıcıya ait listelerde serbest, tek biçim: ek-im |
| 16 | Düşük | **Tutar biçimi iki ekranda iki türlü** (panel kuruşsuz `₺9.150`, rapor kuruşlu). Tasarım §9 bunu belgeliyor; kural "aynı ekranda karışmaz" | `tasarim.md` §9 | Sorun yok; testte aynı ekran içinde karışmadığını doğrulayın (frontend) |
| 17 | Düşük | **Tek bildirimde birden çok bilgi:** "Ödeme alındı. {ad} randevusu tamamlandı." Rutin başarı kısa olmalı | `panel.js` (tamamla toast) | "Ödeme alındı." yeterli; ad toast'ta kişisel veri taşır (yan ekranda görünür) |
| 18 | Düşük | **Kabul hatası toast olarak** ("Devam etmek için Kullanım Şartları’nı ve Veri İşleme Sözleşmesi’ni kabul etmeniz gerekir.") uzun ve geçici; yasal zorunluluk alan altında kalıcı gösterilmeli | `panel-ek.js` (yeniden kabul) | Alan altı hata: "Devam etmek için iki belgeyi de kabul edin." (`role="alert"`) |

## Ek bulgular (frontend-gelistirici bildirimiyle, doğrulandı)

| # | Önem | Konu | Öneri |
|---|---|---|---|
| 19 | Orta | Günün özeti alt satırı "geçen çarşamba 15" birimsiz | "geçen çarşamba 15 randevu" (birim her karşılaştırmada yazılır) |
| 20 | Orta | "Boşluğa dokunun: randevu oluşturun" jargon, iki emir kipi | "Boş saate dokunun." Eylem adı zaten "Randevu oluştur" |
| 21 | Düşük | Tarih biçimi iki türlü (kart "12.09.2026", başlık "28 Ekim") | Tutarsızlık değil, bağlama göre kural: rehber §5'e yazıldı (başlık okunur, liste/kart sayısal, aynı bileşende karışmaz) |
| 22 | Bilgi | ₺ başta (Intl). Simge yazı tipinde yoksa yedek yazı tipi gerekir | Metin kuralı değişmez; yazı tipi doğrulaması frontend'in (ui-ux-tasarimci `latin-ext` + ₺ glifini kontrol etsin) |

## Tur 2 (randevu-al, giris, tanitim, yonetici, sistem; yanıtlar `bulgu-yanitlari.md`)

Tur 1 yanıtlarını kaynakta doğruladım: #2, #3, #4, #5, #9, #14, #15, #17, #19-22 uygulanmış (set anahtarları, "Primim", "Kampanya izni" ayrımı, "Davet gönder", "Kâğıt üzerinde imzalı form"). Aşağıdakiler yeni.

| # | Önem | Konu | Kanıt | Öneri |
|---|---|---|---|---|
| T2-1 | **Yüksek** | **Ünlü uyumu hatası.** Set kelimesine ek çıplak eklenmiş: "danışanlare", "hastalare" çıkar (yalnız "müşterilere" doğru) | `giris.html` `yasal` adımı: `${P.T('kisiler').toLocaleLowerCase('tr-TR')}e gösterilecek` | Kurala uyun: ek değişkenle üretilmez. Set anahtarı `kisilereGosterilecek` ya da cümle "Aydınlatma metninde, veri sorumlusu olarak yer alır." (kişiyi cümleden çıkar) |
| T2-2 | **Yüksek** | **Vitrinde "hasta".** Klinik sektör sayfası "Randevu, hasta iletişimi ve kasa tek uygulamada." Hukuk-uyum + kurucu: vitrinde "Hasta" yok, "Danışan" serbest | `tanitim.html` `sektor` içindeki `klinik` metni | "Randevu, danışan iletişimi ve kasa tek uygulamada." Aynı sayfada tek set |
| T2-3 | Yüksek | **Doğrulanmamış güvence cümleleri.** "Randevularınız ve kayıtlarınız güvende." (bakım sayfası); "Bağlantı gelince yeniden denenir" ve SSS "Bağlantı gelince kaldığınız yerden devam edersiniz" (otomatik yeniden deneme ya da taslak koruma kodda yok, doğrulanmadı) | `sistem.html` bakim/cevrimdisi, `tanitim.html` SSS İnternet kesilirse | Bakım: "Birkaç dakika sonra tekrar deneyin." (güvence cümlesi çıkar). Çevrimdışı: "Bağlantı gelince sayfayı yenileyin." SSS: "Bağlantı gelince devam edebilirsiniz; yarım kalan kayıt saklanmaz." (doğrusunu geliştirici onaylasın) |
| T2-4 | Orta | **Hata sayfasında "404" yazıyor** (rehber: HTTP numarası görünmez). Diğer sayfalarda etiket "Beklenmeyen sorun", "Bakım" | `sistem.html` `E['404']` ikinci alan | Etiket kaldır ya da "Sayfa" yaz; sayı gösterme |
| T2-5 | Orta | **Dönüş eylemi iki ad:** "Bugün’e git" (sistem) / "Bugün’e dön" (panel 404, tasarım §4) | `sistem.html` `E`, `panel.js` 404 | Tek ad: "Bugün’e dön" |
| T2-6 | Orta | **Bekleyen işlem iki etiket:** "Yakında" (vitrin) ile "Tasarım önizlemesi" (Özellikler sayfası, klinik sayfası). P12'de "tek metin" denmişti | `tanitim.html` `ozellikler`, `sektor` (`onizleme`) | Her yerde "Yakında"; "önizleme" kelimesi yalnız bilgi cümlesinde ("Tasarım önizlemesi, kurgusal veri") |
| T2-7 | Orta | **Belge adları iki biçim:** "Kullanım Şartları", "Gizlilik Politikası", "Aydınlatma Metni" (giris footer, onay kutusu) / "Kullanım şartları", "KVKK aydınlatma metni" (tanitim, yonetici). Rehber: cümle düzeni | `giris.html` footer ve `kayit-2`; `randevu-al.html` dip | Hepsi cümle düzeni: "Kullanım şartları", "Gizlilik politikası", "Aydınlatma metni", "Veri işleme sözleşmesi" |
| T2-8 | Orta | **"Sık sorulan" üç yazım:** bölüm "Sık sorulanlar", sayfa "Sık sorulan sorular", menü "SSS" | `tanitim.html` | Hepsi "Sık sorulan sorular"; kısaltma "SSS" gezinmede de açılmalı (kısa bir etiket gerekirse "Sorular") |
| T2-9 | Orta | **"KDV dahil mi?" → "Fiyatlara KDV dahil değildir."** Fiyat kararı daha verilmedi (brif); "KDV hariç" iddiası kurucu kararı | `tanitim.html` SSS ve fiyat kutusu ("/ay · KDV hariç") | Yer tutucu: "[KDV DURUMU: kurucu kararı]". Fiyat sayfası yayına çıkmaz zaten, ama SSS ana sayfada |
| T2-10 | Orta | **"Referans: 7F3K-2Q9M"** hata ekranında; ancak API şu an istek numarası döndürmüyor (gelistirici'ye iletildi) | `sistem.html` hata | Tasarım doğru; üretimde istek no gelene kadar satır "Sürerse destek ekibine yazın: [DESTEK_E-POSTASI]." |
| T2-11 | Orta | **Hesap pasif sayfası "salon sahibiyle"** klinikte "Klinik sahibiyle" olmalı; sistem sayfası `P.T` kullanmıyor | `sistem.html` `pasif` | `P.T('sahip')` ile iki ayrı tam cümle |
| T2-12 | Orta | **Hizmet sözcüğü randevu-al'da sabit:** `kl ? 'İşlem' : 'Hizmet'`; Danışan setinde "Uygulama" olmalı | `randevu-al.html` ADIMLAR ve hizmet ekranı | `P.T('hizmet')` |
| T2-13 | Orta | **"Yeni kodu 0:45 sonra isteyebilirsiniz."** Süre ifadesi bozuk | `randevu-al.html` kod | "45 saniye sonra yeni kod isteyebilirsiniz." |
| T2-14 | Orta | **"Yönetim" iki anlamda:** müşteri panelinde menü grubu (karar), süper yönetici için "Yönetim paneli" etiketi ve "Yönetici girişi" | `yonetici.html` | Öneri: "BeautyOS yönetimi" etiketi, giriş başlığı "Yönetim girişi" değil "BeautyOS ekibi girişi"; "Yönetici" kelimesi yalnız süper yönetici için bırakılırsa rehberde rol adı olarak tanımlanır. Karar: tasarımcı |
| T2-15 | Düşük | Hesap sonrası: "Hesap oluşturuluyor…" ✓; "Hesap oluştur" yerine kayıt ikinci adım başlığı "Hesap bilgileriniz" ✓; ancak şifre ipucu "harf ve rakam içersin" | `giris.html` | "En az 8 karakter; harf ve rakam içermeli." |
| T2-16 | Düşük | **Geliştirici notu kullanıcı arayüzünde:** "Müşterinin kendi iptali yeni işlevdir (kurucu M1); backend gerektirir." ve "Not alanı backend gerektirir." | `randevu-al.html` degistir, `yonetici.html` salon | Prototipe özgü; üretim koduna taşınmaz (frontend'e not) |
| T2-17 | Düşük | **Sürüm etiketi iki türlü:** modalda "Sürüm v1", gövdede "Sürüm: v0" | `giris.html` data-belge | Tek sürüm bilgisi (veri) |
| T2-18 | Düşük | "Kaç koltuk / personel?" eğik çizgi iki ayrı kavram | `tanitim.html` demo formu | "Kaç kişi çalışıyorsunuz?" |
| T2-19 | Düşük | **TLS** jargon | `tanitim.html` SSS | "Bağlantılarınız şifrelenir (HTTPS)." ("uçtan uca" değil) |

**Doğrulananlar (iyi):** hız sınırı metinleri gerçek sürelerle ("15 dakika", "1 saat"); alan hataları; "Randevunuz iptal edilsin mi?" onay penceresi eylem adlı; "Randevuya 2 saatten az kaldıysa değişiklik için salonu arayın." (M1); "E-posta veya şifre hatalı."; şifre sıfırlama "Bu e-posta adresiyle bir hesap varsa…" (kullanıcı varlığını sızdırmaz); "Fiyat kararı bekleniyor" yer tutucu; "BeautyOS e-Fatura keser mi? Hayır." dürüst; yazarkasa/e-Nabız sınırı; HBYS bilgi ekranı.

**Rehber:** rol "Yönetici" → "Müdür" (brif R1) ve "Salon adresi" → "Online randevu adresi" olarak güncellendi.

## Doğru bulduklarım (korunsun)

- Menü adları (Bugün, Bekleme listesi, Kasa, Mesaj asistanı, Raporlar, Hesaplar, Cari hesap, Alış faturaları, Tedarikçiler, Stok, Paketler, Personel ödemeleri, Bahşiş) sözlükle birebir.
- Grup adı **Yönetim** (müdür kararı), Gün sonu: "Günü kapat" → "Gün sonu kaydedildi." ✓.
- "Randevu oluştur", "Randevu oluşturuldu.", "Müşteri eklendi.", "Paket satıldı.", "Seans düşüldü. 2 seans kaldı.", "Fatura kaydedildi.", "Ödendi olarak işaretlendi.", "Bağlantı kopyalandı." eylem-bildirim çifti tutarlı.
- Alan hatası: "Telefon numarası eksik. 10 haneli yazın, ör. 5xx xxx xx xx." ve "Müşteri adını yazın." kalıpla birebir.
- Yükleniyor / Kaydediliyor için tek karakter `…`.
- Hata bloğu: "X yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin." + Yeniden dene ✓. 404: "Sayfa bulunamadı." ✓.
- Para/tarih/saat kuralları (`Intl`, 24 saat, "14:30 – 15:15") rehberle uyumlu.
- "Siz" hitabı ve cümle düzeni büyük harf tutarlı; emoji yok.

## Kapsam dışı / doğrulanmadı

- Tarayıcıda her ekran gezilmedi; yalnız kaynakta sabit metin tarandı. Dinamik üretilen metinler (adlar, şablonlar) ve CSS ile gizlenen metinler doğrulanmadı.
- `tanitim.html`, `randevu-al.html`, `giris.html`, `yonetici.html`, `sistem.html` "planlandı"; metinleri çizilince ayrıca inceleyeceğim.
- Hukuk-uyum görüşleri taslaktır (avukat görüşü değil).
