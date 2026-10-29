# Tanıtım sitesi derinlik katmanı: son kontrol (frontend-gelistirici, 2026-10-28)

**Karar: KURUCUYA SUNULABİLİR** (küçük kalan konularla).

Yöntem: Edge headless + CDP; `tanitim.html` ana sayfa, Özellikler, Fiyat, SSS, kuaför/berber/klinik/estetik, İletişim, Hakkımızda, KVKK; 390 ve 1440 px (ayrıca 768, 1024, 1366x650, 1440x700, 390x700). Görüntüler `ekran-goruntuleri/derinlik/son/` (kaydırma boyunca), ek kareler `derinlik/t6-*`, `t7-*`, `menu-390-*`.

## Bulunan ve düzeltilen hatalar
1. **Kritik: `.gun` sınıf çakışması.** "Günün tüm işi tek ekranda" bölümü `bilesenler.css`'teki takvim gün düğmesi `.gun` (52 px genişlik) ile çakışıp bölümü 52 px'e sıkıştırıyordu. Bölüm `gun-bolum` olarak yeniden adlandırıldı (tanitim.html + derinlik.css).
2. **Hero penceresinde görünmeyen yazılar** (Bugün, saatler, isimler beyaz-üstü-beyaz) ve "Örnek gün" 1,6:1: hero `color:#fff` ve `.metin-soluk` sızıyordu. `.parca{color}` ve kural daraltıldı.
3. **Hikâye adım kartlarında** küçük telefon içindeki etiketler büyük/bordo çıkıyordu (`.adim p` sızması, tanitim-hareket.css 3 satır daraltıldı).
4. **SSS yan sütunu 390 px'te sabit kalıp soruların üstüne biniyordu**: sticky yalnız ≥1024 px.
5. "Telefonda çalışır" telefon sahnesi alçak ekranda (≤860 px yükseklik) menünün altında/ekran dışında kalıyordu: telefon yüksekliği ekrana göre küçülür; 1366x650'de dört adım da sığıyor. "Tarayıcıdan açılır" çipi telefon başlığını örtüyordu, yeri değişti.
6. Menü camı açık zeminde çamurlu gri görünüyordu: daha koyu petrol (%90, açık panel %96).
7. "Kimler için" koyu panelindeki etiketler koyu-üstü-koyu idi (görünmüyordu); kapanış kartı metni ve hero etiket/düğmeleri AA altındaydı (4,0:1); kapanış bildirim ikonu; hero alt notu eğri tabana yapışıyordu.
8. Telefonda altbilgi yapışkan "Ücretsiz deneyin" çubuğunun altında kalıyordu: alt boşluk eklendi.
9. İletişim formunda Telefon/E-posta yan yana alanları 16 px kaymış, ipucu sonraki etiketle yapışıktı.
10. Örnek randevu kartlarında "Kadın saç kesimi · De…" kırpılması: metin sarılıyor.

## Doğrulananlar
- **Menü:** hero üstünde saydam, 24 px sonra cam; 390 px'te Menü düğmesi açar/kapar (`aria-expanded` true/false, panel gizlenir), Esc kapatır ve odak düğmede kalır; hem hero'da hem kaydırılmışken denendi.
- **DOM (22 sayfa/genişlik):** yatay taşma **0**, konsol/istisna hatası **0**, tek h1 her sayfada, etiketsiz kontrol **0**, yinelenen id 0, `undefined/NaN` yok.
- **Kontrast (her kaydırma adımında arka plan örneklemesi):** kalan bulgular yalnız ölçüm artefaktı (kırpılmış sayaç rakamları, dekoratif dev yazı, "şimdi" çizgisinin üstünden geçtiği takvim metni) ve iki panel notu 4,48:1 (eşik 4,5; "Örnek salon/klinik, kurgusal veri", berber/klinik 390 px).
- **Hareket:** "Hareketi durdur" tüm sonsuz animasyonları (ışık lekeleri, yüzen çipler) durdurur (7 → 0 çalışan, dönüşler sabit), "başlat" geri getirir. `prefers-reduced-motion: reduce` altında hiç animasyon yok, durdur düğmesi gizli. 4x CPU yavaşlatmada kaydırma 59 fps (1440) ve 60 fps (390), 100 ms üstü kare yok. Not: headless yazılım çizimi; gerçek cihaz ölçümü yapılmadı.
- **Genel göz:** beyaz düz üst şerit yok, bölümler eğik/eliptik/yaprak geçişlerle bağlı, bento ve kart akordeon var; eğik ayraç ve eliptik tabanlarda beyaz çizgi/kırık kenar görülmedi. Dürüstlük (#15) etiketleri ve "Yakında/Yer tutucu" işaretleri aynen duruyor; içerik eklenmedi.

## Kalan küçük konular (engel değil)
- `bilesenler.css` (dokunmadım): `.alan + .alan` kuralı `.alan-satir` içinde de ikinci alanı 16 px kaydırıyor; panel formlarında aynı olabilir, tasarımcı bakmalı. Tanıtımda derinlik.css'te yamalandı.
- Kapanış kartının sol altındaki pudra ışığı koyu zeminde hafif kahverengimsi; zevk meselesi.
- 4,48:1 iki küçük not rengi; tek ton koyulaştırılabilir (panel parçası).
- Takvim parçasında "şimdi" çizgisi çalışan randevunun yazısını kesiyor (panel davranışı).
- Gerçek telefonda performans ve Safari `backdrop-filter` ölçülmedi.

Değişen dosyalar: `docs/tasarim/prototip/tanitim-derinlik.css`, `tanitim.html` (1 sınıf adı), `tanitim-hareket.css` (3 seçici). Commit atılmadı.
