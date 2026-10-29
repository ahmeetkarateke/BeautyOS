# BeautyOS tasarım prototipi: son kontrol (frontend-gelistirici)

- **Tarih:** 2026-10-28 · **Sahibi:** frontend-gelistirici
- **Karar: ENGEL VAR.** Kurucuya sunmadan önce aşağıdaki 5 engel kapanmalı. Hepsi küçük düzeltme (tahminen 1-2 saat); iki tanesi tek bir CSS satırıyla kapanıyor (E1). Engeller kapanınca "kurucuya sunulabilir" derim (bir kısa teyit turu gerekir).
- **Yöntem:** `docs/tasarim/prototip/index.html` listesindeki **108 ekranın tamamı** (salon paneli 45 + klinik 12, randevu-al 14, giriş/kayıt/kurulum 13, tanıtım 13, yönetici 5, sistem 6) Edge headless ile 390 ve 1440 px görüntülendi: **216 görüntü** `docs/tasarim-girdisi/ekran-goruntuleri/son/` altında, `<NNN>-<ekran>-<390|1440>.png` adıyla (NNN = index sırası; 390 px görüntüler 600 px tuvaldedir, sağdaki gri alan ürün değildir). Görüntülerin hepsine kendim baktım (40 kontak sayfası, 390 px tam ölçekte, 1440 px küçültülmüş; ayrıntı gerektiren ekranlara tek tek baktım). Salt okunur kopyada çalıştım; projeye dokunulmadı, commit yok.
- **DOM denetimi (216 yükleme):** yatay taşma, h1 sayısı, etiketsiz kontrol, hedef boyutu, `undefined/NaN/[object]` metni, kopuk `aria-*` kimliği, `hidden` özniteliğinin etkisi, **konsol hatası** (Edge `--enable-logging` ile; yakalamanın çalıştığını bilerek hata veren bir iframe ile doğruladım).
- **Bağlantı/çapa denetimi:** sayfalardaki tüm iç bağlantılardan 101 benzersiz hedef çıkarıldı; 57'si index'te vardı, kalan 44'ü ayrıca açıldı. 0 eksik dosya.
- **Sınır:** yükleniyor/boş/hata varyantları (`?durum=`) ve rol değiştirici kombinasyonlarının hepsi görüntülenmedi; yalnız index'in listelediği ekranlar var. Headless tarayıcı ince işaretçi (fare) kullanır; dokunmatik (`pointer: coarse`) 44 px kuralları CSS'ten okundu, ölçülmedi.

## Özet sonuç

| Denetim | Sonuç |
|---|---|
| Konsol hatası / yakalanmamış istisna | **0** (216 yükleme) |
| Kopuk dosya bağlantısı | **0**; kopuk çapa/rota: **1** (E5-b) |
| Tek h1 | 107/108; `randevu-al.html#bulunamadi` yalnız h2 (düşük) |
| Etiketsiz kontrol | 0; bir alan etiketsiz-adlı: randevu oluştur müşteri araması (yer tutucu adı) |
| Yatay sayfa taşması (390 px) | 1 ekran: `panel.html#faturalar` (+49-59 px) |
| `undefined/NaN/[object]` | 0 |
| Tur 1-2 düzeltmeleri | B2, B3, B4, B7, "Zeynep" kırpması, ikinci tur ₺/Inter: **kapalı** (görüntülerde doğrulandı) |

## ENGELLER

### E1. `hidden` özniteliği çalışmıyor: gizli olması gereken öğeler görünüyor (en az 8 ekran)
**Neden:** `bilesenler.css` genel `[hidden]{display:none}` kuralı içermiyor; `.serit{display:flex}` ve `.alan{...}` gibi `display` veren sınıflar tarayıcının `hidden` davranışını eziyor. Tek satır çözüm: `[hidden]{display:none!important}`.
Görünür etkiler:
- **`sistem.html`: 5 sistem ekranının hepsinde "İnternet bağlantınız yok. Bağlantınız gelince sayfayı yenileyin." şeridi sürekli görünüyor** (404, beklenmeyen hata, bakım, oturum doldu, hesap aktif değil). "Sayfa bulunamadı" ekranında internetin olmadığı yazıyor. Görüntüler: `103-sistem-404-390.png`, `103-sistem-404-1440.png`, `104-sistem-hata-*`, `105-sistem-bakim-*`, `106-sistem-oturum-*`, `107-sistem-pasif-*` (yalnız `108-sistem-cevrimdisi` doğru).
- **`giris.html#kayit` (1. adım):** İşletme türü "Kuaför" seçiliyken "Hangi alanda çalışıyorsunuz?" alanı "Tırnak stüdyosu" ile görünüyor (alt tür yalnız "Diğer randevulu işletme" seçilince çıkmalı). Görüntü: `076-giris-kayit-390.png` (ve 1440).
- **`panel.html#musteri-yeni`:** "İznin kaynağı" seçimi, SMS/e-posta kutuları işaretli değilken de görünüyor. Görüntü: `011-panel-musteri-yeni-390.png`.
- **`panel.html?ac=gun-sonu#kasa`:** "Fark nedeni" alanı fark yokken görünüyor (`gs-not-alan`). Görüntü: `020-panel-ac-gun-sonu-kasa-390.png`.

### E2. İndeksteki iki klinik hekim bağlantısı "Yetkiniz yok" ekranına çıkıyor
`panel.html?tur=estetik&rol=uzman#musteri/m1` ("Hasta kartı (hekim)") ve `...&sekme=knot#musteri/m1` ("Klinik notu ve düzeltme"). Prototipte hekim = Zeynep; m1 (Hande Polat) Elif'in hastası olduğu için yetkisiz ekranı açılıyor. Kurucu klinik hekim akışını (sağlık bilgileri, onam, klinik notu) hiç göremiyor. Kimlik düzeltmesi: `m1` yerine Zeynep'in hastası **`m3` (İrem Bulut)** kullanılsın (m3 sayfasında sekmeler doğru: Genel, Randevular, Sağlık bilgileri, Onamlar…; ayrıca `?2fa=yok` bağlantısı zaten m3). Görüntüler: `047-panel-tur-estetik-rol-uzman-musteri-m1-390.png`, `049-panel-tur-estetik-rol-uzman-sekme-knot-musteri-m1-390.png`. (Yetkisiz ekranının kendisi güzel ve çıkış yolu var; ayrı bir "yetkisiz örneği" olarak kalabilir.)

### E3. Veri tutarsızlığı: Kasa "1 randevu kapanmadı", Günü kapat "3 randevu kapanmadı"
Aynı gün, aynı veri: `panel.html#kasa` şeridi "1 randevu kapanmadı. Gizem Koç (Devam ediyor)" diyor; "Günü kapat" penceresi "3 randevu kapanmadı. Gizem Koç (Devam ediyor), Melis Er ve Ceren Oral (Bekliyor)" diyor. Bugün ekranında da "2 online randevu onay bekliyor: Melis Er, Ceren Oral" (yani 3 doğru). Brif: "örnek veriler kendi içinde tutarlı olmalı." Görüntüler: `019-panel-kasa-390.png` ile `020-panel-ac-gun-sonu-kasa-390.png` (1440 sürümleri de aynı).

### E4. Telefonda (birincil cihaz) tablo ekranları satıra dönmüyor, para sütunları kesik
Belge kuralı (§4 Liste satırı): "640 px altında tablolar satıra döner." Dönmeyenler (390 px):
- **`panel.html#faturalar`:** sayfa yatay taşıyor (+59 px), "Durum" ve **"Tutar" sütunları kırpık**, "İşlem" görünmüyor. Kök neden: tablo kapsayıcısının `position:relative` olmaması, `.gizli-metin` (sr-only, `position:absolute`) ilk konumlu atasına göre taşıyor ve sayfa kaydırmasını açıyor. Görüntü: `027-panel-faturalar-390.png`.
- **`panel.html#odemeler`** (personel ödemeleri): Bahşiş sütunu sağ kenarda kesik, tutarlar sıkışık. `030-panel-odemeler-390.png`.
- **`panel.html#stok`:** "Hareket" bağlantısı "Har…" diye kırpık, ürün adları 3 satıra sarıyor. `023-panel-stok-390.png`.
- **`panel.html#ayarlar/kullanicilar`:** matriste yalnız "Salon sahibi" ve "Müdür" sütunları görünüyor, **Resepsiyon ve Uzman sütunları görünmüyor**; yetki matrisi telefonda okunamıyor. `037-panel-ayarlar-kullanicilar-390.png`.
- (`panel.html#raporlar` sığıyor ama "22 Ekim" iki satıra sarıyor; düşük.) `DURUM.md` yalnız yönetici panelini bilinen eksik olarak yazmış; bunlar salon panelinde.
Çözüm: bu dört tabloyu 640 px altında satır düzenine çevirmek (ya da en azından kaydırılabilir sarmalayıcı + sticky ilk sütun + kaydırma işareti).

### E5. Kopuk gezinti ve geliştirici notları son kullanıcı ekranında
- **a) Geliştirici dili arayüzde:** `panel.html#ayarlar/online` "Dosya yükleme backend gerektirir (B4); o zamana dek mevcut bağlantı alanı kullanılır." ve `yonetici.html#salon/0` "Not alanı backend gerektirir." Kurucuya giden ekranlarda dahili kodlar ve terim yok; "Yakında" etiketi yeterli. Görüntüler: `035-panel-ayarlar-online-390.png`, `101-yonetici-salon-0-390.png`.
- **b) Kopuk rota:** `panel.html#paketler` → "Satılan paketler" bağlantısı `#musteri/m4?sekme=paket` (sorgu `#`'in içinde). Seda Kılıç yerine yanlış müşteriye (Hande Polat) açılıyor. Doğru biçim: `panel.html?sekme=paket#musteri/m4`. Görüntü: `024-panel-paketler-390.png` (bağlantı satırı), hedef sonuç: açılan ekran.
- **c) Kilitli ekran kilitli değil:** `panel.html#abonelik-bitti` ve `#yeniden-kabul` 1024 px ve üstünde tam panel kabuğunun (yan menü, tüm modüller) içinde açılıyor; telefonda kabuksuz. "Deneme süresi doldu" ve "Koşullar güncellendi" ekranlarında yan menü gezintisi olmamalı (belge de "devam et" bekler). Görüntüler: `044-panel-abonelik-bitti-1440.png`, `045-panel-yeniden-kabul-1440.png` (karşılaştırma: `-390`).

## ENGEL OLMAYAN BULGULAR (kurucuya sunmayı engellemez; kodlama aşamasında veya sonraki turda)

| # | Önem | Ekran | Sorun | Görüntü |
|---|---|---|---|---|
| N1 | Orta | `giris.html#giris` ve diğerleri | Tek başına duran metin bağlantıları 18 px yüksekliğinde ("Şifremi unuttum", "Kurtarma kodu kullan", "Giriş ekranına dön", "Başka hesapla giriş yap"); WCAG 2.5.8 24 px asgarisi altında. Dokunmatik kuralı (`.dugme--metin` 44 px) bu bağlantılara uygulanmıyor | `072-giris-giris-390.png`, `074-giris-tur-estetik-2fa-390.png`, `078-…-sifremi-unuttum-390.png`, `081-…-kilit-390.png` |
| N2 | Orta | `panel.html?ac=randevu-yeni` | Müşteri arama alanı etiketle bağlı değil ("Müşteri" başlığı `h3`, `aria-labelledby` yok); adını yalnız yer tutucudan alıyor | `005-panel-ac-randevu-yeni-390.png` |
| N3 | Düşük | `panel.html#hizmetler` | `aria-labelledby="k-Kaş ve kirpik"`: boşluklu kimlik üç ayrı kimlik sayılıyor, bölüm adı okunmaz | `016-panel-hizmetler-390.png` |
| N4 | Düşük | `panel.html#bugun` (1440) | "Günün özeti" Randevu sütunu 5 satıra sarıyor, değerler farklı yükseklikte (B8 kapanmadı) | `001-panel-bugun-1440.png` |
| N5 | Düşük | müşteri kartı (390) | "Ara" + "WhatsApp" iki satıra düşüyor, sekmelerde "Fotoğrafl…" kesik, kaydırma işareti yok (B10 kapanmadı) | `012-panel-musteri-m1-390.png` |
| N6 | Düşük | `panel.html#bugun` (390) | Şimdi ve sırada ikinci satırı kırpık ("Ombre balyaj · Derya · 1…"); ≤479 px'te durum etiketi gizli (durum yalnız düğmeden anlaşılıyor) | `001-panel-bugun-390.png` |
| N7 | Düşük | `panel.html#takvim/28` (390) | Hafta görünümü bağlantısı telefonda gün görünümüyle aynı sonucu veriyor | `004-panel-gorunum-hafta-takvim-28-390.png` |
| N8 | Düşük | `randevu-al.html#bulunamadi`, `#kapali` | h1 yok (yalnız h2); `#kapali` altında "Diğer durumlar (prototip)" listesi `?yalin=1` ile gizlenmiyor | `069-randevu-al-bulunamadi-390.png`, `068-randevu-al-kapali-390.png` |
| N9 | Düşük | `giris.html#2fa-kur` | QR kod yerinde "Kare kod" yazılı gri kutu (yer tutucu) | `082-giris-tur-estetik-2fa-kur-390.png` |
| N10 | Düşük | tanıtım (`tanitim.html`, 1440) | Bölümler arası boşluk fazla (8070 px sayfa), kasa parçası küçük; alt bilgide `[TİCARİ ÜNVAN]`, `[VKN]`, `[DESTEK_E-POSTASI]` yer tutucuları (yayın kapısı P14) | `085-tanitim-1440.png` |
| N11 | Bilgi | tüm ekranlar | Prototip Google Fonts'tan yazı tipi yüklüyor; üretimde `next/font` ile yerel olacak (U7, kabul ölçütü `ekran-envanteri.md` §10) | (kodlama) |

## Doğrulanan iyi durumlar (özet)
- **Panel 390 px:** alt menü (Bugün · Takvim · + · Müşteriler · Menü) tutarlı, katmanlar alt sayfa olarak açılıyor, ad/telefon/para okunur, ₺ Inter'den, rakamlar hizalı.
- **Randevu-al akışı** (hizmet → uzman+zaman → bilgiler → doğrulama → onay, `#degistir` + `#degistir-kod`, geçersiz bağlantı, elle onay, kampanya izni, klinik, salon rengi): 14 ekranın hepsi temiz; bot koruması metni var; fiyat klinikte gizli.
- **Giriş/kayıt/kurulum:** hata, hız sınırı, 2FA, kurtarma, kilit, davet, sihirbaz (salon 5, klinik 8 adım) çalışıyor; yasal onay kutuları işaretsiz.
- **Tanıtım:** ana sayfa, özellikler, fiyat (yer tutucu, sahte rakam yok), SSS (akordeon), iletişim, hakkımızda, 6 sektör (klinik sayfalarında sınır cümlesi okunur), yasal şablon; "Tasarım önizlemesi, yakında · örnek salon, kurgusal veri" etiketleri doğru.
- **Yönetici:** giriş, genel bakış, salonlar (süzgeç hizası düzeltilmiş), salon ayrıntısı, yasal belgeler temiz (telefonda salon tablosu hâlâ kırpık: bilinen kayıt).
- **Klinik ekranları** (m3 üzerinden): hekim/sağlık personeli/müdür/sahip görünümleri belgeyle uyumlu; kayıt kapatma penceresi eksiksiz.

## Sonraki adım
E1-E5 kapanınca bana haber verilsin: etkilenen ekranların (E1 8, E2 2, E3 2, E4 4, E5 5) görüntülerini yeniden alıp DOM denetimini tekrar koşarım ve karar satırını "kurucuya sunulabilir"e çeviririm. (Yeniden kontrol aşağıda.)

---

# Yeniden kontrol (E1-E5 düzeltmeleri sonrası)

- **Karar: ENGEL VAR, 1 yeni küçük engel (E6).** E1-E5 kapandı. E6 yeni bir gerileme: "44 px bağlantı" düzeltmesi cümle içindeki bağlantıları da etkilemiş. Çözülünce "kurucuya sunulabilir".
- **Yöntem:** değişen prototip dosyalarını yeni bir kopyada tüm 108 ekran × 390/1440 px için yeniden görüntüledim (216 görüntü `docs/tasarim-girdisi/ekran-goruntuleri/son2/`; `son/` klasöründeki aynı adlı dosyalar da yeni hâliyle ezildi, yani `son/` artık eski hatayı göstermiyor; `son/` içindeki `…-musteri-m1-*` ve `…-sekme-knot-musteri-m1-*` 4 dosya eski bağlantı adının artığıdır). DOM denetimini ve konsol denetimini 216 yüklemede yeniden koştum. Düzeltilen ekranların görüntülerine tek tek baktım (sistem 404/hata, kayıt, müşteri ekle, gün sonu, kasa, faturalar, ödemeler, stok, kullanıcılar, klinik hasta m3 + klinik notu, ayarlar/online, yönetici salon ayrıntısı, paketler, abonelik-bitti, yeniden-kabul, giriş, randevu oluştur, randevu bulunamadı, yönetici salonlar, takvim, bugün, müşteri kartı, kayıt-2, davet, randevu-al bilgi).
- **Sonuçlar:** konsol hatası **0**; yatay taşma **0** (faturalar dahil); h1 108/108; `hidden` ile ezilen öğe **0**; kopuk dosya 0; `undefined/NaN` 0.

## E1-E5 durumu

| # | Durum | Doğrulama |
|---|---|---|
| E1 `[hidden]` | **Kapandı** | `hidden` ezilen öğe 108 ekranda 0. Sistem 404/hata/bakım/oturum/pasif'te çevrim dışı şeridi yok; kayıtta alt tür alanı gizli; müşteri ekle'de izin kaynağı gizli; gün sonunda fark nedeni "isteğe bağlı" tek alan. `103-sistem-404-390.png`, `076-giris-kayit-390.png`, `011-panel-musteri-yeni-390.png`, `020-panel-ac-gun-sonu-kasa-390.png` |
| E2 hekim bağlantıları | **Kapandı** | index artık `m3` (İrem Bulut); hasta kartı ve klinik notu ekranı açılıyor (Sağlık bilgileri, Onamlar sekmeleri, klinik notu + "Düzeltme ekle"). `047-…-musteri-m3-390.png`, `049-…-knot-musteri-m3-390.png` |
| E3 Kasa tutarlılığı | **Kapandı** | Kasa şeridi ve Günü kapat penceresi aynı: "1 randevu kapanmadı. Gizem Koç (Devam ediyor)". Not: 15:30 Melis Er ve 17:00 Ceren Oral "Bekliyor" ve henüz gelecekte olduğu için sayılmıyor; mantıklı ama Bugün ekranı "2 online randevu onay bekliyor" diyor, bir bakışta 1 ile 3 karışabilir. Kurucu sorarsa açıklama hazır olsun. `019-panel-kasa-390.png`, `020-…-390.png` |
| E4 tablolar | **Kapandı** | 390 px'te Faturalar, Personel ödemeleri, Stok, Kullanıcılar ve yetkiler artık etiketli satır kartı; sayfa taşması yok; Resepsiyon ve Uzman satırları görünüyor. `027-`, `030-`, `023-`, `037-panel-…-390.png` |
| E5-a geliştirici notları | **Kapandı** | Ayarlar/online ve yönetici salon ayrıntısında "backend gerektirir" metinleri yok. `035-…-390.png`, `101-yonetici-salon-0-390.png` |
| E5-b Paketler bağlantısı | **Kapandı** | `panel.html?sekme=paket#musteri/m4` biçimine çevrilmiş; Seda Kılıç'ın Paketler sekmesi açılıyor (ayrıca DOM denetiminde kopuk rota 0) |
| E5-c kilitli ekranlar | **Kapandı** | abonelik-bitti ve yeniden-kabul 1440 px'te de kabuksuz, ortalanmış kart. `044-…-1440.png`, `045-…-1440.png` |

## Yeni engel

### E6. Cümle içindeki bağlantılar 44 px yüksekliğe zorlanınca cümle bozuluyor (giriş/kayıt)
Giriş sayfalarındaki 44 px bağlantı kuralı yalnız tek başına duran bağlantılara değil, **cümle içindeki satır içi bağlantılara** da uygulanmış (`inline-flex`, `min-height:44px`). Sonuç: satır arası açılıyor ve cümle kelime ortasından kopuyor:
- `giris.html#kayit-2` (kayıt, 2. adım) onay kutusu: "Kullanım şartlarını ve Veri işleme sözleşmesi" bir satır, alt satırda "**ni** okudum, kabul ediyorum." (ek kelimeden ayrılmış). Altında "Aydınlatma metni" / "**nde** bulabilirsiniz." Türkçe ekler bağlantıdan kopuk ve yetim kalıyor. `077-giris-kayit-2-390.png`
- `giris.html#davet`: "Kullanım Şartları ve Gizlilik Politikası hesabınız" / "için geçerlidir." arasında büyük boşluk. `080-giris-davet-390.png`
- Aynı kalıp 1440'ta da geçerli (satır genişliği daha geniş olduğundan daha az belirgin). Tek başına bağlantılar ("Şifremi unuttum", "Giriş ekranına dön" vb.) doğru çözülmüş: 44 px, düzen bozulmadı (`072-giris-giris-390.png`, `078-…-390.png`).
**Çözüm:** 44 px kuralı yalnız tek başına duran bağlantı sınıfına (ör. `.baglanti--tek` ya da `p > a:only-child`) uygulansın; cümle içinde `display:inline`, ek bağlantının içinde olsun ("sözleşmesi'ni" tek bağlantı metni) ya da ek bağlantı dışında hiç ayrı düşmesin. Kayıt onay kutusunda tüm satır zaten tıklanabilir etiket (kutu etiketi 44 px), cümle içi bağlantı için 44 px kuralı gerekmez; WCAG 2.5.8 satır içi bağlantıları kapsam dışı bırakır.

## N1-N11 güncel durum

| # | Durum |
|---|---|
| N1 tek başına giriş bağlantıları 18 px | **Kapandı** (44 px); yan etkisi E6 |
| N2 randevu oluştur müşteri araması etiket | **Açık**: DOM denetimi hâlâ `#ry-ara` için bağlı etiket bulamıyor (h3 başlığı `aria-labelledby` ile bağlanmamış; kapsayıcı `#ry-musteri-ara` eklenmiş ama girdide `aria-label`/`aria-labelledby` yok). Düşük-orta |
| N3 `aria-labelledby="k-Kaş ve kirpik"` boşluklu kimlik | **Açık** (`panel.html#hizmetler`): kimlik üretirken boşluk `-`ye çevrilmeli. Düşük |
| N4 Günün özeti Randevu sütunu 5 satıra sarıyor | **Açık** (`001-panel-bugun-1440.png`). Düşük |
| N5 müşteri kartı "Ara/WhatsApp" iki satır, sekme kesik | **Açık** (`012-panel-musteri-m1-390.png`). Düşük |
| N6 Şimdi ve sırada ikinci satır kırpık | **Açık** (kabul edilebilir; ad tam görünüyor). Düşük |
| N7 hafta görünümü telefonda gün görünümü | **Açık** (bilinçli olabilir; belgeye yazılsın). Düşük |
| N8 `#bulunamadi` h1 / prototip listesi | **Kapandı** (108/108 h1); `#kapali` altındaki "Diğer durumlar (prototip)" listesi hâlâ prototip içeriği (yalnız prototip, düşük) |
| N9 QR kutusu "Kare kod" yer tutucusu | **Açık** (prototip yer tutucusu, kabul). Düşük |
| N10 tanıtım boşluğu ve yer tutucular | **Açık**: yer tutucular yayın kapısı P14; bölüm boşluğu değişmedi. Düşük |
| N11 Google Fonts | Bilgi: üretimde `next/font` (kabul ölçütü §10) |

## Ek: E6, N2, N3 sonrası (son durum)

**Karar: KURUCUYA SUNULABİLİR.** Engel kalmadı.
- **E6 kapandı.** `giris.html#kayit-2`: "Kullanım şartlarını ve Veri işleme sözleşmesini okudum, kabul ediyorum." ve "Aydınlatma metninde bulabilirsiniz." akıcı, ekler bağlantının içinde; `#davet` cümlesi tek parça; tek başına bağlantılar ("Şifremi unuttum", "Ana sayfa") 44 px ve düzen bozulmuyor; `#giris`, `#kayit`, `randevu-al.html#bilgi` temiz. Görüntüler: `son2/077-giris-kayit-2-*`, `080-giris-davet-*`, `076-giris-kayit-*`, `072-giris-giris-*`, `060-randevu-al-bilgi-*` (390 ve 1440).
- **N2 kapandı:** DOM denetiminde etiketsiz kontrol 0 (390). **N3 kapandı:** boşluklu kimlik kalmadı; geriye yalnız `my-tel-hata` (hata oluşunca üretilen öğeye işaret eden `aria-describedby`, sorun değil).
- **Son DOM/konsol denetimi (108 ekran × 2):** konsol hatası 0, yatay taşma 0, h1 108/108, kopuk dosya 0.
- **Kalan (engel değil, kodlamada):** N4 (Günün özeti sütun sarması), N5 (müşteri kartı Ara/WhatsApp iki satır, sekme kesik), N6, N7, N9, N10; takvimde boş dilim düğmeleri `aria-hidden`, tabindex -1 (bilinçli, "Randevu oluştur" klavye yolu var); yönetici salon tablosunda salon adı bağlantısı masaüstünde 18 px yüksekliğinde (düşük); `[DESTEK_E-POSTASI]`, `[TİCARİ ÜNVAN]` vb. yer tutucular yayın kapısı P14.
- **Eski adlı görüntü dosyaları (silinmedi):** `son/` ve `son2/` içindeki `047-panel-tur-estetik-rol-uzman-musteri-m1-{390,1440}.png` ve `049-panel-tur-estetik-rol-uzman-sekme-knot-musteri-m1-{390,1440}.png` eski bağlantı adının (m1, "Yetkiniz yok" ekranı) artığıdır. Yeni karşılıkları: `047-panel-tur-estetik-rol-uzman-musteri-m3-*.png` ve `049-panel-tur-estetik-rol-uzman-sekme-knot-musteri-m3-*.png`. Eski m1 dosyaları yalnız yetkisiz ekranının örneği olarak okunabilir; kurucuya gösterilecek set `son2/` içindeki m3 adlılar.

## Sonraki adım (eski, geçersiz)
Tasarımcı E6'yı düzeltince yalnız `giris.html` ve `randevu-al.html` ekranlarını (kayıt-2, davet, kayıt, sifre-sifirla, randevu-al bilgi/footer) yeniden görüntüleyip karar satırını **"kurucuya sunulabilir"**e çeviririm. N2 ve N3 tek satırlık düzeltmeler, aynı turda kapatılabilir. (Bu başlık eskidir; E6/N2/N3 yukarıdaki "Ek" bölümünde kapandı.)

---

# Hareket (tanıtım sitesi hareket katmanı, kurucu kararı A1)

- **Karar: ENGEL VAR.** Kesin engel 1 (H1: iki bölüm başlığı hiç görünmüyor). Sunumdan önce düzeltilmesi gereken 2 madde daha (H2 durdur düğmesi, H3 odak halkası). Gerisi küçük.
- **İncelenen:** `tanitim.html`, `tanitim-hareket.css` (11,4 KB, gzip 3,7 KB), `tanitim-hareket.js` (9,8 KB, gzip 3,5 KB), kütüphanesiz. Dosyalar 07:44 sürümü ("Hareketi durdur" düğmesi eklenmiş hâli).
- **Yöntem:** bu sefer Edge'i DevTools protokolüyle sürdüm (gerçek 390×844 mobil ve 1440×900 görünüm, gerçek zaman). Kaydırma konumları, hero döngüsü zaman damgalı kareler, hikâye adımları, sektör sekmeleri, takvim düşmesi, `prefers-reduced-motion: reduce` (Emulation), konsol/istisna/ağ hataları, PerformanceObserver (uzun görev, CLS, LCP), `Performance.getMetrics` (düzen/stil sayısı), 4× CPU kısıtlı kare süresi. Salt okunur kopyada çalıştım, projeye dokunulmadı.
- **Görüntüler:** `docs/tasarim-girdisi/ekran-goruntuleri/hareket/`: `yukleniş-{390,1440}-0..4`, `hero-{390,1440}-<saniye>s` (hero döngüsü ~1,2 sn'den ~13 sn'ye), `kaydirma-{390,1440}-{000,025,050,075,100}`, `hikaye-1440-adim1..4` (+ `-adim2-gecis`), `hikaye-390-adim1..4`, `sektor-{390,1440}-tab1..4` (+ `-gecis`), `takvim-dusme-{390,1440}-{a,b,c,d}`, `reduced-{390,1440}-{tam,hikaye}`, `durdur-odak-*`, `baslik-h-{kim,yak}-{390,1440}`, `hareketjs-yok-1440`, `son-390-sayfa-sonu`.

## Özet ölçümler
| Konu | Sonuç |
|---|---|
| Konsol / istisna / ağ hatası | **0** (390 ve 1440, tüm senaryolar) |
| Yatay taşma | **0** (390 ve 1440, tam kaydırma sonrası da) |
| Uzun görev (>50 ms) | **0** (1× ve 4× CPU) |
| CLS | 1440: 0,018 (ilk 2 sn yazı tipi değişimi); 390: 0,023 (programatik sekme tıklaması, gerçek kullanıcı tıklamasında sayılmaz) |
| Düzen (tam sayfa gezintisi) | 1440: 76 düzen, toplam 10 ms, betik 142 ms; 390: 45 düzen, 5 ms. **Düzen sarsıntısı yok** |
| Kare akıcılığı (390, 9 sn otomatik kaydırma, 4× CPU kısıtı) | 541 kare, hepsi ≤17 ms, 60 fps. Sınır: başsız yazılım birleştirici, gerçek telefonda ölçülmedi |
| Canlı döngü ekran dışında | 13 sn ekran dışında 0 çalışan animasyon; geri gelince 5 animasyonla devam ediyor (iki yönlü) |
| Yalnız transform/opacity/clip-path | **Kısmen.** Örneklenen özellikler: `transform`, `opacity`, `clip-path` ve `color` (beyan "mürekkep" dolumu, ~25 sözcük); düğme geçişlerinde `box-shadow`, `background-color` (yalnız üzerine gelme). Maliyet düşük ama belge "yalnız transform/opacity/clip-path" diyor |
| Hareket azaltma (`reduce`) | **Geçti.** Çalışan animasyon 0; hero döngüsü yok; "Hareketi durdur" gizli; başlık maskeleri açık; mürekkep dolumu kapalı; rakamlar nihai değerde; 390'da her adım kendi ekranıyla alt alta; ≥900 px'te yapışkan telefon kalıyor, ekran değişimi anlık |

## Engel

### H1. "Kimler için" ve "Yakında" başlıkları hiç görünmüyor (Edge/Chromium)
`data-anim="sil"` ile işaretli iki bölüm başlığı (`#h-kim`, `#h-yak`) başlangıçta `clip-path: inset(0 100% 0 0)` ile tamamen kırpılı. Bunları açan Intersection Observer, öğenin kendi kırpılmış alanı sıfır olduğundan hiç tetiklenmiyor; `is-in` sınıfı eklenmiyor, başlık sonsuza dek görünmez. 1440 ve 390'da, tam sayfa yavaş kaydırma ve 2,5 sn bekleme sonrası doğrulandı: `clipPath` hâlâ `inset(0px 100% 0px 0px)`. Görüntüler: `baslik-h-kim-1440.png` (başlığın olması gereken sol yan boş), `baslik-h-kim-390.png`, `baslik-h-yak-1440.png`, `baslik-h-yak-390.png`.
**Çözüm:** gözlemciyi kırpılmayan bir sarmalayıcıya bağlayın, kırpmayı iç öğeye verin; ya da diğer başlıklardaki `.maske` desenini kullanın. Azaltılmış harekette başlıklar görünüyor; sorun yalnız hareket serbestken.

## Önerilen (sunumdan önce)

### H2. "Hareketi durdur" anında durdurmuyor
Düğmeye döngünün ortasında (dokunuş görünürken) bastım: `aria-pressed` ve etiket doğru değişiyor, ama bildirim ("Randevu oluşturuldu · Elif, 16:15") basıştan 1,2 sn sonra beliriyor ve ~3,7 sn kalıyor: sürmekte olan tur bitiyor (iç `await` zinciri `durdu` bayrağını yalnız tur başında okuyor, `sifirla()` sonrası kalan adımlar yeniden `animate` çağırıyor). WCAG 2.2.2'nin amacı "durdur = hemen dur". **Çözüm:** her `bekle()` sonrasında `if (durdu) return` ya da iptal edilebilir tur. Devam ettirme doğru (≤0,5 sn). Klavye: 11. Sekme durağı, Boşluk ve Enter çalışıyor.

### H3. Koyu hero kartında klavye odak halkası neredeyse görünmüyor
Düğmeler koyu petrol kartta; odak halkası `rgb(43,85,98)` 2 px, zemin ~`#1F3E47`: kontrast yaklaşık 1,5:1 (≥3:1 gerekir, WCAG 1.4.11/2.4.7). Görüntü: `durdur-odak-yakin-1440.png`. **Çözüm:** koyu yüzeylerde açık halka (`#fff` ya da pudra-200). "Canlı demoyu aç" düğmesi için de geçerli.

### H4. Düğme etiketi ve durumu birlikte değişiyor; hedef 36 px
Hem `aria-pressed` kullanıyor hem etiketi değiştiriyor ("Hareketi başlat" + basılı): ekran okuyucu çelişkili okur. Ya sabit etiket + `aria-pressed`, ya değişen etiket ve `aria-pressed` yok. Boyut 126×36 (390'da 131×36); dokunmatikte `.dugme--kucuk` 44'e çıkıyor (CSS'ten okundu; CDP'de dokunmatik işaretçi yok, ölçemedim).

### H5. Yükleniş: hero CTA ve başlık ilk karede görünmüyor, parça 1,2 sn'yi aşıyor
Belge "CTA ilk karede görünür, yükleniş 1,2 sn" diyor. Ölçüm (ilk boyamadan): hero CTA opaklığı 0 → 0,5 @ +490 ms → 1,0 @ ~+870 ms; ilk karede H1 yok (satırlar +100/+210 ms gecikmeli); hero parçası tamamen +1,35 sn'de. Üst çubuktaki "Ücretsiz deneyin" ilk karede görünüyor (bir tıklama yolu var), ama ana CTA ve başlık yarım saniyeden uzun saklı; LCP elemanı başlık değil (1440'ta paragraf, 390'da "örnek salon" etiketi). Görüntüler: `yukleniş-390-0..4.png`. **Öneri:** CTA hiç gizlenmesin (yalnız `transform` ile yerleşsin), H1 gecikmesiz, parça ≤1,2 sn.

## Küçük bulgular
- **H6 (Orta-düşük): hareket betiği yüklenmezse içerik görünmez kalıyor.** `.js` sınıfı sayfa başında ekleniyor, gizli başlangıç durumları ona bağlı; `tanitim-hareket.js` yüklenmezse başlıklar ve liste satırları `opacity:0` kalıyor (`hareketjs-yok-1440.png`). Öneri: `.js` sınıfını betik başarıyla çalışınca ekleyin ya da 3 sn zaman aşımı yedeği.
- **H7 (Orta): ≥900 px'te etkin olmayan hikâye adımları %40 opaklık** (azaltılmış harekette de): kontrast yaklaşık 2,3:1 (pudra zemin), 4,5:1 altında. Opaklığı en az %70 yapın ya da etkin adımı başka işaretle ayırın.
- **H8 (Düşük): beyan "mürekkep" dolumu `color` animasyonu** (kural dışı özellik). Maliyeti düşük; belgeyi ya da uygulamayı tutarlı yapın.
- **H9 (Düşük):** `reduce` açıkken ≥900 px'te yapışkan telefon ve kaydırmayla ekran değişimi sürüyor (anlık); belge "alt alta" diyor.
- **H10 (Düşük):** yüklenişin ilk karesinde H1'in "İ" noktası maskeden bir an görünüyor (`yukleniş-390-0.png`).
- **H11 (Bilgi):** hero bildirimi kartın alt satırını ("Merve" satırı, saat ekseni) örtüyor; bilinçli olabilir. 390'da canlı parça ilk ekranın altında, döngü yalnız kaydırınca başlıyor (doğru).
- **Doğru çalışanlar:** hero döngüsü (dokunuş çemberi Elif'in boş saatinde, 16:15 bloğu doluyor, bildirim geliyor, tur tekrar ediyor: `hero-1440-4_6s.png`, `-6_1s.png`, `-9_1s.png`); hikâye adımları 1440'ta etkin adımı seçiyor ("4 adımdan N" sayacı 1-4 doğru, telefon `sticky`), 390'da adımlar kendi ekranıyla alt alta; sektör sekmelerinde alt çizgi kayıyor, kartlar sırayla geliyor; takvim randevuları saat sırasıyla düşüyor, "şimdi" çizgisi çekiliyor (`takvim-dusme-1440-a..d.png`); rakamlar yuvarlanıyor, ekran okuyucuya gerçek metin kalıyor; 390'daki yapışkan alt CTA sayfa sonunda footer bağlantılarını örtmüyor (`son-390-sayfa-sonu.png`); Intersection Observer bir kez gösteriyor (yukarı dönünce yeniden gizlenmiyor), hero ve hikâye gözlemcileri iki yönlü.

## Sonraki adım
H1 kapanınca ve H2/H3 düzeltilince yalnız ilgili bölümleri (başlıklar, durdur düğmesi, odak, yükleniş) yeniden ölçüp kareleri alırım; karar "kurucuya sunulabilir"e döner. H4-H11 kodlama aşamasına taşınabilir.

---

# Hareket — yeniden kontrol (`tanitim-hareket.css` baştan yazıldıktan sonra, 07:58 sürümü)

- **Karar: ENGEL VAR, 1 küçük engel (H2b: "Hareketi başlat" döngüyü yeniden başlatmıyor).** Bundan sonra "kurucuya sunulabilir". H1 ve H3-H7 kapandı; hareketin geri kalanı çalışıyor.
- **Yöntem:** önceki turdaki gibi DevTools protokolüyle gerçek 390×844 mobil ve 1440×900, gerçek zaman. CSS baştan yazıldığı için **tüm hareket katmanını sıfırdan** ölçtüm: yükleniş kareleri, hero döngüsü, kaydırma konumları (0/25/50/75/100%), hikâye adımları, sektör sekmeleri, takvim düşmesi, rakam yuvarlanması, beyan koyulaşması, `reduce`, betik yüklenmemiş hâl, durdur düğmesi (tıklama ve klavye), odak halkası, 4× CPU kare süresi. Görüntüler `docs/tasarim-girdisi/ekran-goruntuleri/hareket2/` (86 dosya, adlandırma `hareket/` ile aynı).
- **Temiz:** konsol/istisna/ağ hatası 0 (390 ve 1440); yatay taşma 0; uzun görev 0 (1× ve 4× CPU); 390'da 4× CPU kısıtında 541 kare hepsi ≤17 ms; düzen sarsıntısı yok (1440'ta tüm gezinti 68 düzen, 9 ms; 390'da 45 düzen, 5 ms); CLS 0,020 (1440) ve 0,023 (390, yalnız programatik sekme tıklaması); JS 10,3 KB (gzip 3,7 KB), CSS 12,2 KB (gzip 3,9 KB).

## H1-H11 güncel durum
| # | Durum | Ölçüm / kanıt |
|---|---|---|
| H1 başlıklar görünmüyor | **Kapandı** | `#h-kim` ve `#h-yak` yavaş kaydırmada `is-in`, `clip-path: none`, metin görünür (390 ve 1440). `baslik-h-kim-*`, `baslik-h-yak-*` |
| H2 durdur anında durdurmuyor | **Kısmen: durma düzeldi, devam bozuldu (H2b)** | Tur ortasında basınca bildirim artık **hiç belirmiyor** (6,5 sn boyunca `toast=0`, `dok=0`). Ama **"Hareketi başlat"a basınca hiçbir şey yeniden başlamıyor** (etiket "Hareketi durdur"a dönüyor, 8 sn boyunca çalışan animasyon 0). Neden: `durdur` anında `zamanlayicilar` temizleniyor (`clearTimeout`), bu zamanlayıcıların bekleyen `await bekle(...)` Promise'ları ne çözülüyor ne reddediliyor, `tur()` döngüsü o `await`'te sonsuza dek asılı kalıyor; `durdu=false` yapmak onu uyandırmıyor. **Çözüm:** durdururken bekleyen Promise'ları `reject` edin (reddet işlevlerini bir kümede tutup çağırın) ya da döngüyü yeniden başlatın |
| H3 odak halkası | **Kapandı** | Halka `rgb(255,255,255)` 2 px, 2 px aralıklı, koyu karta karşı ≥3:1 |
| H4 aria-pressed + etiket | **Kapandı** | `aria-pressed` kalktı, yalnız etiket değişiyor. Hedef boyut hâlâ 126×36 (390'da 131×36); dokunmatik 44 px kuralı CSS'ten okundu, ölçemedim |
| H5 CTA/başlık ilk karede | **Kapandı** | İlk karede alt metin ve hero CTA tam görünür, yalnız hafif kayıyor; H1 maskeden yükseliyor (+100/+210 ms, 900 ms); hero parçası perdesi 150 ms + 1000 ms = 1,15 sn (≤1,2). LCP elemanı artık ana paragraf (`P.giris-metni`). 1440'ta ilk 2 sn'de 0,020 CLS (yazı tipi değişimi), 390'da 0 |
| H6 betik yüklenmezse | **Kapandı** | `tanitim-hareket.js` yok iken gizli öğe 0, H1 `transform: none`, CTA ve hero opaklığı 1 (`.js-hareket` sınıfını betik ekliyor) |
| H7 etkin olmayan adım | **Kapandı** | Normal modda etkin olmayan adım başlık/metin rengi `rgb(122,74,70)` pudra zeminde ≈6:1 (opaklık 1); `reduce` modunda da 1 |
| H8 `color` animasyonu | **Açık (düşük)** | Örneklenen özelliklerde `color` hâlâ var (beyan koyulaşması, 10 sözcük). Kaydırma konumlarında çalışıyor: sözcükler önce %72 mürekkep tonunda (okunur), 25% civarında tam mürekkep. Belge "yalnız transform/opacity/clip-path" diyor; belgeyi düzeltin ya da kabul edin |
| H9 reduce ≥900 px yapışkan | **Açık (düşük)** | `reduce` açıkken ≥900 px'te yapışkan telefon ve kaydırmayla ekran değişimi sürüyor (anlık); belge "alt alta" diyor. İşlevsel |
| H10 "İ" noktası | **Açık (düşük)** | `yukleniş-390-0.png` ilk karede H1 maskesinden tek nokta görünüyor |
| H11 bildirim kartı örtüyor | **Açık (bilgi)** | Hero bildirimi kartın alt satırını örtüyor; bilinçli olabilir |

## Alan alan özet (yeniden kontrol)
- **Yükleniş:** `yukleniş-390-0..4`, `yukleniş-1440-0..4`: alt metin + CTA kare 0'dan itibaren görünür; H1 iki satır maskeden yükselir.
- **Hero döngüsü:** 1440'ta dokunuş çemberi Elif'in boş saatinde belirir, 16:15 bloğu dolar, bildirim gelir, tur tekrar eder (`hero-1440-*s`); 390'da canlı parça ilk ekranın altında ve yalnız görününce çalışır; **ekran dışında 13 sn: çalışan animasyon 0**, geri gelince 5 animasyonla devam (durdurmadan).
- **Kaydırma konumları** (`kaydirma-{390,1440}-{000,025,050,075,100}`): boş, kırık ya da üst üste binen öğe yok; başlıklar maskeden yükseliyor; 390'daki yapışkan alt CTA sayfa sonunda footer bağlantılarını örtmüyor (en alttaki bağlantı çubuğun 50 px üstünde).
- **Hikâye:** 1440'ta yapışkan telefon, "4 adımdan N" sayacı 1-4 doğru, ekran değişimi çalışıyor (`hikaye-1440-adim1..4`); 390'da adımlar kendi ekranıyla alt alta (`hikaye-390-adim1..4`).
- **Sektör sekmeleri:** alt çizgi kayıyor, kartlar sırayla geliyor (`sektor-1440-tab1..4`, `sektor-390-*`).
- **Takvim düşmesi / rakamlar:** randevular saat sırasıyla düşüyor, "şimdi" çizgisi çekiliyor (`takvim-dusme-1440-a..d`); rakam sütunları yuvarlanıyor, ekran okuyucuya gerçek metin kalıyor.
- **Beyan koyulaşması:** kaydırdıkça sözcükler %72 mürekkep tonundan tam mürekkebe geçiyor (1440 ve 390). **Scroll-timeline kapalı benzetimi yapılamadı** (`--disable-blink-features=ScrollTimeline` Edge'de etkisiz kaldı); JS yedeğine (`geriCekilYedek`, `is-in-yedek`) bu turda dokunulmadı, Firefox/Safari'de doğrulanmadı.
- **`reduce`:** çalışan animasyon 0; hero döngüsü ve durdur düğmesi yok; mürekkep dolumu kapalı; rakamlar nihai değerde; 390'da adımlar alt alta; 1440'ta 3 gizli öğe yalnız hikâyenin etkin olmayan telefon ekranları (bilinçli). Konsol hatası 0.
- **Kalan sınırlar:** ölçümler başsız Edge'de (yazılım birleştirici); gerçek telefonda, Safari ve Firefox'ta çalıştırılmadı.

## Sonraki adım
H2b düzeltilince yalnız durdur/başlat akışını (tıklama ve klavye, 8 sn sonra çalışıyor mu) yeniden denerim; karar "kurucuya sunulabilir"e döner. H8-H11 kodlama aşamasına taşınabilir. (Aşağıdaki kısa ek bunu yaptı.)

---

# Hareket — kısa ek (H2b, H9, H10, H11 düzeltmeleri sonrası, 08:07 sürümü)

**Karar: KURUCUYA SUNULABİLİR.** Engel kalmadı. Görüntüler `docs/tasarim-girdisi/ekran-goruntuleri/hareket3/`.

| # | Durum | Kanıt |
|---|---|---|
| H2b durdur → başlat | **Kapandı** | Tıklamayla 3 kez art arda: durdurunca çalışan animasyon 0, etiket "Hareketi başlat"; başlatınca hemen 4-5 animasyon çalışıyor, 8 sn boyunca sürüyor ve bildirim geliyor, etiket "Hareketi durdur". Klavye: Sekme ile 11. durakta düğme, Boşluk durdurur (0), Enter başlatır (4-7 animasyon, bildirim geliyor). "Canlı demoyu aç" sonrası: durdur düğmesi gizleniyor, canlı demo iframe'i açılıyor, hero animasyonu 0 (bilinçli, döngü sonlanıyor), konsol hatası 0 |
| H9 reduce'ta yapışkan | **Kapandı** | `reduce` açıkken 1440'ta `position: static`, yapışkan sahne `display: none`, 4 adım kendi ekranıyla alt alta, etkin olmayan adım opaklığı 1, çalışan animasyon 0, durdur düğmesi gizli (`reduce-1440-hikaye.png`, `reduce-390-hikaye.png`) |
| H10 "İ" noktası | **Açık (çok düşük)** | `yukleniş-390-0.png` ilk karede H1'in solunda hâlâ tek bir nokta görünüyor, `yukleniş-390-1.png` maske kenarında harf uçları. Maske açılışının doğal kenar etkisi; sunumu engellemez |
| H11 bildirim örtmesi | **Kapandı** | Bildirim artık "Bugün" başlık satırının sağında; liste satırları ve doluluk şeritleriyle çakışma 0 (ölçüm). Yalnız sağ üstteki "Örnek gün" etiketini kapatıyor (`bildirim-1440.png`) |

- **Diğer ölçümler:** konsol/istisna/ağ hatası 0 (390, 1440, reduce); yatay taşma 0; uzun görev 0; CLS 0,0002 (1440) / 0 (390); 390'da 4× CPU kısıtında 541 kare, hepsi ≤17 ms; tam sayfa gezintisinden sonra gösterilmemiş `data-anim` yalnız 1440'ta gizli olan telefon takvim varyantı (bilinçli).
- **Kalan, engel değil:** H8 (`color` animasyonu; belgeyi düzeltin ya da kabul edin), H10 (yukarıda). Sınırlar: başsız Edge, scroll-timeline kapalı benzetimi yapılamadı, Safari/Firefox ve gerçek telefon denenmedi.
