# BeautyOS tasarım incelemesi — frontend-gelistirici

- **Tarih:** 2026-10-28 · **İncelenen:** `docs/tasarim.md` v0.9 + `docs/tasarim/prototip/` (`panel.html`, `tokens.css`, `bilesenler.css`, `prototip.js`, `panel.js`, `panel-ek.js`)
- **Yöntem:** Belgeyi tam okudum. Prototipi Edge headless ile açtım (salt okunur kopya `C:\Users\pc\AppData\Local\Temp\hk\p2`, proje dosyasına dokunulmadı). Beş istenen ekranın 390/768/1440 px görüntülerini aldım. 16 panel rotası için 390 ve 768 px'te DOM denetimi çalıştırdım: yatay taşma, h1 sayısı, etiketsiz kontrol, dokunma hedefi, 12 px altı yazı. Hanken Grotesk dosyasını indirip glif tablosunu ve rakam genişliğini ölçtüm. Kontrast değerlerini hesapladım.
- **Kapsam dışı:** `randevu-al`, `giris`, `tanitim`, `yonetici`, `sistem` yüzeyleri henüz çizilmedi, incelenmedi. Klinik modu ve rol değiştirici yalnız belge düzeyinde okundu.
- **Ekran görüntüleri:** `docs/tasarim-girdisi/ekran-goruntuleri/` içinde `<ekran>-<390|768|1440>.png` (bugun, takvim-28, randevu-yeni, musteri-m1, kasa) + `bugun-390-tam.png` (uzun sayfa). 390 px görüntüleri 390 px genişliğinde bir iframe'in 600 px'lik tuvale alınmış hâlidir (headless Edge 500 px altında pencere açmıyor); sağdaki gri alan tuvaldir, ürün değil. Hepsi `?yalin=1` ile prototip çubuğu gizlenerek alındı.

## Özet karar

Tasarım dili uygulanabilir ve sistemli; token katmanları, durum etiketleri, ölçekler ve katman davranışı koda çevrilmeye hazır. **Kodlamaya başlamadan önce kapanması gereken 3 konu var:** (1) personel sütunlu takvimin FullCalendar ile yapılabileceği varsayımı büyük olasılıkla yanlış, (2) ₺ simgesi seçilen yazı tipinde yok, (3) kod adlandırma kuralı ile Türkçe token adları çakışıyor. Ayrıca prototipte 1 görünür hata ve birkaç kontrast/dokunma hedefi sorunu var. Hanken Grotesk sorusu (3. istek) olumlu: yedeğe gerek yok.

---

## A. Doğrulamalar (tasarımcının istediği)

### A1. Hanken Grotesk `tabular-nums` — yedek Inter gerekmiyor
Google'ın servis ettiği Hanken Grotesk 400 ve 600 TTF'lerini indirip Edge'de ölçtüm (40 px):

| Metin | 400 normal | 400 `tabular-nums` | 600 normal | 600 `tabular-nums` |
|---|---|---|---|---|
| `1111` | 89,6 | 89,6 | 89,6 | 89,6 |
| `0000` | 89,6 | 89,6 | 89,6 | 89,6 |
| `8888` | 89,6 | 89,6 | 89,6 | 89,6 |

`tabular-nums` genişliği değiştirmiyor çünkü **rakamlar zaten varsayılan olarak eşit genişlikte** (GSUB özellikleri: `ccmp, dnom, frac, liga, locl, numr`; `tnum` yok). Sonuç: `.sayi { font-variant-numeric: tabular-nums }` zararsız ve tablo sütunları hizalı kalıyor, ama tasarım belgesindeki "tnum desteği" ifadesi yanlış kurulmuş; belgede "rakamlar varsayılan olarak eşit genişlikli" yazmalı. Yedek aile gerekmiyor.
`ı İ ğ Ğ ş Ş ç Ç ö Ö ü Ü – … ’ “ ”` fontta var.

### A2. **₺ simgesi (U+20BA) Hanken Grotesk'te yok** — Yüksek
Aynı dosyanın `cmap` tablosunda U+20BA bulunmuyor. Prototipteki her para tutarında "₺" sistem yazı tipinden (Windows'ta Segoe UI) geliyor; rakamlar Hanken, simge başka aile. Görüntülerde fark ince ama kalın (600) tutarlarda ağırlık ve genişlik uyuşmuyor; Android/iOS'ta yine başka aile olacak. Tasarım belgesi para biçimini `Intl.NumberFormat('tr-TR', currency TRY)` ile üretiyor, yani ₺ her zaman metne giriyor.
- **Öneri 1 (tercih):** ₺ için küçük bir ikinci yazı tipi: Inter'in `latin-ext` alt kümesini `unicode-range: U+20BA` ile yedek olarak yığına koymak (tek glif, birkaç yüz bayt). Yığın: `Hanken Grotesk, Inter, system-ui…`.
- **Öneri 2:** Para simgesini 600 ağırlıkta tasarımcının seçtiği başka bir aileden çizmek. Bu, Öneri 1'in aynısı; ailenin ağırlık ölçüsüne bakarak tasarımcı seçer.
- Karar tasarımcıda; ben uygulamada iki `next/font` ile kurarım. Para alanları için görsel doğrulama ekran görüntüsü karşılaştırması gerekir.

### A3. Tailwind v4 aktarımı (§3, §11) — uygulanabilir, 5 düzeltmeyle
İki katmanlı yapı (ham + anlamsal) ve `@theme inline` eşlemesi doğru yaklaşım; `ekran-envanteri.md` §6 ile uyumlu. Notlar:
1. **Adlandırma çakışması (Orta):** `kod-standartlari` "kod, değişken ve fonksiyon adları İngilizce" diyor. `--color-zemin`, `bg-zemin`, `text-metin-soluk`, `--radius-etiket`… Türkçe sınıf adları bu kurala aykırı. Öneri: prototipin Türkçe adları **tasarım belgesinde ve `tokens.css` prototipinde kalsın**, kod tarafında İngilizce karşılık (`surface`, `canvas`, `line`, `fg`, `fg-muted`, `primary`, `accent`, `danger`, `focus`) kullanılsın ve belgeye bir eşleme tablosu eklensin. Müdür/tasarımcı karar versin; Türkçe kalacaksa kurala bilinçli istisna yazılmalı.
2. **Ad alanı:** `@theme` yalnız `--color-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--spacing-*` isim alanlarından yardımcı sınıf üretir. `--renk-*` doğrudan sınıf olmaz; `@theme inline { --color-surface: var(--renk-yuzey); … }` şart. Yaklaşık 45 eşleme satırı. `--yaricap-*` → `--radius-*`, `--golge-*` → `--shadow-*`, `--yazi-*` → `--text-*` olarak yeniden adlandırılmalı; `--bosluk-*` gerekmez (Tailwind v4 varsayılan 4 px adımı aynı; yalnız 52/76 px gibi tek seferlik ölçüler isteğe bağlı değer).
3. **Koyu tema değişkeni:** `[data-tema="koyu"]` kalabilir; v4'te `@custom-variant dark (&:where([data-tema="koyu"], [data-tema="koyu"] *));` ile `dark:` kullanılabilir ama anlamsal tokenlar zaten çözdüğü için bileşenlerde `dark:` hiç gerekmez. Mevcut `<head>` betiği ve `beautyos-theme-v2` anahtarı bu yapıya uyarlanır.
4. **Durum ve kişi tonları** `data-durum` / `data-kisi` ile `--k-z/--k-m/--k-i` değişkenlerini atama kalıbı (prototipte `.takvim__olay`) doğrudan taşınabilir: iyi bir kalıp. Tailwind tarafında `data-[durum=bekliyor]:` varyantlarına gerek yok, CSS katmanında tutulur.
5. **`bilesenler.css` (39 KB) olduğu gibi kopyalanmaz.** Bileşen bileşen `components/ui/*` içinde yeniden kurulur (`Button`, `Field`, `Chip`, `StatusBadge`, `Sheet/Dialog`, `Tabs`…). Sınıf adları referanstır. Kapsam büyüklüğü için DURUM.md'ye işlenebilir.

### A4. Ekran görüntüleri
15 görüntü + 1 uzun sayfa kaydedildi (yukarıdaki yol). Tasarımcıya bildirilecek.

---

## B. Bulgular

Önem: **Kritik** (yapılamaz/yanıltıcı) · **Yüksek** (kodlamayı veya kullanıcıyı ciddi etkiler) · **Orta** · **Düşük**.

### B1. Personel sütunlu takvim FullCalendar ile yapılamaz görünüyor — **Yüksek (uygulanabilirlik)**
`tasarim.md` §4 "Takvim" satırı: "FullCalendar korunup bu görünüme çekilebilir (frontend kararı)." Tasarlanan masaüstü görünüm **personel başına sütun** (Derya, Elif, Zeynep, Merve) içeren gün ızgarası. FullCalendar'da bir günü kaynak (kaynak = personel) sütunlarına bölmek `resource-timegrid` eklentisidir ve bildiğim kadarıyla bu eklenti ücretli "Scheduler" paketindedir (ticari lisans anahtarı ister). Projede yalnız ücretsiz çekirdek paketler kurulu (`core`, `daygrid`, `timegrid`, `interaction`, `react`). Lisans metnini internetten doğrulamadım; kurucu/müdür satın alma kararı gerektiği için ayrıca teyit edilmeli (para konusu).
- **Önerim:** Takvimi **kendi CSS Grid bileşenimiz** olarak yazmak. Tasarımın istediği zaten sınırlı: gün/hafta özeti, personel sütunları, 72 px/saat, 15 dk boş dilim tıklaması, şimdi çizgisi, 30 dk üstü etkinlik kutusu. Çakışma yerleşimi personel sütunu içinde tek şeritli (aynı personele çakışan randevu API'de engellenir: `SLOT_CONFLICT`). Maliyeti tahminen 2-3 gün; FullCalendar'ın 4 paketi ve 100 KB'a yakın JS bağımlılığı kalkar, tasarım birebir uygulanır.
- **Sürükle-bırak:** Tasarımda "Randevuyu sürükleyerek taşıyabilirsiniz" notu var. Kendi takvimimizde bu işaretçi olaylarıyla ayrı bir iştir (dokunmatikte uzun basma, kaydırma çakışması). **Müdür kararı: sürükle-bırak ilk sürümde olacak** (brif #3, işlev kaybolmaz). Kabul ölçütü ve ek süre `ekran-envanteri.md` §10'da.
- Telefon görünümü (saat çizelgesi, tek sütun) FullCalendar `timeGridDay` ile zaten karşılanabilir ama iki farklı takvim motoru kullanmak tutarsız olur; ikisi de kendi bileşenimiz olmalı.
- Tasarımcıdan istek: belgede "FullCalendar korunabilir" cümlesini "kendi bileşenimiz" olarak düzeltsin; veri akışı notu ekleyin: görünen aralığa göre `GET /appointments?dateFrom&dateTo` (hafta = 7 gün × yoğun salon, `limit` üst sınırı 100; B1 backend uyarısı bkz. `ekran-envanteri.md` §7.2).

### B2. Takvimde seçili gün kutusu boş görünüyor — **Yüksek (görünür hata)**
`takvim/28`: 28 Ekim kutusu koyu, içindeki "Çar / 28" **görünmüyor** (390, 768 ve 1440 px'in üçünde de). Neden: `panel.js` satır 255'te `<a class="gun" … style="text-decoration:none;color:inherit;…">` satır içi `color:inherit`, `bilesenler.css:299` içindeki `.gun[aria-pressed="true"] { color: var(--renk-metin-ters) }` kuralını ezip yazıyı koyu zeminde koyu renkte bırakıyor. **Düzeltme:** satır içi `color:inherit` ve `text-decoration` kaldırılsın, `.gun { color: inherit; text-decoration: none }` sınıfa alınsın (seçili kural sonra gelir). Aynı kalıp `?ac=randevu-yeni` içindeki 14 günlük şeritte (`panel.js:329`) ve saat değiştirme katmanında (`panel.js:439`) da var; `data-tekli` varyantında `<button>` olduğu için etkilenmeyebilir, doğrulayın.

### B3. Geçmiş randevu kartlarında kontrast AA'nın altında — **Yüksek**
Tamamlanan randevular `opacity: .62` ile soluklaştırılıyor (`.takvim__olay--bitti`; mobilde liste kartlarında benzeri). Opaklık tüm kutuyu (metin dahil) zemine karıştırdığı için hesapladığım etkin kontrast: kişi tonu metni 3,28:1, ikincil/solgun satır **2,29:1**, durum etiketi 3,68:1. Hepsi 4,5:1'in altında; `tasarim.md` §10 "tüm metin ≥4,5:1" diyor. `1440` görüntüsünde "Aylin Yıldız / Burcu Demir" satırları okunaksız. **Öneri:** opaklık yerine "tamamlandı" için ayrı, doygunluğu düşük ama kontrastı ≥4,5 olan `--kisi-N-bitti-z/m` değerleri; ayrım metin ağırlığı, sol şerit tonu ve etiketle verilsin. `doluluk__blok--bitti` (.55) yalnız grafik işareti, dekoratif sayılabilir.

### B4. Kısa randevu kutularında metin kırpılıyor — **Orta**
Takvim 1440: 72 px/saat ile 30 dk randevu 36 px; içinde ad + saat + hizmet üç satır sığmıyor. "Nur Tekin" ve "Melis Er" üst yarıdan kesik, "15:30 – 16:00 · Fön" okunmuyor; Merve sütunundaki son kutuda yalnız bir kırpık satır var. Üstelik "09:00" saat etiketi ızgaranın üst kenarında yarım kesik. **Öneri:** süre < 45 dk ise tek satır düzeni ("Nur Tekin · Fön · 10:00"), < 30 dk ise yalnız ad; kutu `title`/`aria-label` zaten tam cümle taşıyacak. Saat etiketi `transform: translateY(-50%)` ile kenara taşırmak yerine ilk satıra iç boşluk. 15 dk dilimde 18 px'lik kutu hiç okunmaz; en küçük kutu yüksekliği 24 px olsun.

### B5. Telefonda "Şimdi ve sırada" satırında müşteri adı kırpılıyor — **Yüksek (ana ekranın ana bilgisi)**
`bugun-390.png`: satır = avatar + (saat · ad / hizmet) + durum etiketi + eylem düğmesi. Durum + düğme yaklaşık 170-210 px yer kaplıyor, ad için ~90 px kalıyor: "Gizem Koç → '…'", "Hande Polat → 'Hand…'", "İrem Bulut → 'İrem …'", "Seda Kılıç → 'Seda …'". Brif: resepsiyonun "kim sırada?" sorusu. **Öneri:** telefonda durum etiketi ikinci satıra ("Ombre ve balyaj · Derya · Devam ediyor") ya da yalnız eylem düğmesi sağda, durum etiketi masaüstüne. Ad en az iki kelime tam görünmeli (satır ≥56 px yüksekliğe izin verir).
Aynı ekranda "Personelin günü" etiketi "Zeyn…" (Zeynep) kırpılıyor (hem 390 hem 1440): etiket sütunu en az 88 px olsun ya da ad şeridin üstüne gelsin.

### B6. Dokunma hedefleri brifin 44 px kuralından küçük — **Orta**
Kural: "en az 44 px" (brif §tasarım kuralları, `tasarim.md` §1). Denetimde (headless Edge ince işaretçi, yani `pointer: fine`) gördüklerim; dokunmatikte `coarse` kuralları bazılarını düzeltiyor ama:
- `.parcali button` (Bugün/Bu hafta/Bu ay, Kasa ve Raporlar dönem seçici): `min-height: 38px`, `coarse` için kural yok (390 px'te 38 px).
- `.cip` (personel çipleri): `coarse`'ta 40 px, 44 değil.
- Kart başlığındaki metin bağlantıları ("Takvim", "Tümü", "Düzenle") 20 px yüksekliğinde; WCAG 2.5.8'in 24 px asgarisinin de altında. Çevresine dolgu (`padding-block: 12px`) verilmeli.
- `.dugme--kucuk` "Tamamla / Başlat / Gözden geçir" ince işaretçide 36 px (kabul, masaüstü); dokunmatikte 44 (iyi).
Hepsi tek CSS düzeltmesi; tasarım belgesi §3.3 "kontrol 44 px (fare olan masaüstünde 36)" ifadesi `parcali`, `cip` ve metin bağlantılarına da uygulanmalı.

### B7. `aria-pressed` bağlantılarda geçersiz — **Orta (erişilebilirlik)**
`.gun` öğeleri `<a href>` ve `aria-pressed` taşıyor; `aria-pressed` yalnız düğme rolüne tanımlı. Gezinen tarihler için doğru öznitelik `aria-current="date"` (zaten var), `aria-pressed` kaldırılmalı; CSS seçicisi `[aria-current="date"]` olmalı (B2 düzeltmesiyle birlikte).

### B8. Günün özeti dört sütunda hizasız ve sıkışık — **Orta**
`bugun-1440`: Randevu sütunu 5 satıra sarıyor ("7 tamamlandı · geçen çarşamba 15", dar sütun) ve değerler (17, ₺9.150, ₺11.900, %42) farklı yüksekliklerde. `ozet__alt` metinleri sütun genişliğine göre sarıyor, `align-items: center`. **Öneri:** değerler aynı üst hizada (`align-content: start`), alt satır tek satır ve `text-wrap: balance`; "geçen çarşamba 15" birimsiz (neyin 15'i?), "geçen çarşamba 15 randevu" gibi tam hâli. (Metin: `teknik-yazar`.) Ayrıca iki Müşteri kartı özeti (390): üç metrik 2+1 yerleşiyor ve "Cari bakiye" tek başına kalıyor; 3 sütun `minmax(0,1fr)` ile sığar (her biri ~110 px).

### B9. Sahip için "Günün özeti" 390 px'te listenin altında/görünmüyor — **Orta (doğrulayın)**
`bugun-390-tam.png`: sırayla bulgu şeridi → Şimdi ve sırada → Personelin günü → Günün randevuları (17 satır). "Günün özeti" (tahsilat, beklenen, doluluk) ilk 2300 px içinde yok. Belgede telefon sırası tanımlı değil. Sıra bilinçliyse belgeye yazılsın; değilse en az tahsilat satırı üstte olmalı. Ayrıca 17 randevunun ilk 9'u tamamlanmış olduğundan sayfada aşağı kaydırmadan "sıradaki" iş görünmüyor; varsayılan süzgeç "Kalanlar" (tamamlananlar çipte) olursa Bugün ekranı gün boyu kısa kalır.

### B10. Telefonda müşteri kartı başlık eylemleri satıra sarıyor, sekmeler kırpık — **Düşük**
`musteri-m1-390`: "Randevu oluştur" + "Ara" yan yana, "WhatsApp" alt satıra düşüyor (boş sağ yarı). Sekmelerde "Fotoğrafl…" yarım kesik: kaydırma işareti yok (kenar solması/gölgesi). Öneri: Ara ve WhatsApp ikon düğmesi (44×44, `aria-label`) yap, tek satır; sekme şeridine sağ kenar solması.

### B11. Bileşenin uygulanabilirliği — iyi olanlar (kısa)
- **Katman:** `role="dialog" aria-modal`, odak tuzağı, Esc, odak iadesi, alt sayfa/diyalog ikili davranışı kodda (`prototip.js:139-166`). Radix `Dialog` ile aynı davranış; yeni `Sheet` bileşeni Radix üzerine kurulur (mobilde alt, ≥768'de ortada), el yapımı kod yazılmaz.
- **Bildirim** `role="status"` canlı bölge: iyi. Radix Toast zaten `aria-live`.
- **Sekmeler** ok tuşlarıyla (`prototip.js:233`): Radix Tabs ile karşılanır (bağımlılık kurulu).
- **Form alanı:** etiket + hata `role="alert"` + `aria-describedby` kalıbı `Field` bileşeni olarak birebir kurulur.
- **DOM denetimi (16 rota, 390 ve 768 px):** yatay taşma **0**, her rotada tek `h1`, **etiketsiz kontrol 0**, **12 px altı yazı yalnız** takvim çiplerindeki avatar baş harfleri (10 px "DA/EŞ/ZA/MÇ", dekoratif; `aria-hidden` ise sorun değil). Bu kalite referans alınacak düzeyde.

### B12. Tanıtım sitesinde canlı iframe — **Orta (uygulama kararı)**
§2.2: ürün görselleri `panel.html?yalin=1#bugun` iframe'i. Üretimde tanıtım sayfasına çalışan panel parçası gömmek ilk boyama ve JS maliyetini (iframe başına 270 KB+ betik, yazı tipi, kendi rota sistemi) sayfaya yükler ve CSP/`X-Frame-Options` kararlarıyla çakışır. **Öneri:** üretimde iframe yerine yayın aşamasında alınmış statik ekran görüntüsü (AVIF/WebP, 1x/2x, `width/height` verili, `loading="lazy"`); brif #14 "gerçek ürün ekran görüntüleri" zaten bunu söylüyor. Hero'daki "boşluğa dokun" canlı öğesi için küçük, ayrı bir istemci adacığı (şeridin kendisi) yeterli. Tasarımcı bunu `tanitim.html` çizerken dikkate alsın.

### B13. Yazı tipi yükleme — uygulama notu (bilgi)
Prototip Google Fonts `<link>` kullanıyor. Uygulamada `next/font` (build zamanı indirir, kendi alan adından sunar, harici istek yok) ile `Hanken_Grotesk({ subsets: ['latin','latin-ext'], weight: ['400','500','600'], display: 'swap', variable: '--font-hanken' })` + A2'deki ₺ yedeği. Sunucu derlemesinde dış ağ yoksa `next/font/local` ile dosyalar depoya konur (kurucu kararı gerekmez; lisans OFL). Gövde 400, etiket 500, başlık/para 600 üç ağırlık yeterli; 700 kullanılmıyor, iyi.

### B14. Yeni API ihtiyaçları ile tasarım çelişkisi kontrolü (bilgi)
Tasarımın "Yakında" olarak işaretlediği şeyler `ekran-envanteri.md` §7.2 listesiyle örtüşüyor (B3-B5, B8, B10, B12). Prototipte "yakında" etiketi **olmadan** gösterilip bugün API'de karşılığı olmayan iki şey gördüm: (a) takvimde sürükle-bırak yok (B1), (b) Kasa "Günü kapat" akışındaki "kasa sayımı / fark nedeni" alanları (`POST /finance/close-day` yalnız `date` alıyor). §12 "backend gerektiren" listesinde "kasa sayımı alanı" var, yani biliniyor; ekranda da "Yakında" ya da gizli olmalı.

---

## C. Bulgu → sahip özeti

| # | Önem | Sahip | Eylem |
|---|---|---|---|
| A2 | Yüksek | ui-ux-tasarimci | ₺ için yedek yazı tipi kararı |
| B1 | Yüksek | ui-ux-tasarimci + müdür | takvim "kendi bileşenimiz"; sürükle-bırak ilk sürümde olacak (müdür kararı); takvim bileşeni kararı kurucuda |
| B2 | Yüksek | ui-ux-tasarimci | `.gun` satır içi `color:inherit` (görünmez gün) |
| B3 | Yüksek | ui-ux-tasarimci | geçmiş randevu opaklığı → ayrı kontrastlı token |
| B5 | Yüksek | ui-ux-tasarimci | telefonda Şimdi ve sırada adı + personel etiketi kırpması |
| B4, B6, B7, B8, B9 | Orta | ui-ux-tasarimci | kısa randevu kutusu, dokunma hedefleri, `aria-pressed`, özet hizası, telefon sırası |
| B10 | Düşük | ui-ux-tasarimci | müşteri kartı başlığı |
| A3-1 | Orta | ui-ux-tasarimci + müdür | token adı dili (Türkçe/İngilizce) |
| B12 | Orta | ui-ux-tasarimci | tanıtımda iframe yerine statik görüntü |
| Metin (B8, A1) | — | teknik-yazar | "geçen çarşamba 15" birimsiz; "boşluğa dokunun" jargon (→ "boş saate dokunun"); tarih biçimi iki yerde farklı ("12.09.2026" ↔ "28 Ekim"; kural belgesi `28.10.2026` / "28 Ekim"); `₺` biçimi rehber-Intl çelişkisi tasarımcı notuyla zaten bildirilmiş |

## D. Kontrol listesi durumu (frontend-gelistirici)
- Uygulanabilirlik: **şartlı olumlu** (B1 karara bağlanmalı).
- Token/Tailwind v4: **olumlu** (A3 notlarıyla).
- Bileşen tutarlılığı: **olumlu**; durum etiketi, kart, satır, katman tek kaynak.
- Erişilebilirlik: yapısal olarak güçlü (B11); B2, B3, B6, B7 düzeltilmeli.
- Durumlar (yükleniyor/boş/hata/yetkisiz): belgede ve prototipte (`?durum=`) var; bu turda yalnız `normal` durum görüntülendi, diğer durum görüntüleri alınmadı.
- Performans: prototip kod olmadığı için ölçülmedi; B12/B13 uyarıları ve takvimde bağımlılık azalışı (B1).
- Yüzeyler: 5 yüzeyden yalnız panel çizildi; kalan 4 yüzey geldiğinde ikinci tur incelemeye hazırım. (Tur 2 aşağıda.)

---

# Tur 2 (2026-10-28, `bulgu-yanitlari.md` + yeni yüzeyler)

İncelenen: `tasarim.md` §3, `bulgu-yanitlari.md`, `panel.html`, `randevu-al.html`, `giris.html`, `tanitim.html`, `yonetici.html`, `sistem.html` (salt okunur kopya). Yeni görüntüler `ekran-goruntuleri/` altında (390 ve 1440): `randevu-al-zaman`, `giris-kayit-2`, `tanitim` (tam sayfa; `tanitim-390-ust/orta` 1700 px'lik kesitler), `yonetici-salonlar`, `estetik-uzman-musteri-m3` (uzmanın kendi hastası), `estetik-uzman-yetkisiz-m1` (başkasının hastası: yetkisiz durumu), `takvim-28-tur2`, `bugun-tur2`. 390 px görüntülerdeki sağ gri alan tuvaldir.

## T2-A. Tur 1 düzeltmelerinin doğrulaması

| # | Sonuç | Kanıt |
|---|---|---|
| B2 seçili gün | **Kapandı** | `takvim-28-tur2-1440.png`: "Çar 28" okunuyor (`a.gun` kuralı + `aria-current="date"`) |
| B3 geçmiş randevu kontrastı | **Kapandı** | opaklık kalktı, `--color-past-bg/-text` (gri-25 zemin, gri-700 metin); görüntüde okunur |
| B4 kısa kutu | **Kapandı** | ≤30 dk tek satır ("10:00 Nur Tekin", "15:30 Melis Er"); "09:00" etiketi artık kesik değil |
| B5 telefonda Şimdi ve sırada | **Kısmen** | Ad tam görünüyor. Ama (1) ikinci satır hâlâ kırpılıyor ("Ombre balyaj · Derya · 1…"); (2) **"Zeyn…" kırpılması düzelmedi**, panelde (`bugun-tur2-390`) ve tanıtım hero parçasında (`tanitim-390-ust`) görünüyor; (3) durum etiketi ≤479 px'te gizlendi, "Devam ediyor" bilgisi yalnız eylem düğmesinden çıkarılıyor. WCAG 1.4.1 için satırın erişilebilir adında durum metni olmalı, doğrulayın |
| B6 dokunma hedefi | **Kısmen** | CSS'te `coarse` için `.parcali button, .cip, .dugme--metin, .yan-menu a` ve `.dugme--kucuk` 44 px (bilesenler.css:363). **Eksik:** kart başlığındaki düz bağlantılar (`<a class="metin-14">Takvim</a>`) `.dugme--metin` değil, 20 px kalıyor; giriş/randevu-al/tanıtım bağlantıları 16-26 px (`Ana sayfa` 61×20, `Şifremi unuttum` 99×18, `Aydınlatma metni` 93×16); randevu-al üst başlık düğmeleri 40 px. WCAG 2.5.8 (24 px) bile geçmeyenler var |
| B7 `aria-pressed` bağlantıda | **Kapandı** | `<a class="gun">` üstünde yok |
| A2 ₺ | **Doğrulandı** (T2-B) | |
| A3-1 İngilizce token adları | **Kapandı** | `tokens.css` `--ref-*`, `--color-*`, `--font-sans` |
| B8, B9, B10 | **Bekliyor** | `bugun-tur2-1440` özet hizası aynı |

## T2-B. ₺'nin Inter'den geldiği: doğrulandı
Edge'de 40 px ölçüm (aynı Google Fonts CSS): `₺` genişliği 400'de Inter-tek 23,78 = `"Hanken Grotesk", Inter` yığını 23,78; sistem yedeği (serif) 20,00, (monospace) 22,00. 600'de 25,13 = 25,13, sistem 20,00/22,00. `₺1.250` bütün ölçülünce Inter ₺ + Hanken rakam toplamıyla birebir (122,98). Yani ₺ yığındaki Inter'den çiziliyor. Yığın tanımı `tokens.css:65` doğru.
**Üretim notu:** prototip Inter'in 3 ağırlığını tüm glifleriyle yüklüyor; üretimde `unicode-range: U+20BA` ile tek glif yetmeli (birkaç KB). Bunun için `next/font/local` + kendi `@font-face` kullanırım.

## T2-C. Yeni yüzeylerde bulgular

1. **Randevu-al "değiştir ya da iptal et" doğrulamasız açılıyor, Yüksek (uyum + güvenlik).** `randevu-al.html#degistir` onay ekranından düz bağlantıyla açılıyor, doğrulama adımı yok. `hukuk-uyum` U5: bu sayfa yalnız tahmin edilemeyen, süreli bağlantıyla ya da telefon koduyla açılmalı. Bugünkü API'de yönetim ucu yok (`public.route.ts`: tenant, services, staff, slots, verify/send, verify/confirm, book). Yeni uç gerekir (imzalı süreli belirteç). Tasarımda doğrulama adımı çizilmeli. Mimar + gelistirici + ui-ux-tasarimci.
2. **Randevu-al'da bot koruması için yer yok, Orta.** Bugün `book` ucu Cloudflare Turnstile belirteci (`captchaToken`) bekliyor ve `verify/send` SMS gönderiyor. Tasarım CAPTCHA adımı çizmemiş. U7 (üçüncü taraf istek yok) Turnstile'ı da kapsıyor (`challenges.cloudflare.com`). Seçenekler: (a) Turnstile kalır, aydınlatma/çerez metnine yazılır, tasarımda adım çizilir; (b) Turnstile kalkar, SMS kötüye kullanımına karşı sunucu hız sınırı + SMS kotası + kendi basit meydan okuma. SMS maliyeti para konusu; karar mimar + hukuk-uyum + müdür.
3. **Giriş kayıt-2: bütün form çerçevesi odak halkası alıyor, Orta.** `giris-kayit-2-390.png`: "Hesap bilgileriniz" kartı petrol 2 px çerçeveli; sayfa değişince odak `tabindex=-1` kapsayıcıya gidiyor ve `:focus-visible` onu çiziyor. Odak h1'e ya da ilk alana verilmeli.
4. **Yönetici salon listesi: süzgeç satırında iki `select` hizasız, Düşük** (`yonetici-salonlar-1440.png`, ~8 px).
5. **Yönetici telefon (390): tablo satıra dönmüyor, Düşük.** Belgenin kendi kuralı "640 px altında tablolar satıra döner"; yatay kayıyor. Ya satıra dönsün ya "masaüstü için" notu olsun.
6. **Tanıtım, Orta.** Yapı sağlam: tek h1, taşma 0, canlı iframe yok (B12 kapandı). Kusurlar: (a) hero parçasında "Zeyn…" ve "Ombre balyaj…" kırpılması, vitrin görüntüsünde kırpık metin amatör görünür; (b) 1440 px'te bölümler arası boşluk çok büyük (sayfa 8070 px), "Günün tüm işi" parçaları sağa-sola dağılmış ve kasa parçası küçük/okunmaz; (c) 390 px'te iki CTA ("Ücretsiz deneyin", "Canlı demoyu aç") birbirini bastırıyor; (d) alt bilgideki `[TİCARİ ÜNVAN]`, `[VKN]` yer tutucuları yayından önce dolmalı (P14 kapısı); (e) "30 gün ücretsiz. Kart bilgisi istenmez." kurucu kararına (V1) bağlı.
7. **Estetik klinik + uzman rolü, olumlu.** Terimler doğru (Hastalarım, Günüm); başka hekimin hastası için "Bu sayfayı görme yetkiniz yok." + "Günüm'e dön" çıkışı var; sağlık sekmeleri hekime görünüyor, fotoğraf sekmesi yok. "Ara" + "WhatsApp" hâlâ iki satıra düşüyor (B10 bekliyor).
8. **Randevu-al `zaman`, olumlu (küçük not).** Adım göstergesi tutarlı, saat ızgarası 4 sütun, "Fark etmez" açıklaması net. `Ara`, `WhatsApp`, `Harita` düğmeleri 40 px: 44'e çıkarılsın.
9. **DOM denetimi (9 yeni sayfa, 390 px):** yatay taşma 0, her sayfada tek h1, etiketsiz kontrol 0, 12 px altı yazı yok.

## T2-D0. Güncelleme: hukuk-uyum görüşü (taslak)
- **C-1 daraldı:** doğrulama sonrası aynı oturumda onay ekranından `#degistir`'e gitmek sorun değil. Ölçüt sonraki erişimler için: SMS/e-posta bağlantısı ya da sayfa yeniden açıldığında süreli bağlantı ya da telefon kodu şart. Prototipteki akış bu hâliyle kabul; ama "sonraki erişim" yolu çizilmeli ve yönetim ucu (mimar) yazılmalı.
- **C-2 kapandı (karar):** Turnstile kalır, U7'ye istisna. Yalnız randevu (ve gerekiyorsa kayıt) sayfasında yüklenir. Tasarımda randevu-al'a bot doğrulama alanı çizilmeli. Müdür kararı gerekmiyor, mimara bilgi.

## T2-D. Uyum kabul ölçütleri (hukuk-uyum, taslak)
`hukuk-uyum` iki maddeyi kodlama kabul ölçütü olarak bildirdi (`inceleme-hukuk-uyum.md` U5, U7); `ekran-envanteri.md` §10'a eklendi. U7 üretimde Google Fonts/CDN/analitik/Turnstile gibi üçüncü taraf isteği yasaklar (yazı tipleri `next/font` ile kendi sunucumuzdan). U5 randevu yönetim sayfasının referans koduyla değil, süreli bağlantı/telefon koduyla açılmasını ister.

## T2-E. Bulgu → sahip (tur 2)
| Bulgu | Önem | Sahip |
|---|---|---|
| C-1 değiştir sayfası doğrulamasız | Yüksek | ui-ux-tasarimci (akış) + mimar/gelistirici (uç) + hukuk-uyum |
| C-2 bot koruması ↔ U7 | Orta | mimar + hukuk-uyum + müdür (SMS maliyeti) |
| B5 kalan, B6 kalan | Orta | ui-ux-tasarimci |
| C-3 kayıt-2 odak çerçevesi | Orta | ui-ux-tasarimci |
| C-6 tanıtım kusurları | Orta | ui-ux-tasarimci + pazarlama |
| C-4, C-5, C-8 | Düşük | ui-ux-tasarimci |

## T2-F. Kontrol listesi durumu
Uygulanabilirlik: şartlı olumlu (takvim bileşeni/lisans kararı hâlâ kurucuda). Token/Tailwind: olumlu. Erişilebilirlik: B6 kalanları ve C-3 kapanınca olumlu. Durumlar: yalnız normal ve yetkisiz görüntülendi; `?durum=` yükleniyor/boş/hata varyantları görüntülenmedi. `sistem.html` DOM denetiminden geçti, görüntüsü alınmadı.
