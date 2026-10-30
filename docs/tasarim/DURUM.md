# BeautyOS tasarım — durum (ui-ux-tasarimci)

Son güncelleme: 2026-10-28 (son tur). **Durum: TASARIM HAZIR** (kurucu onayına sunulabilir). Ekibe yeni inceleme isteği gönderilmedi; son kontrolü müdür organize eder.

## Teslimler
- `docs/tasarim.md` — ilkeler, yön ve kütüphane kayıtları, tokenlar (İngilizce adlar), bileşenler, gezinme, roller, Salon/Klinik modları ve terim setleri, beş yüzeyin akış ve ekran listesi, online randevu onay ayarı (§8.4b), metin, erişilebilirlik, Tailwind notu.
- `docs/tasarim/bulgu-yanitlari.md` — tur 1 ve tur 2 bulgularının tamamına yanıt.
- `docs/tasarim/prototip/` — `index.html` (giriş), `cerceve.html`, `panel.html` (+ `panel.js`, `panel-ek.js`), `randevu-al.html`, `giris.html`, `tanitim.html`, `yonetici.html`, `sistem.html`, `tokens.css`, `bilesenler.css`, `prototip.js`, `veri.js`.

## Kurucu geri bildirimi A1 (tanıtım hareketli olsun) — yapıldı
- `prototip/tanitim-hareket.css` ve `tanitim-hareket.js` eklendi; `tanitim.html` ana sayfa yeniden kurgulandı: canlı hero döngüsü, mürekkep beyanı, yapışkan telefonla dört adımlık hikâye ("Telefonda çalışır"), sektör sekmeleri, takvim/liste/rakam hareketleri. Özellikler ve sektör sayfaları aynı parçalarla hareketli. Tasarım: `tasarim.md` §8.4 "Hareket katmanı".
- İnceleme isteği: frontend-gelistirici (görüntü + performans), pazarlama. Tarayıcıda tasarımcı tarafından açılmadı.

## Kurucu geri bildirimi A2 (görsel derinlik) — YAPILDI, tarayıcıda açılmadı (2026-10-28)
Değişen: `prototip/tanitim-derinlik.css` (yeni), `tanitim.html` (işaretleme: menü, hero, hikâye kartları, sahne-kart, bento, kimler için, fiyat kartı, yakında, SSS, kapanış kartı ortak kabukta, altbilgi), `tanitim-hareket.js` (`hareket-durdu` sınıfı). `tasarim.md` §8.4 "A2 görsel derinlik". Bilinen eksik: hiç tarayıcıda/ekran görüntüsünde doğrulanmadı (araç yok); müdürün ekran görüntüsü kontrolü bekleniyor. Özellikle bakılacaklar: hero/beyan boşluğu, eğik ayraç ve eliptik taban kenarları, mobil menü, 390 px bento, sticky telefon sahnesi yüksekliği.
Plan (uygulandı):
Plan: yeni dosya `prototip/tanitim-derinlik.css` (tanitim.html'de satır içi stilden SONRA yüklenir, yalnız tanıtım) + `tanitim.html` işaretleme düzenleri + `tanitim-hareket.js`'e küçük eklemeler.
1. Menü: sabit, yüzen hap; hero üstünde saydam, kaydırınca bulanık koyu cam; telefonda "Menü" düğmesi (44 px).
2. Hero: petrol katmanlı zemin + pudra/mor ışık lekeleri (yavaş kayar) + nokta dokusu; ürün pencere çerçevesinde, alt kenarı taşar.
3. Geçişler (her biri farklı): kavisli hero tabanı · yükselen yaprak yüzeyler · eğik ayraç · eliptik taban · kartın renk sınırını taşması · dışbükey üst · renk geçişi · kapanış kartının altbilgiyi taşması.
4. Kartlar: bento (canlı mini parçalar), sahne-kart panelleri, kimler için kartı (sağ panel dolu), hikâye adımları kart, nasıl başlarsınız merdiven, fiyat kartı, SSS kart akordeon, kapanış büyük kart, katmanlı altbilgi.
5. A1 hareketleri korunur; ışık lekeleri `html.hareket-durdu` ile durur; kapanış kartı tüm sayfalarda ortak kabukta.

## Kapanmamış (bilinçli bekleyenler)
- KARAR VERİLDİ (urun-analisti, kurucu kararı): saç ekimi salon modunda kalır, tasarım değişmez. Tek istisna: saç ekiminde hazır mesaj şablonlarında (hatırlatma vb.) hizmet adı geçmez; mesaj şablonu önizlemesinde bu türde işlem adı çıkarılmaz (prototipte mesaj önizlemesi hizmet adı içermiyor, uyuyor). Eski not, klinik kural seti seçilseydi: `tasarim.md` §7/§7.1, `giris.html:38/53`, `prototip.js:12`, `panel-ek.js:420` (tür değiştirme uyarısında 2FA). Geçerli olan: hatırlatma mesajında hizmet adı yok (prototipte zaten uyuyor).
- Kesinleşti (kurucu T1–T3): kendi takvim bileşeni + sürükle-bırak, klinikte "Klinik görüntüleri", online randevu onayı işletme ayarı. E6, N2, N3 düzeltildi; frontend'e yeniden görüntüleme için bildirildi.
- Kurucu kararı: fiyat/KDV, künye, [DESTEK_E-POSTASI], logo, yasal metin gövdeleri (avukat).
- hukuk-uyum U10: künyede telefon/MERSİS/KEP ve DPA alt işleyen tablosu yer tutucuları (künye bilgisiyle birlikte).
- pazarlama T16 / P14: fiyat kutusu yayın kapısı.
- frontend: yönetici panelinde 390 px tablo → satır ve süzgeç hizası (kodlamada §4 kuralı).
- Prototip notları: Türkçe takma adlar yalnız prototipte. (Düzeltildi: klinikte sağlık personelinin yetki seti etiketi artık "Sağlık personeli"; `veri.js` klinik örneğinde p4 rolü `saglik`.)
- Son kontrol: frontend engelleri E1–E5 ve ucuz N maddeleri düzeltildi (`bulgu-yanitlari.md` "Son kontrol yanıtları"); frontend-gelistirici'ye yeniden görüntüleme için [DÜZELTİLDİ] gönderildi. Sonuç bekleniyor.
- Prototip tarayıcıda tasarımcı tarafından açılmadı; görsel kontrol frontend-gelistirici ekran görüntüleriyle yapıldı. Tur 2 düzeltmelerinin görüntüsü alınmadı.


## Kod tarafı notları

- 2026-10-29, frontend-gelistirici (W2): tasarim.md §3.1 kontrast tablosundaki iki değer gerçek WCAG hesabından biraz yüksek yazılmış. `--color-on-primary` / `--color-primary` (beyaz / #1F3E47) gerçekte 11,42:1 (belge 11,6). `--color-warning-text` / `--color-warning-bg` (#7A4B07 / #FDF3DC) gerçekte 6,71:1 (belge 6,9). Diğer satırlar belgedeki değere 0,3 içinde. Hepsi 4,5:1 eşiğinin üstünde, token düzeltmesi gerekmiyor; yalnız belge sayıları düzeltilmeli. Kod tarafı kontrast birim testi: apps/web/src/styles/tokens.test.ts (tolerans 0,3).
- 2026-10-29, frontend-gelistirici (W2): yazı tipi dosyaları CSS @font-face ile yerelden yüklenir (next/font/local yerine; unicode-range ve Google isteği olmaması için). Hanken Grotesk değişken woff2 400-600 (latin, latin-ext); ₺ yalnız Inter latin-ext dosyasından (U+20BA). tasarim.md §3.2 "next/font/google" ifadesi üretim için güncellenmeli.
