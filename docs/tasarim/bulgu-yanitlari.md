# Tasarım bulgularına yanıtlar — tur 1

Sahibi: ui-ux-tasarimci · 2026-10-28. Durum: **Uygulandı** (prototip ve/veya `docs/tasarim.md`), **Red** (gerekçeli), **Bekliyor** (kurucu/başka rol kararı ya da sonraki çizim). Dosya yolları `docs/tasarim/prototip/` altındadır.

## hukuk-uyum (`inceleme-hukuk-uyum.md`)

| # | Durum | Ne yapıldı |
|---|---|---|
| T1 | Uygulandı | Klinikte sağlık bilgileri, onam, klinik notu, görüntüler, veri talebi yalnız Hekim. Müdür görmez. Sahip yalnız "Klinik sahibi klinik notlarını görür" anahtarı açıksa (varsayılan kapalı; Ayarlar › Gizlilik ve KVKK; prototipte `?sahipNot=1`). `prototip.js` `P.yetki`, `tasarim.md` §6 |
| T2 | Uygulandı | Klinik modunda hatırlatma şablonu ve önizlemesi işlem adı içermez + açıklama satırı (Ayarlar › Bildirimler) |
| T3 | Uygulandı | "Hasta/Danışan kaydını kapat": zorunlu dışa aktarma kaldırıldı; silinen (iletişim, kampanya izinleri) ve kilitlenen (sağlık, onam, klinik notu) açıkça yazılı; KVKK başvurusu notu; kabul kutusu |
| T4 | Uygulandı | Erişim geçmişi yalnız hekim ve sahip (anahtar açıksa); sağlık personeli görmez |
| T5 | Uygulandı | Resepsiyon satırı kilitli ve kapalı ("Değiştirilemez: bu rol sağlık bilgisini görmez."); klinikte Müdür satırı da kilitli |
| T6 | Uygulandı | Klinikte kampanya izinleri bölümü formda ve kartta gizli; online randevuda "Fiyatları göster" anahtarı (klinikte kapalı); kampanya ve fiyat anahtarı klinikte açılırken uyarı penceresi; asistan sabit satırına "Lütfen sağlık bilginizi buraya yazmayın." |
| T7 | Uygulandı | Klinik abonelik-bitti ve Plan › Verileriniz metni; klinikte hesap kapatma: veri talebi adımı (atlanamaz) → zorunlu kutu → salon adını yazma |
| T8 | Uygulandı | Müşteri modunda fotoğraf için iki ayrı soru (eşit ağırlıkta seçenekler; tanıtım sorusunda yüz seçeneği yanıtın içinde); "Onayları yönet": saklama geri al (iki adım, fotoğraflar silinir), tanıtım geri al (tek adım). F2'nin F1=Evet'e bağlı gösterimi üretim davranışı olarak §8.1'e yazıldı |
| T9 | Uygulandı | Onam satırı "Bilgilendiren: Dr. …"; Onam al'da bilgilendiren hekim alanı; yasal temsilci seçilince ad soyad + yakınlık; yükleme ikonu düzeltildi |
| T10 | Uygulandı | "Verileri talep et" / "Verilerinizi talep edin" + talep penceresi metni; PDF/CSV hâli "araç geldiğinde" notu |
| T11 | Uygulandı | Klinikte veri talebi yalnız hekim (+anahtarla sahip); sağlık bilgisi uyarısı |
| T12 | Uygulandı | Bilgi satırı metni önerilen ifadeyle; "aydınlatma yapılmadı" uyarı + kaydet eylemi (`?aydinlatma=yok`) |
| T13 | Uygulandı | E-posta iznine de kaynak seçimi; elle eklemede "Online randevu formu" seçeneği yok (sistem yazar) |
| T14 | Uygulandı (kısmen) | Kaldırma bildirimi "Kampanya izni kaldırıldı." + kısa geri al; kartta "İzin yok · Kaldırıldı [tarih]" gösterimi §8.1'e yazıldı, prototipte statik |
| T15 | Uygulandı | Resepsiyon: Genel sekmesinde içeriksiz rıza durumu + "Rıza al"; müşteri modu sonrası cevap gösterilmez |
| T16 | Uygulandı | Veri sorumlusu "Derya Aksoy" |
| T17 | Uygulandı | Kullanıcılar tablosu rol adları setten (Müdür, Uzman/Hekim) ve "Abonelik, gizlilik, kullanıcılar, modüller ve terimler hariç" |

## urun-analisti (`inceleme-urun-analisti.md`)

| # | Durum | Ne yapıldı |
|---|---|---|
| B1 | Uygulandı | T1 ile aynı |
| B2 | Uygulandı | Rol değiştiricide "Sağlık personeli" (yalnız klinik): Günüm + takvim + atandığı randevular; sağlık yok |
| B3 | Uygulandı | Personel izni yalnız sahip/müdür (`personel-izni: SY`); kampanya izni ayrı anahtar |
| B4 | Uygulandı | Uzman araması 3 karakter, en çok 10 sonuç, randevusu olmayanda maskeli ve seçilemez telefon, bilgi satırı |
| B5 | Uygulandı (müdür varsayımı) | Klinikte "Klinik görüntüleri" sekmesi kalır (F1 ile yükleme, F2 varsayılan kapalı, yalnız hekim). Kurucu kararı bekleniyor |
| B6 | Uygulandı | §6'ya "resepsiyon bahşişi yalnız ödeme kapanışında" eklendi |
| B7 | Uygulandı | Günüm'de "Bu hafta izinlerim" (salt okunur) var |
| B8 | Uygulandı | Hekim yalnız hasta setinde; danışan setinde "Uzman"; Sağlık personeli ayrı rol |
| F1 | Uygulandı | Ayarlar › Salon bilgileri: işletme türü + kategori sıfırlama; tür değişince sonuçları anlatan onay penceresi |
| F2 | Uygulandı (belge) | Kayıtta 6 grup; "Diğer randevulu işletme" seçilince alt tür listesi (tırnak, spa, masaj, dövme, saç ekim, başka) — `tasarim.md` §7; eşleme tablosu mimar/teknik-yazar ile |
| F3 | Uygulandı | Takvim başlığında "Duruma göre süz" seçimi (gün ve çizelge görünümünü süzer) |
| F4 | Uygulandı (belge) | Sürükle-bırak korunur (§4 takvim satırı); "Saati değiştir" ikinci yol |
| F5 | Uygulandı | Segment çizilmez, "yakında" |
| F6 | Uygulandı | Alış faturaları: taslakta "Sil", işlenmişte "İptal et" (etkiler geri alınır, kayıt kalır), ikisi de onaylı |
| F7 | Uygulandı | Takvim › Ay: gün başına randevu sayısı, Pazar kapalı, güne dokun → gün görünümü |
| F8 | Uygulandı | `randevu-al.html#degistir`: özet, saati değiştir, iptal (onaylı), 2 saat kuralı; SMS kapalıyken bağlantı onay ekranından açılır |
| F9 | Uygulandı | Davette "Bağlantıyı kopyala" + "Davet gönder"; `giris.html#davet` |
| F10 | — | Uygun bulunmuş |

## teknik-yazar (`inceleme-teknik-yazar.md`)

| # | Durum | Ne yapıldı |
|---|---|---|
| 1 | Uygulandı (büyük ölçüde) | Set anahtarları genişletildi (kisiSil, kisiSilindi, kisiyeHaber, kisiyeHaberVerildi, kisiSec, kisiAdYaz, kisiKapat, kisiKapatildi, isletmeBilgi, formSorulari, sahiptenIste); menü, başlık, bildirim, hata, yetkisiz metni setten. Kalan sabit "müşteri" örnekleri ikincil yardım metinlerinde; tur 2'de taranacak |
| 2 | Uygulandı | Danışan seti (`?set=danisan`); klinik varsayılanı Hasta, sahip Terimler'den değiştirir (§7.1) |
| 3 | Uygulandı | "Kaydını kapat" setten |
| 4 | Uygulandı | "Kampanya izni" (müşteri) / "İzin" (personel) ayrımı |
| 5 | Uygulandı | "Davet bağlantısı e-postayla gönderildi." / "Davet gönder" |
| 6 | Uygulandı | "cari hesap" |
| 7 | Uygulandı | Tek biçim "Değişiklikler kaydedildi." |
| 8 | — | Kabul (form yanıtı) |
| 9 | Uygulandı | "Kâğıt üzerinde imzalı form" |
| 10 | Uygulandı | Gövde `P.T('sahiptenIste')` |
| 11 | Bekliyor | randevu-al ve giriş çizildi; tur 2'de bakılacak |
| 12 | Uygulandı | Hekim / Sağlık personeli / Uzman ayrımı |
| 13 | Uygulandı | Set anahtarı `isletmeBilgi`, `formSorulari` tanımlı; ayar listesinde tur 2'de bağlanacak |
| 14 | Uygulandı | Grup adı "Hizmet ve personel" |
| 15 | Uygulandı | "Primim" |
| 16 | — | Kabul (aynı ekranda karışmaz) |
| 17 | Uygulandı | "Ödeme alındı." |
| 18 | Bekliyor | Yeniden kabul hatası alan altına tur 2'de (kayıt ekranında zaten alan altı) |
| 19–22 | Uygulandı | "geçen çarşamba 15 randevu", "Boş saate dokunun.", tarih bağlam kuralı, ₺ glifi (Inter yedek) |

## pazarlama (`inceleme-pazarlama.md`)

| # | Durum | Ne yapıldı |
|---|---|---|
| P1 | Uygulandı (tanıtım çiziminde) | `?vitrin=1`: online randevu şeridi, sağlık/fotoğraf sekmeleri, Günü kapat, rol setleri gizli; "YOK" satırları "Tasarım önizlemesi, yakında" etiketli. Eşleme ölçütü `inceleme-urun-analisti.md` §5b |
| P2 | Uygulandı | Vitrinde nötr klinik adları (hukuk listesi); panel prototipinde gerçekçi adlar kalır (hukuk görüşü) |
| P3 | Uygulandı | "Cilt bakımı (derin temizlik)" her yerde |
| P4 | Uygulandı (vitrin) | Vitrinde tarih/saat yerine "Örnek gün"; karşılaştırma satırı vitrinde yok |
| P5 | Uygulandı | Vitrin parçalarında "Örnek salon, kurgusal veri" etiketi; adres gizli |
| P6 | Uygulandı | Statik poster (HTML'de çizilmiş, iframe değil) + "Canlı demoyu aç" ile tembel yüklenen iframe, `title`, atlama bağlantısı |
| P7 | Uygulandı | Mobil sıra: H1 → metin → CTA → demo bağlantısı → ürün |
| P8 | Uygulandı | §8.4'e berber sayfası |
| P9 | Uygulandı | Vitrinde telefonlar maskeli |
| P10 | — | Kabul: vitrin metni "WhatsApp entegrasyonu" demez |
| P11 | Uygulandı | Hero parçası: Şimdi ve sırada + Personelin günü |
| P12 | Uygulandı | Satır içi küçük "Yakında" + sayfa sonu bölümü, tek metin |
| P13 | — | Kabul |
| P14 | Bekliyor | Yayın kapısı (kurucu fiyat kararı) |

## frontend-gelistirici (`inceleme-frontend-gelistirici.md`)

| # | Durum | Ne yapıldı |
|---|---|---|
| A2 | Uygulandı | Inter yedek; ₺ tüm tutarlarda Inter'den |
| A3-1 | Uygulandı | Token adları İngilizce (müdür kararı); Türkçe açıklama §3 |
| B1 | Kısmen / Bekliyor | Tasarım kütüphaneden bağımsız; sürükle-bırak korunur (müdür kararı). FullCalendar mı kendi bileşen mi kurucuda |
| B2 | Uygulandı | Seçili gün `aria-current="date"` + CSS |
| B3 | Uygulandı | `--color-past-bg/-text` |
| B4 | Uygulandı | ≤30 dk randevu tek satır |
| B5 | Uygulandı | 480 px altında satırdaki durum etiketi gizli (durum renkli kenarla ve ayrıntıda) |
| B6 | Uygulandı | Dokunmatikte parçalı seçim, çip, metin düğme, menü 44 px |
| B7 | Uygulandı | `<a>` üstünde aria-pressed yok |
| B8, B9, B10 | Bekliyor | Tur 2 görsel turunda |
| B12 | Uygulandı | P6 ile aynı |
| Tabular | Uygulandı | §3.2 düzeltildi |

---

# Hareketli tanıtım (kurucu A1) — pazarlama "Hareket" H1–H15

| # | Durum | Ne yapıldı |
|---|---|---|
| H1 | Uygulandı | Hikâye 4. adım "Kasa"; "Günü kapat" düğmesi kaldırıldı |
| H2 | Uygulandı | "Terimler işletme türünüze göre gelir" vaadi çıktı; sektör listesi yazıldı |
| H3 | Uygulandı | Klinik sekmelerinde onaylı sınır cümlesi birebir + "Klinik terimleri ve klinik ekranları yakında." |
| H4 | Uygulandı | "Beş dokunuş" çıktı |
| H5 | Uygulandı | Etki iddiası ve WhatsApp cümlesi çıktı; üstbilgi "Bugün 12:15" / balon "Bugün 16:15" |
| H6 | Uygulandı | "İşletmenizdeki her iş için" |
| H9 | Uygulandı | Beyan gerçek metin olarak kalır (aria-label / aria-hidden yok; yalnız kelimeler span'e bölünür) |
| H10 | Uygulandı | Hero'da "Hareketi durdur / başlat" düğmesi (aria-pressed); demo açılınca döngü durur |
| H11 | Uygulandı | Beyan %72 tonla başlar (≥4,5:1), tam mürekkebe dolar |
| H12 | Reddedildi (müdür kararı) | Kurucu daha hareketli site istiyor; "oyuncak" riski tutarlılıkla çözüldü: tek süre/eğri ailesi, başlıklarda 8 aynı maske yerine 3 çeşit (maskeden yükselme, soldan açılma, hafif ölçekle belirme), imza anları (canlı hero, yapışkan hikâye, takvim, sektör sekmeleri) önde, süs döngü yok |
| Geri dönüş | Uygulandı | Scroll timeline olmayan tarayıcıda: beyan IntersectionObserver ile kelime kelime dolar, hero sahnesi rAF ile geri çekilir, kapanış görününce yaklaşır |

## Hareket — frontend-gelistirici (son-kontrol-frontend.md "Hareket")

| # | Durum | Ne yapıldı |
|---|---|---|
| H1 (engel) | Uygulandı | "sil" başlıklarında kırpma iç span'e taşındı; gözlenen h2 tam boyutta, `is-in` eklenir |
| H2 | Uygulandı | Durdurunca bekleyen zamanlayıcılar iptal, döngü anında sıfırlanır; bildirim yeniden belirmez |
| H3 | Uygulandı | Koyu zeminlerde beyaz odak halkası (11,6:1) |
| H4 | Uygulandı | Yalnız değişen etiket ("Hareketi durdur / başlat"); aria-pressed kaldırıldı |
| H5 | Uygulandı | Alt metin ve CTA ilk karede görünür (opaklık 0 değil, 8 px kayma); belge düzeltildi |
| H6 | Uygulandı | Gizli durumlar yalnız `html.js-hareket` (tanitim-hareket.js ekler) altında |
| H7 | Uygulandı | Etkin olmayan adımlar ton değişimiyle (#7A4A46, pudra-100 üzerinde ~6:1) |
| H2b | Uygulandı | Bekleyen beklemeler zamanlayıcı + reject ile birlikte tutulur; durdurunca hepsi reddedilir, tur catch'te sıfırlanır ve "Hareketi başlat"la temiz yeni tur başlar |
| H8 | Belgede not | Beyan dolumu `color` canlandırır (opaklık değil): tek cümle, kısa ve kaydırmaya kilitli; bilinçli istisna olarak `tasarim.md` §8.4'te yazılı |
| H9 | Uygulandı | Yapışkan telefon düzeni yalnız `prefers-reduced-motion: no-preference` ve ≥900 px'te; azaltılmış harekette adımlar kendi ekranlarıyla alt alta |
| H10 | Uygulandı | Maskeye üst pay (0,14em): "İ" noktası kırpılmaz |
| H11 | Uygulandı | Bildirim kartı parçanın sağ üstüne taşındı; şeridi ve listeyi örtmez |

# Son kontrol yanıtları (frontend `son-kontrol-frontend.md`, müdür listesi)

| # | Durum | Ne yapıldı |
|---|---|---|
| E1 | Uygulandı | `bilesenler.css` başına `[hidden]{display:none!important}`: sistem şeridi, kayıt alt türü, izin kaynağı, fark nedeni artık yalnız gerektiğinde görünür |
| E2 | Uygulandı | Index'te hekim bağlantıları `#musteri/m3` (İrem Bulut, Zeynep'in hastası) |
| E3 | Uygulandı | Günü kapat penceresi, kasa şeridiyle aynı hesaptan (kapanmamış randevu listesi) |
| E4 | Uygulandı | 640 px altında tüm `.tablo`lar satır kartına döner (ilk hücre başlık, diğerleri "etiket — değer", etiketler thead'den otomatik); kabuk sütununa `min-width:0` (taşma yok). Faturalar, personel ödemeleri, stok, kullanıcılar ve yetkiler, raporlar, süper yönetici tablosu dahil |
| E5 | Uygulandı | "backend gerektirir" notları arayüzden kalktı; Paketler bağlantısı `?sekme=paket#musteri/m4`; abonelik-bitti ve yeniden-kabul kabuksuz (yan menü/alt menü yok) |
| N (giriş bağlantıları) | Uygulandı | Giriş/kayıt sayfasındaki metin bağlantıları 44 px dokunma alanı |
| N (arama etiketi) | Uygulandı | Müşteri arama alanı görünmez `<label for>` ile bağlı |
| N (bulunamadı h1) | Uygulandı | randevu-al `#bulunamadi` başlığı h1 |
| ürün N5 | Uygulandı | `tasarim.md` §8.4b: online randevuda not alanı yok, gerekçesiyle |
| Kayıt işletme adı | Uygulandı | Alan boş; yer tutucu örnek |
| Sağlık personeli etiketi | Uygulandı | Klinikte "Sağlık personeli" |
| E6 | Uygulandı | 44 px kuralı yalnız tek başına duran bağlantılarda; cümle içi bağlantılar satır içi ve ekler bağlantının içinde ("Kullanım şartlarını", "Veri işleme sözleşmesini", "Aydınlatma metninde"); davet cümlesi tek parça |
| N2 | Uygulandı | Randevu oluştur arama girdisi `aria-labelledby="ry-m"` |
| N3 | Uygulandı | Hizmet kategori başlık kimlikleri boşluksuz (`k-0`, `k-1`…) |

# Tur 2 yanıtları

## Müdür kararları (uygulandı)
Süper yönetici adı **"Sistem yönetimi"** (giriş başlığı "BeautyOS ekibi girişi"); KDV ifadesi `[KDV DURUMU]` yer tutucu; "Referans" satırı tasarımda kalır, `tasarim.md` §8.6'ya "API istek no döndürene kadar üretimde gösterilmez" notu; vitrinde "hasta" yok; Turnstile kalır (randevu-al'da görünmez koruma satırı, aydınlatma yer tutucusunda "bot koruması: Cloudflare Turnstile" notu; U7 istisnası); takvim kendi bileşen + sürükle-bırak; klinikte "Klinik görüntüleri"; online randevu onayı işletme ayarı (Ayarlar › Online randevu sayfası: salon varsayılan "Otomatik onayla", klinik "Ben onaylayayım"; panel bulgu şeridi ve müşteri onay metni buna göre: "Randevunuz alındı." / "Randevu talebiniz alındı.").

## teknik-yazar (T2-1 … T2-19)
| # | Durum | Ne yapıldı |
|---|---|---|
| T2-1 | Uygulandı | Kişi kelimesi cümleden çıkarıldı: "Bu bilgiler aydınlatma metninde “veri sorumlusu” olarak yer alır." |
| T2-2 | Uygulandı | Klinik alt metni: "Randevuyla çalışan kliniğinizde takvim, müşteri kartı, kasa ve personel işleri tek uygulamada." |
| T2-3 | Uygulandı | "kayıtlarınız güvende", "bağlantı gelince yeniden denenir" kalktı; SMS kapalıyken hatırlatma vaadi yok |
| T2-4 | Uygulandı | Etiket "Sayfa"; sayı yok |
| T2-5 | Uygulandı | Her yerde "Bugün’e dön" |
| T2-6 | Uygulandı | Rozet her yerde "Yakında"; "Tasarım önizlemesi" yalnız bilgi satırında |
| T2-7 | Uygulandı | Belge adları cümle düzeni (giriş, kayıt, randevu) |
| T2-8 | Uygulandı | Başlıklar "Sık sorulan sorular"; menü kısa etiketi "Sorular" |
| T2-9 | Uygulandı | `[KDV DURUMU]` |
| T2-10 | Uygulandı | §8.6 notu |
| T2-11 | Uygulandı | Pasif hesap metni salon/klinik ayrı tam cümle |
| T2-12 | Uygulandı | randevu-al `P.T('hizmet')` |
| T2-13 | Uygulandı | "45 saniye sonra yeni kod isteyebilirsiniz." |
| T2-14 | Uygulandı | "Sistem yönetimi" (müdür kararı) |
| T2-15 | Uygulandı | "harf ve rakam içermeli." |
| T2-16 | Uygulandı | randevu-al'daki geliştirici notu kaldırıldı; yönetici "Not alanı backend gerektirir" ipucu prototipe özgü, üretime taşınmaz (frontend notu) |
| T2-17 | Uygulandı | Belge penceresinde tek sürüm (v0) |
| T2-18 | Uygulandı | "Kaç kişi çalışıyorsunuz?" |
| T2-19 | Uygulandı | "Bağlantılarınız şifrelenir (HTTPS)." |

## pazarlama (Tur 2 T1–T16)
| # | Durum | Ne yapıldı |
|---|---|---|
| T1 | Uygulandı | Hero etiketi "Tasarım önizlemesi, yakında · örnek salon, kurgusal veri" |
| T2 | Uygulandı | T2-2 ile aynı |
| T3 | Uygulandı | Onaylı sınır cümlesi birebir, 18 px gövde rengi; ayrı tam cümleler: saklama yükümlülüğü, "Klinik terimleri ve klinik ekranları yakında."; aynı metin kurulum bilgi ekranında |
| T4 | Uygulandı | SSS: DPA cümlesi, dışa aktarma, hesap kapatma, uygun işletmeler |
| T5 | Uygulandı | H1 22ch + mobil clamp; kısa sektör H1'leri |
| T6 | Uygulandı | 640 px altında takvim parçası yerine liste |
| T7 | Uygulandı | "Şu an boş" panelle aynı hesapla üretiliyor |
| T8 | Uygulandı | Berber ve güzellik sayfalarına sektör örnekleri |
| T9 | Uygulandı | "Başlıca bölümlerde" + paket, prim, stok, bekleme listesi satırları |
| T10 | Uygulandı | Klinik sayfasından ve footer'dan estetik/diş bağlantıları |
| T11 | Uygulandı | `<title>` "Salon ve Klinik Randevu Programı"; kodlamada gerçek rotalar + içerik dosyası SEO bölümü (frontend notu) |
| T12 | Uygulandı (üretim kuralı) | Yazı tipleri üretimde kendi sunucudan (`tasarim.md` §3.2); prototip Google Fonts kullanır |
| T13 | Uygulandı | "BeautyOS randevuyla çalışan işletmeler için…" |
| T14 | Uygulandı | Telefon / e-posta, "Birini yazmanız yeterli." |
| T15 | Uygulandı | "Telefonda çalışır" bölümüne Frankfurt cümlesi |
| T16 | Bekliyor | Fiyat yayın kapısı (kurucu) |

## hukuk-uyum (Tur 2 U1–U12)
| # | Durum | Ne yapıldı |
|---|---|---|
| U1 | Uygulandı | Klinik kurulumunda 2FA adımı atlanamaz; kurulmamışsa sağlık verisi kapalı + kalıcı şerit "Şimdi kur" (`?2fa=yok`); klinik davetten sonra 2FA kurulumu |
| U3 | Uygulandı | Sürüm yayınlama: değişiklik özeti, belge dosyası, avukat onayı kutusu; sözleşme/DPA "Yeniden kabul", aydınlatma/gizlilik "Bildir" |
| U4 | Uygulandı | Pasif yap penceresi: sahibe bildirim, veri talebi durumu, klinik uyarısı |
| U5 | Uygulandı | `#degistir-kod` ("Telefonunuza kod gönderdik") ve `#gecersiz`; onay ekranından aynı oturumda doğrudan |
| U6 | Uygulandı | SSS: liste e-postayla gönderilmez, güvenli yükleme bağlantısı |
| U7 | Uygulandı (kural) | Üretimde yazı tipi self-host; Turnstile bilinçli istisna (müdür) |
| U8 | Uygulandı | SSS DPA cümlesi |
| U9 | Uygulandı | Demo formunda biri yeterli |
| U10 | Bekliyor | Künyede telefon/MERSİS/KEP ve DPA alt işleyen tablosu yer tutucuları: yasal şablonda içindekiler var, alanlar kurucu künyesiyle birlikte eklenecek |
| U11 | Uygulandı | Kayıtta telefon "(isteğe bağlı)" |
| U12 | Uygulandı | Kayıt kapatma: `[SÜRE]` ve "yalnız sorumlu hekim görür" |

## urun-analisti (Tur 2 N1–N4, F)
| # | Durum | Ne yapıldı |
|---|---|---|
| N1 | Uygulandı | Onay ayarına bağlı tutarlı metin (panel + müşteri) |
| N2 | Uygulandı | Klinik davetinden sonra 2FA kurulumu |
| N3 | Uygulandı | SMS kapalıyken SMS vaadi yok |
| N4 | Uygulandı | Doğrulanamayan güvence cümleleri kalktı |
| F1 | Uygulandı | Tür değişim uyarısı (tur 1 sonunda eklendi) |
| F2 | Uygulandı | Kayıtta "Diğer randevulu işletme" seçilince alt tür listesi |
| F3, F7 | Uygulandı | Tur 1 tablosu düzeltildi |
| personel-izni | Bilgi | Anahtar personel ayrıntısında; ekranın kendisi yalnız sahip/müdüre açık olduğundan etkisi yok; kodlamada izin tablosuna taşınır |

## frontend-gelistirici (Tur 2)
| # | Durum | Ne yapıldı |
|---|---|---|
| C-1 (U5) | Uygulandı | Bkz. U5 |
| C-2 Turnstile | Uygulandı | Görünmez koruma satırı |
| B5 kalanı | Uygulandı | Şerit ad sütunu 92 px ("Zeynep" sığar); dar ekranda satır durum etiketi gizli kalır (bilinçli: durum ayrıntıda ve renkli kenarda) |
| B6 kalanı | Uygulandı | Kart başlığı bağlantıları, alt bilgi bağlantıları, başlık düğmeleri dokunmatikte 44 px |
| Odak (kayit-2) | Uygulandı | Odak h1'e |
| C-6 boşluk / iki CTA | Uygulandı | Bölüm boşluğu 72/120; 480 altında CTA'lar alt alta |
| Yönetici süzgeç ve 390 tablo | Bekliyor | İç panel, masaüstü öncelikli; kodlamada tablo → satır kuralı (§4) uygulanır |
