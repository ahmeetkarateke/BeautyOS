# BeautyOS — Tasarım belgesi

- **Sahibi:** ui-ux-tasarimci · **Sürüm:** 0.9 (inceleme için) · **Tarih:** 2026-10-28
- **Bağlayıcı kaynaklar (öncelik sırası):** `docs/tasarim-brief.md` (kurucu kararları 1–19, R1–R9, M1–M2, V1–V5, S1, K1–K6) → bu belge → impeccable → design-taste-frontend → frontend-design. Metin: `docs/tasarim-girdisi/metin-rehberi.md` (tek kaynak). Yetki: `roller-ve-akislar.md` §1.4 ve §8. Yasal: `yasal-ekran-gereksinimleri.md`. Vitrin içeriği: `tanitim-sitesi-icerik.md`.
- **Prototip:** `docs/tasarim/prototip/index.html` (tarayıcıda doğrudan açılır, derleme yok). Kalan iş ve ilerleme: `docs/tasarim/DURUM.md`.
- Bu belgedeki her ekran adı, `data-testid` ve durum metni prototiple aynıdır; frontend, test ve teknik yazar aynı kaynaktan çalışır.

---

## 1. Tasarım ilkeleri

1. **Telefonda tek elle iş biter.** 390 px önce. En sık iş (randevu oluşturmak) alt menünün ortasındaki tek düğmeyle açılır. Her birincil eylem başparmak bölgesinde (ekranın alt üçte biri) ya da sabit alt eylem çubuğundadır. Dokunma hedefi en az 44 px.
2. **Ekranın tek bir sorusu vardır ve en büyük blok onu cevaplar.** Bugün: "Sırada kim var, kimde boş yer var?" Kasa: "Kasada ne olmalı?" Müşteri kartı: "Bu kişi kim, ona ne yaptık?"
3. **Renk veride, krom sakin.** Marka petrolü tek birincil eylemde ve seçili durumlarda; pudra yalnız imza öğesinde (doluluk şeridi, "şimdi" çizgisi, devam eden randevu). Ekranın renkli alanı %3–10.
4. **Durum dürüsttür.** Sıfır sıfır yazılır, eksik veri gri tire; yüklenemeyen finans bloğu "₺0" göstermez, hata gösterir. Olmayan özellik "Yakında" etiketi taşır.
5. **Hata affeder.** Yıkıcı her işlem eylem adlı onay penceresi ister; geri alınabilen işlem (izin kaldırma, gider silme) 8 sn "Geri al" sunar. Tarayıcı `confirm()` yok.
6. **Tek set terim, tek ses.** Ekrandaki her kavram metin rehberi sözlüğünden ve işletme türünün terim setinden gelir (§9). "Siz" hitabı, cümle düzeni büyük harf, emoji yok.
7. **Sağlık verisi göz önünde durmaz.** Takvim, liste, kasa, bildirim önizlemesinde içerik yok; yalnız yetkili role içeriksiz "Sağlık notu var" işareti (klinikte resepsiyon bunu da görmez).
8. **Amatör iz yok.** Gradyan, cam efekti, parlama, ikon kutusu, emoji, sahte rakam, İngilizce/Türkçe karışık terim, 12 px altı yazı, markasız hata sayfası yok.

**Modlar (impeccable):** Panel, online randevu, giriş/kurulum, süper yönetici = **Operate**. Tanıtım sitesi = **Persuade**.

## 2. Seçilen yön ve gerekçe

### 2.1 Uygulama ekranları (Operate)
- **Kütüphane kaydı:** `library/app.json` → stil **`accent-ladder`** (marka tonu tam hâliyle yalnız küçük işaretlerde, açık tonlarıyla alanlarda), kabuk **`open-plane`** (masaüstünde zemin renginde etiketli yan menü; telefonda alt menü).
- **Değerlendirilen üç stil:** `accent-ladder` (seçildi: küçük işletme yönetimi + markanın iki rengini taşıyor), `framed-sheet` (elendi: çerçeve tonu telefonda kayboluyor, 4 katman iç içe), `achromatic-ledger` (elendi: kromda hiç renk yok; kurucu kararı 8 "mevcut renklerden geliştir" ile çelişir).
- **Yüzü (§2.3 "its face"):** markanın petrolü birincil eylemde ve aktif menüde; pudra tonu zemine bir adım karışmış (`#F6F4F3`), kartlar beyaz.
- **İmza öğesi:** **"Personelin günü" doluluk şeridi.** Her personel için 09:00–20:00 yatay şerit; dolu dilimler kişinin kimlik tonunda, onay bekleyen kesikli, devam eden dolu işaret renginde; pudra "şimdi" çizgisi. Boşluğa dokunmak o kişi ve o saatle randevu açar. Fikir cümlesi: *Salonun kâğıt randevu defteri, personel sütunlu canlı bir şeride dönüşür.* Resepsiyonun en sık telefon sorusu ("Bugün yeriniz var mı?") ilk ekranda cevaplanır.
- **Rakip testi:** Ekran adı ve verisi silinse de "personel şeritli gün + şimdi çizgisi + şu an boş olanlar cümlesi" bir randevu defterini anlatır; şablon KPI kartları + grafik değildir.

### 2.2 Tanıtım sitesi (Persuade)
- **Kütüphane kaydı:** `library/directions.json` → **`product-performs`** ("ürün sahnede çalışır"). Değerlendirilen: `quiet-instrument` (elendi: aşırı sessiz, ürün resmi küçülür), `colour-chapters` (elendi: renk bölümleri ürünü değil süsü öne çıkarır).
- **Palet oranı:** `library/palettes.json` → **`blush-aubergine`** oranları (iki renk, birbirinin zemini ve mürekkebi); renkler markadan: petrol alan + pudra alan, beyaz ürün parçaları. `--keep palette,type` kuralı: marka renkleri korunur, yalnız oran alınır.
- **Yazı:** `library/type.json` → **`hanken-medium`** (Hanken Grotesk 400/500; başlık 500, gövde 400). Uygulamayla aynı aile.
- **Fikir cümlesi:** *Bu sayfada salonun bir günü (Defne Güzellik Salonu, 28 Ekim) gerçek, çalışan bir panel parçası olarak sahnelenir.* Ürün görselleri prototipin kendi ekranlarıdır (`panel.html?yalin=1#bugun` vb. iframe; `data-ui` kökü), sahte tarayıcı çerçevesi ya da gri çubuklu pano yoktur.
- **Canlı öğe:** Hero'daki "Personelin günü" şeridinde ziyaretçi bir boşluğa dokunur, "Randevu oluştur" alt sayfası gerçek akışla açılır.

## 3. Görsel kurallar ve tokenlar

Kaynak dosya: `prototip/tokens.css`. **Adlandırma (müdür kararı): değişken adları İngilizce**, açıklamalar Türkçe. İki katman: **ham** (`--ref-petrol-*`, `--ref-powder-*`, `--ref-gray-*`, `--ref-green/amber/red-*`) ve **anlamsal** (`--color-*`, `--status-*`, `--person-*`, `--brand-booking*`, `--font-*`, `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--size-*`, `--duration-*`). Bileşenler yalnız anlamsal tokenı kullanır. Prototipin Türkçe sınıf dosyası için `tokens.css` sonunda Türkçe takma adlar (`--renk-zemin` → `--color-page` …) vardır; **üretime taşınmaz**. Aşağıdaki tabloda eski Türkçe adın karşılığı: `--renk-zemin`=`--color-page`, `--renk-yuzey`=`--color-surface`, `-ikincil`=`-subtle`, `-aktif`=`-active`, `--renk-cizgi`=`--color-border`, `-hafif`=`-subtle`, `--renk-kontrol-cizgi`=`--color-border-control`, `--renk-metin`=`--color-text`, `-ikincil`=`-secondary`, `-soluk`=`-muted`, `--renk-birincil*`=`--color-primary*`, `--renk-vurgu*`=`--color-accent*`, `--renk-odak`=`--color-focus`, başarı/uyarı/hata/bilgi = `success/warning/danger/info`, `--durum-*`=`--status-*`, `--kisi-N-z/m/i`=`--person-N-bg/text/mark`. Tamamlanmış randevu artık opaklıkla değil `--color-past-bg/-text` ile çizilir (frontend B3). **Koyu tema:** çizilmez (kurucu 13); yalnız `[data-tema="koyu"]` altında anlamsal tokenlar yeniden atanarak eklenir. Bugünkü tema anahtarı gizlenir (yarım koyu tema amatör görünür).

### 3.1 Renk (açık tema)

| Token | Değer | Kullanım | Kontrast |
|---|---|---|---|
| `--renk-zemin` | `#F6F4F3` | Sayfa zemini, yan menü | — |
| `--renk-yuzey` | `#FFFFFF` | Kart, liste, form, katman | — |
| `--renk-yuzey-ikincil` | `#FAF9F8` | Anahtar-değer kuyusu, satır üzerine gelme | — |
| `--renk-yuzey-aktif` | `#EEEBEA` | Basılı/seçili zemin, parçalı seçim izi | — |
| `--renk-cizgi` | `#E4E0DE` | Kart kenarı, ayraç | 1,3:1 (dekoratif) |
| `--renk-cizgi-hafif` | `#EEEBEA` | Satır ayracı | — |
| `--renk-kontrol-cizgi` | `#9A9391` | Input/select/onay kutusu kenarı | 3,0:1 beyazda (WCAG 1.4.11) |
| `--renk-metin` | `#14262C` | Gövde, başlık | 15,9:1 |
| `--renk-metin-ikincil` | `#45545B` | İkincil metin | 7,8:1 |
| `--renk-metin-soluk` | `#5F6B72` | Yardım, meta, yer tutucu | 5,3:1 beyaz · 4,8:1 zemin |
| `--renk-birincil` | `#1F3E47` | Tek birincil eylem, seçili | 11,6:1 (beyaz metinle) |
| `--renk-birincil-hover` / `-basili` | `#183239` / `#11242A` | Üzerine gelme / basma | — |
| `--renk-birincil-hafif` + `-metin` | `#EEF4F5` + `#183239` | Aktif menü satırı, seçili kart | 11:1 |
| `--renk-vurgu` | `#E89B96` | Yalnız dolgu (şerit, logo yayı) | metin için kullanılmaz (2,2:1) |
| `--renk-vurgu-isaret` | `#C4615A` | "Şimdi" çizgisi, devam eden randevu kenarı | 4,0:1 (grafik ≥3:1) |
| `--renk-vurgu-metin` | `#A84A44` | Pudra ailesinde metin | 5,6:1 |
| `--renk-odak` | `#2B5562` | Odak halkası 2 px + 2 px boşluk | 7,8:1 |
| Başarı | `#1E6B45` / zemin `#E3F3EA` / metin `#0F3D26` | | 6,4:1 |
| Uyarı | zemin `#FDF3DC` / kenar `#EBC77A` / metin `#7A4B07` | | 6,9:1 |
| Hata | `#B3261E` / zemin `#FDECEA` / metin `#7A1A14` | | 6,6:1 |
| Bilgi | zemin `#EEF4F5` / metin `#183239` | | 11:1 |

**Randevu durumları** (her biri metin + nokta; yalnız renkle verilmez): Bekliyor `amber`, Onaylandı `petrol-50`, Devam ediyor `pudra-100` (+ pudra kenar), Tamamlandı `yeşil-50`, İptal edildi `gri-100` (+ üstü çizili ad), Gelmedi `kırmızı-50`.

**Personel kimlik tonları** `--kisi-1…5` (zemin/metin/işaret üçlüsü; pudra, adaçayı, gök, kehribar, taş; komşu tonlar ≥60° ayrı). Kimliktir, veri değildir: avatar, takvim sütunu, şerit dilimi. Altıncı kişiden sonra döngü + baş harf ayrımı.

**Mor `#6B48FF`:** ürün kromundan çıkarıldı (şirket ev kuralı: mor/çivit vurgu yok; brifin "yola çıkarak geliştirilir" kararı içinde). Yalnız online randevu sayfasında salonun seçebileceği renklerden biri olarak kalır (beyaz metinle 5,0:1). **Kurucuya bilgi:** bu bilinçli bir sadeleştirmedir.

### 3.2 Yazı
- **Aile:** Hanken Grotesk (Google Fonts; `latin` + `latin-ext` alt kümeleri, ı İ ğ Ğ ş Ş ç Ç ö Ö ü Ü tam). Tek aile, uygulamada `next/font/google` ile `subsets: ['latin','latin-ext']`, `display: 'swap'`. Yedek yığın: `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`.
- **Rakamlar:** Hanken'in rakamları zaten eşit genişlikte (frontend ölçtü); `tabular-nums` yine de para, saat ve tablo sütunlarında yazılır (`.sayi`).
- **₺ (U+20BA):** Hanken Grotesk'te yok. Yığın `"Hanken Grotesk", "Inter", system-ui…`; Inter (latin-ext) yüklenir ve ₺ her tutarda Inter'den gelir. Üretimde Inter yalnız `unicode-range: U+20BA` ile tek glif için yüklenebilir (frontend kararı). **Üretimde yazı tipleri kendi sunucumuzdan sunulur** (üçüncü taraf istek yok; hukuk-uyum U7); prototip kolaylık için Google Fonts kullanır.
- **Ölçek (px / satır):** 12/16 meta · 14/20 gövde masaüstü, tablo · **16/24 gövde telefon ve tüm inputlar** (iOS yakınlaştırması olmaz) · 20/28 bölüm, para özeti · 24/32 sayfa başlığı (h1) · 32/40 yalnız giriş/kurulum başlığı ve tanıtım h2 · tanıtım h1 `clamp(40px, …, 76px)`. 12 px altı yok.
- **Kalınlık:** 400 gövde, 500 etiket/düğme/menü, 600 başlık ve para. 700 kullanılmaz.
- Başlıklarda `text-wrap: balance`, paragraflarda `pretty`. Büyük harfli izli etiket yok.

### 3.3 Aralık, köşe, gölge, hareket
- **Aralık (4 px taban):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128. Telefonda kenar boşluğu 16; masaüstü içerik 28×32; kart iç boşluğu 16; bloklar arası 16 (telefon) / 24 (masaüstü). İçerik en fazla 1200 px.
- **Köşe (sıkı çift):** etiket 4 · kontrol 6 · kart 8 · alt sayfa/diyalog 16 · avatar ve + düğmesi tam yuvarlak.
- **Gölge:** yalnız yüzenlerde (`--golge-yuzen` alt sayfa/diyalog, `--golge-menu` açılır menü, bildirim). Kartta gölge yok; ayrım 1 px kenar ya da ton adımı.
- **Hareket:** 120 ms (basma, renk) ve 220 ms `cubic-bezier(.22,1,.36,1)` (alt sayfa, bildirim). Yalnız `transform`/`opacity`. `prefers-reduced-motion` ile süreler 0. Ekranlar giriş animasyonu yapmaz.
- **Ölçüler:** kontrol 44 px (fare olan masaüstünde küçük düğme 36), liste satırı 56 (iki satırlı 64–72), üst bar 56, alt menü 64 (+ güvenli alan), yan menü 248.

## 4. Bileşen kütüphanesi ve kullanım kuralları

Kaynak: `prototip/bilesenler.css`, davranış: `prototip.js`. Bileşen adları prototip sınıf adıdır; frontend kendi `components/ui/*` karşılığını kurar.

| Bileşen | Kural |
|---|---|
| **Düğme** `.dugme` | Türler: birincil (ekran başına **bir**), ikincil (kenarlı), metin, tehlike (kenarlı kırmızı; dolu kırmızı yalnız onay penceresinin eylem düğmesi), ikon (`aria-label` zorunlu). Ad = fiil + nesne ("Müşteri ekle"); "Tamam/Evet/Gönder" yok. İşlemde: `aria-busy`, dönen işaret + "Kaydediliyor…"; işlem bitene dek tekrar basılamaz. Devre dışı düğme okunur kalır ve nedeni yanında yazar. |
| **Form alanı** `.alan` | Etiket her zaman görünür ve üstte; yer tutucu yalnız örnek (`5xx xxx xx xx`) ve `…` ile biter. İsteğe bağlı alan "(isteğe bağlı)" yazar, zorunlu işaret yok. Hata alanın altında: ikon + metin + kırmızı kenar, `role="alert"`, `aria-invalid`, `aria-describedby`; gönderimde ilk hatalı alana odak. Input 16 px, 44 px yükseklik, kenar `--renk-kontrol-cizgi`. Telefon alanında "+90" ön eki. `autocomplete`, `inputmode`, e-postada `spellcheck=false`. |
| **Seçenek** `.secenek` | Onay kutusu/radyo ile metin tek tıklama hedefi (≥44 px). Yasal kutular **hiçbir zaman önceden işaretli değil.** |
| **Anahtar** `.anahtar` | Açık/kapalı ayarlar; açık rengi petrol. Her zaman görünür etiketle. |
| **Parçalı seçim** `.parcali` | 2–5 seçenek (dönem, ödeme yöntemi). Telefonda tam genişlik yalnız 480 px altında. |
| **Seçim kartı** `.secim-kart` | Hizmet, personel, kanal, paket seçimi; seçilince petrol kenar + açık zemin. Fiyat sağda tabular. |
| **Çip** `.cip` | Süzgeç ve kısa seçim; seçili çip koyu dolgu. Yatay kaydırılır, sayfa yatay kaymaz. |
| **Durum etiketi** `.durum` | Satır başına **bir** durum; açık zemin + koyu metin + nokta. "Yakında" etiketi `durum--yakinda` (gri, noktasız, metinle). |
| **Avatar** `.avatar` | Kişi kimliği: baş harfler + kişi tonu. Müşteri avatarı nötr gri. |
| **Kart** `.kart` | 1 px kenar, 8 köşe, gölge yok. İç içe kart yok. Başlık 16/600 solda, ikincil eylem sağda metin düğme. |
| **Liste satırı** `.satir` | Kimlik + 2. satır gri + sağda tek sayı ya da durum + gerekirse tek eylem. 640 px altında tablolar bu satıra döner; alan düşürülmez, 2. satıra iner. |
| **Tablo** `.tablo` | Yalnız masaüstü. 12 px gri cümle düzeni başlık, zebra yok, sayılar sağa yaslı tabular, toplam satırı `tfoot`. |
| **Özet şeridi** `.ozet` | KPI'lar tek kutuda ayraçlarla; ikon yok, mini grafik yok; değer 20/600, alt satır karşılaştırmasını adıyla söyler ("geçen çarşamba 15"). Telefonda 2 sütun. |
| **Sekmeler** `.sekmeler` | Alt çizgili; ok tuşlarıyla gezilir (`role="tablist"`); sayfayı değil kendi satırını kaydırır. |
| **Şerit** `.serit` | Ekranın bulgusu (uyarı/bilgi/hata/başarı) içerikle aynı sütunda, tek cümle + varsa tek eylem. Ekran boyu afiş yok. |
| **Boş / hata / yetkisiz** `.bos`, `.hata-blok` | Boş: ikon + başlık + (neden işe yarar) + **bir** birincil eylem. Hata bloğun içinde, "X yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin." + "Yeniden dene"; son başarılı yükleme saati varsa yazılır. Yetkisiz: suçlamaz, çıkış yolu verir. |
| **İskelet** `.iskelet` | Yükleniyor: son yerleşim, değer yerine gerçek boyda düz gri çubuk, parıltı yok, başlıklar hemen görünür; ekran okuyucuya "Yükleniyor…". |
| **Katman** `.katman` | Telefonda **alt sayfa** (tutamaç, üstte 16 köşe, en çok 92dvh, uzun akışta tam ekran); 768 px üstünde ortalanmış diyalog (560 / geniş 720). Odak tuzağı, Esc ve arka plana dokunarak kapanır, odak açan düğmeye döner, `overscroll-behavior: contain`, eylemler sabit altta. Yalnız gerçekten kesinti gereken işlerde. |
| **Onay penceresi** | Başlık eylemi sorar, gövde sonucu söyler, eylem düğmesi eylemin adını taşır ("Müşteriyi sil"); ikincil "Vazgeç". İki adımlı yasal işlemlerde ek alan (neden, ad yazarak onay). |
| **Bildirim (toast)** | Tek cümle, geçmiş zaman, 4 sn (geri al varsa 8 sn), kapatılabilir, `role="status"`. Telefonda alt menünün üstünde, masaüstünde sağ altta. Hata bildirimi koyu kırmızı. |
| **Açılır menü** | "Diğer işlemler" (⋮): en yıkıcı eylem en altta, kırmızı. Esc ile kapanır, odak geri döner. |
| **Gün şeridi / saat ızgarası** | Tarih için 14 günlük yatay şerit (kapalı gün kesikli ve devre dışı), saat için 76 px'lik düğmeler; yalnız boş saatler. "Boş saatler getiriliyor…". |
| **Doluluk şeridi** | İmza öğesi (§2.1). Dilimler `tabindex=-1` (klavye kullanıcı aynı bilgiyi "Şu an boş" cümlesinden ve liste satırlarından alır). |
| **Takvim** | **Kendi takvim bileşenimiz** (kurucu kararı T1; FullCalendar kullanılmaz). Telefonda saat çizelgesi (personel çipleri + durum süzgeci); masaüstünde personel sütunlu gün ızgarası (72 px/saat, 15 dk boş dilim, şimdi çizgisi), haftalık özet, ay görünümü (gün başına sayı). **Sürükle-bırak korunur** (masaüstü, sahip/müdür/resepsiyon; uzman yalnız kendi randevusu; yalnız ileri tarihli ve kapanmamış randevu): sürüklerken hedef dilim açık petrol, bırakınca onay bildirimi + "Geri al"; çakışmada randevu yerine döner ve hata şeridi. Dokunmatikte ve klavyede aynı iş "Saati değiştir" ile yapılır. 30 dk ve altı randevu tek satır (saat + ad). |
| **Alt eylem çubuğu** | Uzun formlarda kaydet düğmesi sabit altta; klavye açıkken görünür kalır (`dvh`). |

**Odak:** her etkileşimli öğede `:focus-visible` 2 px `--renk-odak` + 2 px boşluk; inputlarda kenar rengi + 3 px açık halka. `outline: none` yalnız yerine görünür gösterge varsa.

## 5. Gezinme modeli

**Telefon (1023 px'e kadar):** üst bar (marka işareti + salon adı, müşteri ara, hesabım) + **alt menü** 5 öğe: **Bugün · Takvim · [+] · Müşteriler · Menü**. Ortadaki **+** = "Randevu oluştur" (doğrudan akış açar). Uzman için: **Günüm · Takvimim · [+] · Müşterilerim · Menü**. Alt ekranlarda üst bar geri oku + ekran adı gösterir. "Menü" ekranı izinli tüm hedefleri gruplu listeler + Çıkış yap.

**Masaüstü (1024 px+):** 248 px yan menü, zemin renginde (koyu/renkli yan menü yok). Üstte marka + salon/rol seçici; gruplar cümle düzeninde gri etiketlerle:
- *(başlıksız)* Bugün / Günüm · Takvim · Müşteriler · Bekleme listesi (bekleyen sayısı) · Kasa
- **Hizmet ve personel** (setten bağımsız grup adı): Hizmetler (klinikte İşlemler/Uygulamalar) · Personel · Primim (uzman) · Mesaj asistanı (sahip)
- **Yönetim** (açılır, durumu hatırlanır; brif kararı 7): Raporlar · Hesaplar · Cari hesap · Alış faturaları · Tedarikçiler · Stok (kritik sayısı) · Paketler · Personel ödemeleri · Bahşiş
- Altta: deneme süresi kutusu (sahip; "N gün kaldı · Planı gör"), Ayarlar (sahip/müdür) ya da Hesabım, kullanıcı satırı + Çıkış.

Aktif öğe: açık petrol zemin + koyu petrol metin. Sayaç yalnız işlem bekleyen kuyruğa konur. Rol dışı öğeler **gizlenir** (soluklaştırılmaz); adres çubuğundan girilirse "Yetkisiz" ekranı. Kapalı modüller menüde görünmez.

## 6. Roller ve görünürlük

Kurucu R1: **Salon sahibi · Müdür · Resepsiyon · Uzman** (klinikte ek: **Hekim**, **Sağlık personeli**; K-kararları). Yetki unvana bağlı yetki setinden gelir; seti yalnız sahip verir. Tam matris: `roller-ve-akislar.md` §1.4 ve §8 — tasarım birebir uygular. Özet:

| Alan | Sahip | Müdür | Resepsiyon | Uzman |
|---|---|---|---|---|
| Bugün (salon özeti) / ciro | Var / var | Var / var | Var / yok (yalnız bugünkü kasa) | **Günüm** (yalnız kendi) |
| Takvim, randevu oluştur/taşı/durum | Tümü | Tümü | Tümü | Yalnız kendi (taşıma dahil, R3) |
| Tutar değiştirme | Var | Var | Var | **Yok** (R3) |
| Randevu silme | Var | Var | Yok (iptal eder) | Yok |
| Düzeltme kaydı (tamamlanmış randevu, kapatılmış gün) | Var | Var | Yok | Yok (R5) |
| Müşteriler | Tümü | Tümü | Tümü | Kendi müşterileri; diğerleri yalnız aramada, maskeli telefon (R4) |
| Sağlık bilgileri, fotoğraf | Var | Var | **Yok** (R9; klinikte "Sağlık notu var" işareti de yok) | Kendi müşterisi |
| Müşteri sil / veri talebi | Var | Var | Yok | Yok |
| Bekleme listesi | Var | Var | Var | Yok |
| Kasa, gün sonu | Var | Var | Bugün + **gün sonu** (R2) | Yok |
| Gider ekle / sil | Var / var | Var / var (R6) | **Yok** (R6) | Yok |
| Raporlar, Yönetim grubu | Var | Var | Yok | Yok |
| Benim primim | — | — | — | Var |
| Ayarlar | Tümü | Abonelik, modüller, gizlilik, kullanıcılar, terimler hariç | Yok | Yok |
| Modül aç/kapat, yetki verme, davet | Var | Yok (R7) | Yok | Yok |
| Hesabım (şifre, 2FA) | Var | Var | Var | Var |

Prototipte rol değiştirici (`?rol=sahip|mudur|resepsiyon|uzman|saglik-personeli`) her ekranı bu tabloya göre çizer.

**Ek kurallar (inceleme turu 1):** Resepsiyon personel izni ekleyemez (yalnız sahip/müdür). Resepsiyon salon modunda sağlık içeriğini görmez ama müşteri kartının Genel sekmesinde içeriksiz rıza durumunu (Alındı / Alınmadı / Reddetti) ve "Rıza al" eylemini görür; müşteri modunda gönderimden sonra ekran cevapları göstermeden kapanır. Uzman araması: en az 3 karakter, en çok 10 sonuç, randevusu olmayan kişide telefon maskeli (`0500 *** ** 27`) ve seçilemez, liste/dışa aktarma yok. Resepsiyon bahşişi yalnız ödeme kapanışında girer; Bahşiş ekranını görmez.

**Klinik modunda sağlık verisi (hukuk-uyum T1, ürün B1):** sağlık bilgileri, onamlar, klinik notu yalnız **Hekim** (kendi hastası). Müdür görmez. Sahip yalnız Ayarlar › Gizlilik ve KVKK'daki "Klinik sahibi klinik notlarını görür" anahtarı açıksa görür (varsayılan kapalı; prototipte `?sahipNot=1`). Erişim geçmişini sahip (anahtar açıksa) ve sorumlu hekim görür. **Sağlık personeli**: takvim ve atandığı randevular; sahip yetki vermedikçe sağlık bilgisi ve klinik notu yok. Müşteri verisini indirme klinikte yalnız hekim.

## 7. İki mod: Salon ve Klinik (kurucu S1, K1–K6)

İşletme türü kayıtta seçilir: **Kuaför · Berber · Güzellik merkezi · Estetik kliniği · Diş hekimi · Diğer randevulu işletme** (K: 6 tür; ayarlarda ayrıntılı alt tür listesi). İlk üç tür ve "Diğer" **Salon modu**, estetik kliniği ve diş hekimi **Klinik modu**dur. Öncelikli klinik: estetik kliniği.

### 7.1 Terim setleri (tek kaynak: metin-rehberi §2b)
Kodda tek terim tablosu; her metin set anahtarlı tam cümle (ek uyumu için her sette ayrı cümle, parça birleştirme yok).

| Kavram | Salon | Klinik-danışan | Klinik-hasta (yalnız estetik kliniği, diş hekimi) |
|---|---|---|---|
| İşletme | Salon | Klinik | Klinik |
| Sahip rolü | Salon sahibi | Klinik sahibi | Klinik sahibi |
| Hizmet alan | Müşteri / Müşteriler | Danışan / Danışanlar | Hasta / Hastalar |
| Hizmeti veren (randevu seçimi) | Uzman | Uzman | Hekim (yalnız hekim rolü; diğerleri Sağlık personeli) |
| Hizmet | Hizmet | Uygulama | İşlem (Tedavi kullanılmaz) |
| Form | Müşteri formu | Danışan formu | Hasta formu |
| Not alanı | Notlar | Notlar | Klinik notu |
Sabit kalanlar: Müdür, Resepsiyon, Kasa, Prim, Paket, Cari hesap, Stok, Gün sonu, durum adları, yasal metinler. Hiçbir modda: Hasta dosyası, Tıbbi kayıt, Reçete, Teşhis/Tanı, e-Nabız.

**Ayarlar › Terimler** (yalnız sahip): hazır set seçimi + ana terimler için düzenleme (İşletme, Hizmet alan, Hizmeti veren, Hizmet). Önizleme satırı ("Danışan ekle · Danışan eklendi."). Klinik-hasta seti yalnız klinik türlerinde seçilebilir; değişince tüm ekranlar ve SMS şablonları güncellenir.

### 7.2 Klinik modunda değişen ekranlar (hukuk-uyum §10, ürün §8.3b)
- **Kurulum:** "İşletme türü" adımı; klinik seçilince "Sağlık kuruluşu bilgileri" adımı (kuruluş adı, ruhsat no, sorumlu hekim) ve tek seferlik bilgi ekranı **"BeautyOS bir hastane bilgi yönetim sistemi (HBYS) değildir"**.
- **Güvenlik:** iki adımlı doğrulama zorunlu (kurulum: uygulama kodu → kurtarma kodları; giriş: 6 haneli kod; Ayarlar'da personelin 2FA durum listesi). Hareketsiz kalınca oturum kilitlenir (kilit ekranı: ad + şifre, panel bulanık değil gizli).
- **Hasta/danışan kartı sekmeleri:** Genel · Randevular · Sağlık bilgileri (rıza kapısı **yok**; yerine bilgi satırı + "Aydınlatma yapıldı" kaydı) · **Onamlar** (kliniğin kendi formunu yükler ya da tablette imza; "Onayı veren: Hasta / Yasal temsilci"; KVKK rızasından ayrı) · **Klinik notu** (düzenlenmez; "Düzeltme ekle" + "Düzeltme geçmişi") · **Erişim geçmişi** (kim, ne zaman, ne işlem; değer yok) · Paketler. **"Klinik görüntüleri" sekmesi** (kurucu kararı T2): yalnız hekim; yükleme saklama rızası (F1) ile, tanıtımda kullanım (F2) varsayılan kapalı; vitrinde hiç gösterilmez.
- **Silme yerine "Hasta kaydını kapat":** neden + saklama bilgisi + dışa aktarma adımı atlanamaz + kabul kutusu zorunlu.
- **Varsayılan kapalı:** kampanya izni, online randevudaki kampanya kutusu (R2), fotoğrafın tanıtımda kullanımı (F2), mesaj asistanı, online randevuda fiyat. Sahip açarsa uyarı penceresi.
- **Bildirimler:** hatırlatma SMS önizlemesinde işlem adı yok ("Yarın 14:30'da randevunuz var").
- **Kasa:** ödeme satırında "Özel / Kurum anlaşmalı" etiketi; TC/sigorta no alanı yok.
- **Online randevu:** alt bilgide kuruluş adı, ruhsat no, sorumlu hekim; formda şikâyet/sağlık alanı yok.
- **Abonelik sonu:** klinik için güçlü uyarı (veri 30 gün saklanır, sonra silinir; kendi yasal saklama yükümlülüğünüzü dışa aktararak karşılayın).
- **Roller:** Hekim (kendi hastaları + klinik notu yazar), Sağlık personeli (atandığı randevular, klinik notunu okur), Resepsiyon (sağlık hiçbir şey görmez).

Prototipte **işletme türü değiştirici** (`?tur=kuafor|estetik|dis`) ekran çiftlerini gösterir.

## 8. Yüzeyler: akışlar ve ekran listesi

Durum kısaltmaları: **Y** yükleniyor · **B** boş · **H** hata · **Ba** başarı · **Yt** yetkisiz. Prototipte `?durum=yukleniyor|bos|hata|yetkisiz`. "Çizildi" = prototipte var; "Planlandı" = bu belgede tanımlı, prototip sırası `DURUM.md`'de.

### 8.1 (a) Salon paneli — `panel.html#<ekran>`

**Akış: resepsiyon, telefonla gelen randevu.** + → müşteri ara (ad/telefon, ≥2 karakter) → yoksa "… adıyla yeni müşteri ekle" (ad + telefon yeter) → hizmet (kategori çipi + seçim kartı; süre, fiyat) → personel (yalnız o hizmeti verenler) → tarih (14 gün şeridi) → saat (yalnız boş) → not (isteğe bağlı) → altta sabit özet + "Randevu oluştur" → bildirim "Randevu oluşturuldu." Saat dolarsa saat bölümünde kırmızı şerit + saatler yenilenir. Hedef: kayıtlı müşteri için 5 dokunuş.
**Akış: tamamla ve ödeme al.** Randevu → "Tamamla ve ödeme al" → (müşterinin uygun paketi varsa "Paketten düş" seçeneği) → tutar (hizmet fiyatı; uzman için salt okunur) → Nakit/Kart → (bahşiş, isteğe bağlı) → "Ödeme al · ₺850" → "Ödeme alındı." Tamamlanan randevu kilitlenir; düzeltmeyi sahip/müdür "Düzeltme ekle" ile yapar (iz kalır).
**Akış: gün sonu.** Kasa → "Günü kapat" → kapanmamış randevu uyarısı (düzelt ya da açık bırak) → özet → kasa sayımı (beklenen nakit, fark, fark nedeni) → "Günü kapat" → "Gün sonu kaydedildi." + Özeti yazdır. Sahip/müdür kapatılmış günü "Günü yeniden aç" ile açar (neden zorunlu, kayıt tutulur; planlandı).
**Akış: uzman, günüm.** Giriş → Günüm: büyük "Sıradaki" kartı (saat, müşteri, hizmet, "10 dk sonra", Başlat / Ara) → günün sırası → Tamamla (tutar kilitli) → Benim primim.

| Ekran (`#`) | Amaç ve içerik | Durumlar | testid | Prototip |
|---|---|---|---|---|
| `bugun` | Şimdi ve sırada (Başlat/Tamamla/Onayla), Personelin günü şeridi + "Şu an boş" cümlesi, günün özeti (sahip/müdür: randevu, tahsilat, beklenen, doluluk; dönem Bugün/Hafta/Ay), bugünkü kasa (resepsiyon), günün randevuları (personel çipleri), bekleme listesi özeti, bulgu şeridi ("2 online randevu onay bekliyor") | Y iskelet · B **ilk kurulum listesi** (6 adım, gerçek yüzde) · H blok içi, kasa "₺0" göstermez · Yt | `bugun-bulgu`, `doluluk-seridi`, `simdi-bos`, `ilk-kurulum` | Çizildi |
| `gunum` | Uzmanın günü (bkz. akış), bugün sayıları, izinlerim | Y · B "Bugün randevunuz yok." · H | `gunum-siradaki` | Çizildi |
| `takvim/<gün>` | Gün şeridi; telefonda saat çizelgesi + personel çipleri; masaüstünde personel sütunları, şimdi çizgisi, boş dilime tıkla; Hafta özeti; Pazar "kapalı" | Y · B · H | — | Çizildi (Ay görünümü planlandı) |
| Randevu oluştur (katman) | Bkz. akış | Boş saat yok · saat doldu (`?cakisma=1`) · hız sınırı | `randevu-olustur`, `randevu-olustur-kaydet` | Çizildi |
| Randevu ayrıntısı (katman) | Durum, saat, hizmet, personel, ücret, iletişim (ara, WhatsApp, müşteri kartı), sağlık işareti (yetkili), not, duruma göre eylemler, iptal/gelmedi/sil | Kilitli (tamamlandı/iptal/gelmedi) | `randevu-detay` | Çizildi |
| Saati değiştir, İptal, Gelmedi, Sil (katman) | Onay pencereleri metin rehberi §4.3 | — | `saat-degistir`, `onay-penceresi` | Çizildi |
| Tamamla ve ödeme al (katman) | Bkz. akış | — | `tamamla-odeme` | Çizildi |
| Randevusuz işlem (katman) | Müşteri, hizmet, personel, tutar, saat, yöntem | — | `hizli-islem` | Çizildi |
| `musteriler` | Arama, liste (ad, telefon, son ziyaret, ziyaret sayısı), sonsuz kaydırma | Y · B · H · arama sonuçsuz | `musteri-ara` | Çizildi |
| `musteri-yeni` | Ad, telefon, e-posta, doğum tarihi, notlar (sağlık yazmayın), kampanya izinleri (kanal + kaynak), aydınlatma hatırlatması | Alan hataları | `musteri-formu` | Çizildi |
| `musteri/<id>` | Başlık + Randevu oluştur/Ara/WhatsApp, özet (ziyaret, harcama, cari), sekmeler: Genel · Randevular · Sağlık bilgileri (rıza kapısı: yok/var/reddetti/bekliyor; müşteri modu; geri alma) · Fotoğraflar (F1/F2) · Paketler · Cari; ⋮: düzenle, veri talebi, sil | Y · H · Yt (uzmanın kendi müşterisi değilse) | `saglik-kilit`, `riza-durum`, `musteri-modu` | Çizildi; V4 "Verilerinizi talep edin" metni planlandı. **Uzman için tutar kuralı (2026-10-29, tasarım kararı):** uzman müşteri kartında "Toplam harcama", "Cari" ve randevu ücretlerini görmez (W14'teki gizli "Ücret" satırıyla aynı); yalnız tarih, hizmet, durum ve not görür. Gizleme yalnız arayüzde değil sunucu yanıtında da olmalıdır |
| `hizmetler` | Kategori kartları; sahip/müdür düzenler (ad, kategori, süre, fiyat, prim, verenler, online görünürlük, reçete, sil) | Y · B · H | `hizmet-formu` | Çizildi |
| `personel`, `personel-detay/<id>` | Liste (unvan, yetki seti, bugünkü randevu); Profil (yetki seti yalnız sahip), Hizmetleri, Çalışma saatleri, İzinler, Ödemeler; çıkar | Y · B · H | `personel-formu`, `calisma-saatleri` | Çizildi; davet bağlantısı (R8) planlandı |
| `kasa` | Dönem (sahip/müdür), özet (tahsilat, nakit, kart, gider, net), kapanmamış randevu uyarısı, tahsilatlar, giderler, bugünkü primler, bahşiş; sınır cümlesi (yazarkasa değildir) | Y · B · H | `kasa-ozet`, `gunu-kapat`, `gun-sonu` | Çizildi; R6 (resepsiyon gider ekleyemez) güncellenecek |
| `raporlar` | Kasa raporu (günlük döküm) ve Prim raporu; yazdır; olmayan raporlar "Yakında" | Y · H | — | Çizildi |
| `bekleme` | Liste; Müşteriye haber ver (mesaj önizleme + bilgilendirme uyarısı), Randevuya çevir, Listeden çıkar; Listeye ekle | Y · B · H | — | Çizildi |
| Yönetim: `hesaplar`, `cari`, `faturalar`, `fatura-yeni`, `tedarikciler`, `stok`, `paketler`, `odemeler`, `bahsis` | Mevcut işlevler aynen: hesap + virman, cari döküm, fatura kalemleri + "Faturayı işle", stok (ürün, hareket, reçete, kritik uyarı), paket türleri + satılanlar, personel ödemesi + "Ödendi olarak işaretle", bahşiş havuzu + dağıt | Y · B · H · Yt | — | Çizildi (ayrıntılı formlar mevcut alanlarla, planlandı) |
| `primim` | Uzmanın bu ay hizmet, ciro, prim, bahşiş ve ödemeleri | Y · B · H | — | Çizildi |
| `asistan` | Mesaj asistanı konuşmaları; kapalıyken dürüst bilgi | — | — | Çizildi |
| `ayarlar`, `ayarlar/<bölüm>` | Salon bilgileri · Çalışma saatleri · Online randevu sayfası · Bildirimler ve mesajlar (şablon + önizleme + bilgilendirme uyarısı) · Kullanıcılar ve yetkiler · Müşteri formu soruları · Mesaj asistanı · Modüller · Gizlilik ve KVKK · Plan ve abonelik (deneme, fiyat yer tutucu, veri 30 gün, hesabı kapat) · **Terimler** (planlandı) · **Güvenlik / 2FA** (planlandı) | Yt bölüm bazında | `ayarlar-listesi` | Çizildi (Terimler, Güvenlik planlandı) |
| `hesabim` | Profil, şifre değiştir, çıkış (tüm roller) | — | `sifre-degistir` | Çizildi |
| `menu` | Telefonda tüm izinli hedefler | — | — | Çizildi |
| `abonelik-bitti`, `yeniden-kabul` | Deneme bitti (Plan seç, veri); sözleşme güncellendi (yalnız sahip, K1 kutusu) | — | `abonelik-bitti`, `yeniden-kabul` | Çizildi |
| Klinik: hasta kartı (Onamlar, Klinik notu + düzeltme, Erişim geçmişi), Hasta kaydını kapat, 2FA kurulum/giriş/kurtarma, oturum kilidi | §7.2 | — | — | Planlandı |

### 8.2 (b) Müşterinin online randevu sayfası — `randevu-al.html` (çizildi; `#hizmet`, `#zaman`, `#bilgi`, `#kod`, `#onay`, `#degistir`, `#kapali`, `#bulunamadi`; `?kampanya=1`, `?renk=…`, `?tur=estetik`)
Tek sütun, salonun rengi (`--salon-renk`), "BeautyOS altyapısıyla" küçük alt bilgi. **Adımlar (3 + doğrulama):** (1) **Hizmet** — kategori, süre, fiyat (fiyat API'de yok: B5; klinikte varsayılan gizli) → (2) **Uzman ve zaman** — "Fark etmez" varsayılan, 14 günlük şerit, boş saatler; seçim özeti altta yapışkan → (3) **Bilgileriniz** — ad soyad, telefon; R2 kampanya kutusu yalnız salon açtıysa (iki varyant); R1 aydınlatma satırı (alt sayfada metin); R3 kod açıklaması → **Doğrulama** — 6 haneli kod (tek alan, `autocomplete="one-time-code"`), 10 dk, yeniden gönder sayacı → **Onay** — özet, referans kodu, Takvime ekle (.ics; B5), Ara / WhatsApp, R5 metni, "Randevunuzu değiştirin ya da iptal edin" (randevudan 2 saat öncesine kadar, M1; sonrası "salonu arayın"). İlerleme: üstte ince adım çizgisi + adım adı. **Durumlar:** salon bulunamadı, online randevu kapalı (telefon ile), saat bu arada doldu (alternatif saatler), kod yanlış/süresi doldu, hız sınırı (gerçek süre), ağ hatası. "Geliştirme modu — kod" kutusu hiçbir zaman çizilmez. Klinik: alt bilgide kuruluş adı, ruhsat no, sorumlu hekim; "Hekim" terimi.

### 8.3 (c) Giriş, kayıt, şifre, kurulum — `giris.html#…` (çizildi; ayrıca `#davet`, `#kilit`, `#2fa`, `#2fa-kur`, `#kurtarma`, `#kurtarma-gir`)
Açık zemin, tek sütun 400 px, marka işareti; satış iddiası yok (#1, 500+ salon kalkar). **Giriş:** e-posta, şifre (göster/gizle `aria-label`), "Şifremi unuttum", hata "E-posta veya şifre hatalı.", hız sınırı metni; altta yasal bağlantılar. Klinik hesapta 2. adım: doğrulama kodu. **Kayıt (2 adım):** (1) İşletme adı, işletme türü (6), salon adresi (önizleme `beautyossapp.com/book/…`, anlık uygunluk) → (2) ad soyad, telefon, e-posta, şifre + K1 (zorunlu, iki belge bağlantısı) → K3 (isteğe bağlı) → K2 satırı → "Hesap oluştur". **Şifremi unuttum:** P1 metniyle aynı sonuç; e-posta gönderimi çalışmıyorsa dürüst "Destek ekibine yazın" yolu. **Şifre sıfırla:** yeni şifre + kural; bağlantı süresi doldu durumu. **Kurulum sihirbazı:** İşletme türü → (klinik: Sağlık kuruluşu bilgileri + HBYS bilgi ekranı, 2FA kurulumu) → Salon bilgileri → **Çalışma saatleri** (atlanabilir) → Hizmetler (sektör önerileri, atlanabilir) → Personel (davet; "Sadece ben", atlanabilir) → Yasal bilgiler + aydınlatma şablonu (atlanabilir, kalıcı hatırlatma) → Hazır: 3 görev (İlk randevuyu oluşturun, Bağlantıyı kopyalayın, Çalışma saatlerini gözden geçirin). Her adımda "Şimdilik atla"; ilerleme çizgisi.

### 8.4 (d) Tanıtım sitesi — `tanitim.html` (çizildi)
**Vitrin kuralı (pazarlama P1–P7, hukuk P2):** ürün parçaları iframe değil, sayfanın içinde çizilmiş statik HTML parçalarıdır (`data-ui`, `role="img"` + açıklayıcı `aria-label`); yanlarında "Örnek salon, kurgusal veri"; tarih yerine "Örnek gün"; telefonlar maskeli; online randevu, sağlık, gün sonu düğmesi ve rol setleri gösterilmez, gösterilecekse "Tasarım önizlemesi, yakında" etiketi; klinik sayfalarında yalnız nötr hizmet adları (Muayene, Kontrol, İlk görüşme, Değerlendirme, Bakım seansı…) ve okunur boyutta HBYS sınır cümlesi. Canlı demo hero'daki "Canlı demoyu aç" ile tembel yüklenir (`panel.html?yalin=1&vitrin=1`), "Demo: kayıtlar saklanmaz" ve "Demoyu atla". Mobil sıra: H1 → metin → CTA → demo bağlantısı → ürün; hero sonrası yapışkan "Ücretsiz deneyin". Sektör sayfalarına **berber** eklendi.
Yön `product-performs` (§2.2), içerik birebir `tanitim-sitesi-icerik.md` sürüm 3. **Ana sayfa:** gezinme (wordmark · Özellikler · Fiyat · SSS · İletişim · Giriş · [Ücretsiz deneyin]); hero H1 "İşletmenizi telefondan yönetin" + alt metin + CTA + "Demo isteyin"; sağda/altta gerçek panel parçası (Bugün, 390 px) + Kasa özeti; "Günün tüm işi tek ekranda" (5/7 bölünmüş satırlar, her biri bir panel parçası); "Telefonda çalışır"; "Her iş için" (eşit kart ızgarası yok; ağırlığı farklı liste, "Yakında" rozetleri ayrı bölümde); "Kimler için" (salon ve klinik bağlantıları); "Nasıl başlarsınız" (gerçek sıra, `<ol>`); Fiyat (gri "Fiyat kararı bekleniyor" kutusu, sahte rakam yok); Yakında; SSS (5 soru); kapanış; footer (künye yer tutucuları, yasal bağlantılar, DPA, [DESTEK_E-POSTASI]; sosyal simge ve WhatsApp yok). Ayrı sayfalar: Özellikler, Fiyat, SSS, İletişim (form + aydınlatma satırı), Hakkımızda (yer tutucu), sektör sayfaları (kuaför, güzellik merkezi, klinik, estetik klinik, diş hekimi; klinik sayfalarında fotoğraf/önce-sonra/kampanya/online randevu yok, sınır cümlesi okunur boyutta), yasal sayfa şablonu (sürüm satırı, içindekiler, Y1 yer tutucu). Çerez bandı çizilmez.

**Hareket katmanı (kurucu kararı A1; `prototip/tanitim-hareket.css` + `.js`, kütüphanesiz).** Panelde uygulanmaz. Yalnız transform/opacity/clip-path; tüm başlangıç durumları `prefers-reduced-motion: no-preference` altında, azaltılmış harekette sayfa bitmiş hâliyle görünür; CTA ilk karede görünür, yüklenme 1,2 sn içinde biter, önyükleyici yok.
1. **Yükleniş:** H1 iki satır maskeden yükselir; alt metin, CTA, not 90 ms arayla; ürün parçası perde gibi açılır.
2. **İmza: canlı hero parçası** (döngü ~12 sn, ekran dışında ve sekme gizliyken durur): "şimdi" çizgisi ilerler, Elif'in boş saatine dokunulur, 16:15 randevusu şeride dolar, "Randevu oluşturuldu" bildirimi gelir.
3. **Beyan:** "Randevu defteri, kasa defteri, telefon rehberi. Üçünün yerine tek ekran." kaydırdıkça kelime kelime %72 tondan (≥4,5:1) tam mürekkebe dolar (scroll timeline; desteklemeyen tarayıcıda görününce IntersectionObserver ile kelime kelime). Gizli başlangıç durumları yalnız betiğin eklediği `html.js-hareket` sınıfıyla; betik yoksa sayfa tam görünür. Alt metin ve CTA ilk karede görünür (yalnız 8 px kayar). Hero döngüsü "Hareketi durdur" düğmesiyle anında durur, "Hareketi başlat"la baştan döner. Bilinçli istisna: beyan dolumu `color` canlandırır (tek cümle; yalnız transform/opacity kuralının tek istisnası). Yapışkan telefon yalnız hareket serbestken. Bölüm başlıklarında üç hareket çeşidi (maskeden yükselme, soldan açılma, hafif ölçek). Koyu zeminlerde beyaz odak halkası. Etkin olmayan hikâye adımları opaklıkla değil tonla (≥4,5:1).
4. **Hikâye ("Telefonda çalışır"):** 900 px üstünde yapışkan telefon; dört adım (Randevu oluştur → Hatırlatma [Yakında] → Tamamla ve ödeme al → Gün sonu) ekranın ortasına gelince ekran yumuşak geçişle değişir, seçim anı ve "Ödeme alındı" küçük sonuç hareketi, gün sonu rakamları yuvarlanır; "4 adımdan 2" sayacı. Telefonda ve hareketsiz modda her adım kendi ekranıyla alt alta.
5. **Bölüme özgü hareketler:** takvimde randevular saat sırasıyla sütunlara düşer ve "şimdi" çizgisi çekilir; müşteri kartı ve listeler satır satır; kasa rakamları yuvarlanır; sektör sekmelerinde alt çizgi kayar, kartlar sırayla gelir; başlıklar maskeden yükselir; hero kaydırınca hafifçe çekilir, kapanış yaklaşır.
6. **Mikro:** düğmede basma ve gölge cevabı, bağlantı alt çizgisi koyulaşır (yalnız fare).

#### A2 görsel derinlik (kurucu kararı A2; `prototip/tanitim-derinlik.css`, yalnız tanıtım)
Yön: "petrol gece, pudra ışık". Kütüphane kaydı yeni seçilmedi; marka renklerinden türetilen yerel `--depth-*` tokenları kullanılır (mor `#6B48FF` yalnız %10–45 alfa ışık lekesi ve ince vurgu; mor-pembe degrade yok, degradeler petrol → koyu petrol, pudra yalnız sıcak leke). Kurallar:
1. **Menü:** beyaz şerit yok. Sabit, yuvarlak hap; ana sayfada hero üstünde saydam, 24 px kaydırınca `backdrop-filter: blur(18px)` koyu cam (desteklemeyen tarayıcıda %95 opak koyu). Alt sayfalarda baştan cam. Dokunma alanı 44 px; <900 px'te "Menü" düğmesi (`aria-expanded`, Esc kapatır), <560 px'te "Giriş" menüye iner. Menü hapı içinde CTA pudra zeminli.
2. **Zemin dili:** koyu yüzeylerde (hero, bento bölümü, kapanış, altbilgi, "Kimler için" sağ paneli, telefon sahnesi) katman sırası: petrol degrade → 1–2 radyal ışık (pudra / mor) → nokta ya da ince çizgi dokusu (maske ile kenarda solar). Açık yüzeylerde yalnız pudra-petrol açık degrade + koyu nokta dokusu. Doku her zaman `mask-image` ile solar; tam kaplamaz.
3. **Ürün çerçevesi:** hero'da cam çerçeveli pencere + arkada ikinci katman plaka; alt kenarı hero'dan 88–112 px taşar. Diğer ürün parçaları renkli `sahne-kart` paneline (petrol / pudra / koyu) oturur, parça beyaz kalır ve `--depth-shadow-lift` gölgesi alır.
4. **Geçişler, her biri farklı olmalı** (art arda aynısı yasak): kavisli hero tabanı → yükselen yaprak (üst köşe 56 px, negatif margin) → eğik ayraç (clip-path) + eliptik taban → renk sınırını taşıyan kart (arka plan sabit pikselli iki renk durağı) → dışbükey üst → yumuşak renk geçişi → yükselen yaprak → kapanış kartı altbilgiyi taşır. Yeni bölüm eklerken bir öncekinden farklı bir geçiş seç.
5. **Kartlar:** bento (12 sütun, 7/5 · 4/4/4 · 5/3/4; kart içinde küçük canlı parça; her kartın zemini ve düzeni farklı; nested kart yok), hikâye adımları kart (etkin kart beyaz + yüksek gölge, pasif kart ton farkı, ≥4,5:1), "Kimler için" tek büyük kart (solda liste, sağda koyu bilgi paneli), merdiven adımlar, yer tutucu fiyat kartı (şeritli üst kenar, "Yer tutucu" etiketi, rakam yok), "Yakında" kesik kenarlı kartlar, SSS kart akordeon (+/− yuvarlak düğme), kapanış büyük yuvarlak kart (degrade + çizgi ızgara + yüzen iki bildirim), altbilgi üç katman kartı + dev "BeautyOS" damgası (dekoratif, `aria-hidden`).
6. **Hareket uyumu:** kartlar mevcut `satirlar` girişini kullanır; bento içindeki çubuklar/noktalar kart görününce ölçekle dolar; ışık lekeleri 26–38 sn'de çok yavaş kayar, yüzen parçalar 6–7 sn. Yalnız transform/opacity. `prefers-reduced-motion`'da hepsi durur; "Hareketi durdur" düğmesi `html.hareket-durdu` ile ışık lekelerini ve yüzen parçaları da durdurur.
7. **Dürüstlük (#15):** bento ve panel parçaları "örnek, kurgusal veri" notu taşır; "Yakında" ve "Yer tutucu" işaretleri aynen durur; rakamlı iddia, yorum, logo duvarı yok.
8. **Ortak kabuk:** kapanış kartı iletişim ve yasal sayfalar dışında her sayfada çıkar; alt sayfalar üstte yumuşak ışık yıkaması, kart listeleri (`.is`), kart akordeon ve `sahne-kart` panelleri kullanır.

### 8.4b Online randevu onayı (işletme ayarı, kurucu kararı T3)
Ayarlar › Online randevu sayfası › "Online gelen randevular": **Otomatik onayla** (salon varsayılanı; müşteri "Randevunuz alındı." görür) / **Ben onaylayayım** (klinik varsayılanı; randevu "Bekliyor" düşer, Bugün'de "N online randevu onay bekliyor" şeridi, müşteri "Randevu talebiniz alındı. … onayladığında kesinleşir." görür). SMS kapalıyken hiçbir ekranda SMS vaadi yazılmaz. Online randevu formunda **not alanı bilinçli olarak yoktur** (hukuk-uyum §3.2): müşterinin serbest metne sağlık bilgisi yazmasını önler; salon gerekiyorsa randevu notunu panelden ekler. Değiştir/iptal: onay ekranından aynı oturumda doğrudan; sonradan (bağlantı, sayfanın yeniden açılması) süreli imzalı bağlantı ya da telefon kodu ile (`#degistir-kod`, `#gecersiz`). Bot koruması Cloudflare Turnstile, görünmez; formda tek satır bilgi.

### 8.5 (e) Süper yönetici ("Sistem yönetimi") — `yonetici.html` (çizildi)
Ayrı giriş (koyu değil; panelle aynı dil, "Yönetim paneli" etiketi). **Genel bakış:** toplam, aktif, deneme, süresi dolan, son 30 günde kayıt (küçük gerçek sayılar). **Salonlar:** arama, plan ve durum süzgeci, tablo (salon, sahip, plan, durum, deneme bitişi, kullanıcı/müşteri sayısı, son giriş, sözleşme sürümü). **Salon ayrıntısı:** plan değiştir, aktif/pasif (onaylı), deneme bitişini uzat, not alanı (elle tahsilat; backend gerekir), son 30 gün özeti (randevu, müşteri sayısı, tek ciro rakamı), yasal kayıtlar (kabul sürümleri). Müşteri verisi hiç görünmez; destek erişimi açılırsa neden zorunlu ve üstte kırmızı "Destek erişimi · Bu oturum kayıt altına alınıyor" şeridi. Yasal belge sürümü yayınlama ekranı.

### 8.6 Sistem ekranları — `sistem.html#…` (çizildi)
404 "Sayfa bulunamadı." (sayı gösterilmez), genel hata (referans no: **API istek numarası döndürene kadar üretimde bu satır gösterilmez**; yerine "Sürerse destek ekibine yazın: [DESTEK_E-POSTASI]."), bakım, çevrimdışı şerit ("İnternet bağlantınız yok."), oturum süresi doldu, hesap aktif değil. Hepsi markalı, Türkçe, tek çıkış eylemiyle.

## 9. Türkçe metin ilkeleri
Tek kaynak `metin-rehberi.md` (teknik-yazar). Tasarımın uyguladıkları: "siz" hitabı, cümle düzeni büyük harf (menü dahil), buton fiil + nesne, bildirim geçmiş zaman, ilerleme "…" ile; hata = ne oldu + ne yapmalı, kod/İngilizce yok; boş durum = ne + neden + tek eylem; para `Intl.NumberFormat('tr-TR', {style:'currency', currency:'TRY'})` (panelde kuruşsuz `₺9.150`, kasa raporu ve primde kuruşlu); saat 24 saat, aralık "14:30 – 15:15"; tarih `28.10.2026` / "28 Ekim, Çarşamba". Terimler §7.1 setinden. Yer tutucular: `[DESTEK_E-POSTASI]`, künye alanları, fiyat, `[GG.AA.YYYY]`. **Not (teknik-yazar'a):** rehberdeki "₺ sonda" örneği ile `Intl` tr-TR çıktısı (`₺1.250`) çelişiyor; tasarım `Intl` çıktısını kullanır, rehberin buna göre düzeltilmesini öneriyorum.

## 10. Erişilebilirlik (WCAG 2.2 AA)
Kontrast §3.1 tablosu (tüm metin ≥4,5:1, form kenarı ve grafik işaret ≥3:1). Klavye: atla bağlantısı ("İçeriğe geç"), mantıksal sıra = görsel sıra, katmanda odak tuzağı ve iade, sekmelerde ok tuşları, açılır menüde Esc. Odak her zaman görünür ve yapışkan çubukların altında kalmaz (`scroll-margin`). Ekran okuyucu: tek h1, bölüm başlıkları `aria-labelledby`, ikon düğmelerinde `aria-label`, dekoratif ikon `aria-hidden`, durum etiketi metinli, bildirim `role="status"`, hata `role="alert"`, iskelet "Yükleniyor…" duyurusu, takvim olaylarında tam cümle etiket. Dokunma hedefi ≥44 px (WCAG 2.5.8 üstü). Yakınlaştırma kapatılmaz. Hareket azaltma desteklenir. Renk tek başına anlam taşımaz.

## 11. Tailwind'e aktarım notu (frontend-gelistirici)
`ekran-envanteri.md` §6 önerisi uygundur: Tailwind v4 tek sürüm, `tokens.css` (ham + anlamsal, bu belgedeki adlar) → `@theme inline` eşlemesi: `--color-zemin: var(--renk-zemin)`, `--color-yuzey`, `--color-cizgi`, `--color-metin`, `--color-metin-soluk`, `--color-birincil`, `--color-vurgu`, `--color-hata`… ; `--font-sans: var(--font-hanken)`; `--radius-etiket/kontrol/kart/katman`; `--shadow-yuzen/menu`. Bileşenlerde hex, `bg-white`, `text-gray-*`, `dark:` yok. Animasyon kendi `@keyframes`'iyle (eklenti yok). Durum ve kişi tonları `data-durum` / `data-kisi` öznitelikleriyle seçilir. Terim seti `metin/tr.ts` içinde set anahtarlı. Prototip sınıf adları (Türkçe) yalnız referanstır; kod kendi adlandırmasını koruyabilir, token adları korunur.

## 12. Backend gerektiren / "Yakında" çizilenler
Online randevuda fiyat ve takvime ekle (B5) · dosya ile fotoğraf/logo (B4, V3) · rol setleri, davet, maskeleme (B3, R4, R8) · düzeltme kaydı ve günü yeniden aç (R5) · müşteri silme, veri talebi, rıza/kabul kayıtları (B10) · ödeme yöntemi "Karma" ve paketten düşme kapanışta (B12) · grafikli raporlar (B8, K12) · hatırlatma SMS'i (M2, NetGSM) · İYS · kasa sayımı alanı · 2FA ve oturum kilidi (klinik) · terim setleri.

## 13. Kurucu kararı bekleyen yer tutucular
Fiyat rakamları ve paketler · künye (unvan, VKN, adres) · [DESTEK_E-POSTASI] · logo dosyası (prototipte geçici işaret: halka + pudra yay) · OG görseli onayı · mor rengin ürün kromundan çıkması (bilgi) · yasal metin gövdeleri (avukat).
