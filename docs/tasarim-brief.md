# BeautyOS — UI/UX Yeniden Tasarım Brifi

- **Tarih:** 2026-10-28 · **Sahibi:** müdür · **Kaynak:** kurucunun cevapları (aşağıda birebir özet)
- **Amaç:** BeautyOS'u profesyonel, "amatör görünmeyen" bir ürün arayüzüne kavuşturmak. Bu iş şirketin **vitrin işi** olacak: bir yazılım şirketinin elinden çıktığı belli olmalı.
- **Bağlam:** 2026-10-28 ekip incelemesi `C:\Users\pc\Desktop\Şirket\raporlar\inceleme\beautyos-2026-10-28\` (özellikle `OZET.md`, `ui-ux-tasarimci.md`, `frontend-gelistirici.md`, `urun-analisti.md`, `hukuk-uyum.md`, `musteri-destek.md`, `teknik-yazar.md`, `pazarlama.md`).
- **Canlı kod:** `tasima/docker` @ `71ee311`. Salt okunur kopya: `C:\Users\pc\AppData\Local\Temp\claude\c--Users-pc-Desktop--irket\6a3a83b0-2be8-453a-9df4-edefd5b83481\scratchpad\beautyos-71ee311` (web: `apps/web/src`, API: `apps/api/src`, şema: `apps/api/prisma/schema.prisma`).

## Kurucu kararları

| # | Konu | Karar |
|---|---|---|
| 1 | Kapsam | **Beş yüzeyin tamamı ayrı ayrı tasarlanır:** (a) salon paneli (takvim, randevu, müşteri, personel, kasa ve tüm modüller), (b) müşterinin online randevu sayfası, (c) giriş / kayıt / şifre sıfırlama / ilk kurulum sihirbazı, (d) tanıtım sitesi, (e) süper yönetici paneli |
| 2 | Çalışma şekli | Önce **tasarım belgesi + tarayıcıda açılan tıklanabilir HTML prototip** → kurucu onayı → ekran ekran kodlama → `yeni.beautyossapp.com`'da gösterim |
| 3 | Derinlik | **Yeniden tasarım:** ekranlar ve akışlar baştan düşünülür, **işlevler aynı kalır** (mevcut hiçbir işlev kaybolmaz) |
| 4 | Kullanıcılar | Salon sahibi, resepsiyon ve personelin **hepsi** kullanır. **Yetkiler personelin unvanına (rolüne) göre** belirlenir: her ekran ve eylem için rol bazlı görünürlük tasarlanır |
| 5 | Birincil cihaz | **Telefon** (önce mobil; tablet ve masaüstü de düzgün çalışır) |
| 6 | Personel görünümü | **Evet:** personelin yalnız kendi gününü/randevularını gördüğü sade bir görünüm |
| 7 | Menü | İleri modüller (stok, cari, alış faturası, banka-kasa vb.) **"Muhasebe/Yönetim" grubunda** toplanır |
| 8 | Marka | Mevcut renklerden (#1F3E47 petrol, #E89B96 pudra, #6B48FF mor) **yola çıkılarak geliştirilir** |
| 9 | Kişilik | **net, hızlı, modern** |
| 10 | Hissiyat | **Sade ve profesyonel bir iş aracı** |
| 11 | Referans ürün | Verilmedi (ekip seçer, gerekçesiyle) |
| 12 | Kaçınılacak | **Amatör görünüm.** Şablon/"yapay zekâ üretimi" izleri, tutarsızlık, özensiz metin kabul edilmez |
| 13 | Koyu tema | **Sonra eklenecek:** tokenlar şimdiden koyu temaya hazır kurulur, koyu tema çizilmez |
| 14 | Görseller | **Gerçek ürün ekran görüntüleri** (yeni tasarımın kendi ekranları) |
| 15 | Vitrin içeriği | **Yanıltıcı bilgiler kalkar** (AWS, iyzico PCI-DSS, #1, 500+ salon, 42/50, uçtan uca şifreli, KVKK uyumlu vb.). Geliştirilebilecek özellikler kalabilir ama **"yakında / yol haritasında"** diye dürüstçe işaretlenir |
| 16 | Dil | **Yalnız Türkçe** |
| 17 | Hitap | **"Siz"** |
| 18 | Erişilebilirlik | Özel ihtiyaç yok; standart **WCAG 2.2 AA** |
| 19 | Onay | Kurucu tamamlanınca kontrol edip geri bildirim verir |

## Kurucu kararları — 2. tur (2026-10-28)

| # | Konu | Karar |
|---|---|---|
| R1 | Roller | Salon sahibi, Müdür, Resepsiyon, Uzman. Muhasebe rolü şimdilik yok |
| R2 | Gün sonu | Resepsiyon kasayı kapatabilir |
| R3 | Uzman | Kendi randevusunu taşır ve ödeme alır; **fiyatı değiştiremez** |
| R4 | Telefon | Uzmana yalnız kendi müşterilerinde açık, diğerlerinde maskeli |
| R5 | Düzeltme | Tamamlanmış randevu / kapatılmış gün düzeltmesini sahip ve müdür yapar; düzeltme kaydı tutulur |
| R6 | Gider | Müdür ekleyebilir, resepsiyon ekleyemez |
| R7 | Modüller | Aç/kapat yalnız sahip |
| R8 | Personel daveti | Davet bağlantısı; personel kendi şifresini belirler |
| R9 | Sağlık verisi | Resepsiyon anamnez ve fotoğrafı görmez |
| M1 | Müşteri iptal/değiştirme | Var; randevudan 2 saat öncesine kadar. İlk aşamada "salonu arayın" seçeneği de durur |
| M2 | Hatırlatma | SMS (NetGSM açılacak), e-posta yedek |
| V1 | Veri saklama | Deneme/abonelik bitince 30 gün, sonra silinir |
| V2 | Fiyat sözü | "Ömür boyu" yok; "ilk 12 ay fiyat sabit" seçeneği, varsayılan kapalı |
| V3 | Fotoğraf | URL yapıştırma kalkar, yerine dosya yükleme |
| V4 | Veri talebi | Dışa aktarma aracı gelene kadar talep eden salona veri elle iletilir |
| V5 | Kayıt aktarımı | Yeni salonun müşteri listesini (Excel) aktarmasına ücretsiz yardım edilir |
| **S1** | **Hedef sektör** | **Klinikler de hedefte:** estetik klinikleri, diş hekimleri ve randevuyla çalışan, randevularını takip etmek zorunda olan diğer sektörler. Ürün dili ve ekranlar sektöre göre uyarlanabilir olmalı (ör. "müşteri" / "danışan" / "hasta", "salon" / "klinik"); sağlık verisi kuralları bu yüzden en sıkı hâliyle uygulanır. Tanıtım sitesinde klinik sayfası yer alır. Ayrı berber sayfası kararı da bu çerçevede pazarlama + ürün analistine bırakıldı |
| K1 | Klinik önceliği | Önce **estetik kliniği**, sonra diş hekimi |
| K2 | Klinik rolleri | Klinik modunda **hekim** ve **sağlık personeli** ayrı rol (klinik notunu yalnız hekim yazar) |
| K3 | Kayıttaki işletme türleri | Kuaför, berber, güzellik merkezi, estetik kliniği, diş hekimi, "Diğer randevulu işletme" (diyetisyen, fizyoterapi, psikolog vb.); veteriner ve optik sonra |
| K4 | Terimler | Hazır terim setleri gelir (Salon / Klinik-danışan / Klinik-hasta); sahip ana terimleri değiştirebilir |
| K5 | Kapsam dışı | SGK, sigorta, reçete, e-Nabız bağlantısı olmadığı vitrinde (SSS) açıkça yazılır |
| K6 | Berber sayfası | Ayrı tanıtım sayfası var (fiyat netleşmeden yayına girmez) |
| T1 | Takvim | Kendi takvim bileşenimiz (CSS Grid, personel sütunlu), **sürükle-bırak ilk sürümde var**; FullCalendar ücretli paketi alınmaz |
| T2 | Klinik fotoğraf | Klinikte "Klinik görüntüleri" sekmesi kalır: yükleme saklama rızasıyla (F1), yalnız hekim görür, tanıtımda kullanım (F2) varsayılan kapalı |
| T3 | Online randevu onayı | İşletme ayarı: salonda varsayılan otomatik onay, klinikte varsayılan işletme onayı |
| **A1** | **Tanıtım sitesinde hareket** | Kurucu ilk prototipi "çok sade, düz bir sayfa" buldu. Tanıtım sitesi **hareketli, animasyonlu ve ilgi çekici** olmalı: kaydırırken beliren/dönüşen bölümler, canlı çalışan ürün parçaları, mikro etkileşimler. Panel "sade ve profesyonel" kalır; bu karar yalnız tanıtım sitesi (Persuade modu) içindir. Hareket yine profesyonel olmalı (şablon gibi her bölümde aynı "aşağıdan belirme" değil), `prefers-reduced-motion`'a saygı duyar, telefonda akıcı çalışır |
| **A2** | **Tanıtım sitesinde görsel derinlik** | Kurucu hareketli sürümü de "çok sade" buldu: **beyaz düz üst menü**, bölümler arası **geçişsiz düz renk bantları**, **kart mantığı yok**, "düz yazılar basılmış gibi". İstenen: (1) üst menü beyaz düz şerit olmaz: koyu/renkli hero üstünde saydam, kaydırınca bulanık cam (backdrop-blur) yüzen menü; (2) bölümler birbirine **geçişli** bağlanır (kartların bölüm sınırını taşması, yumuşak renk geçişleri, kavisli/eğik ayraçlar, katmanlı arka plan); (3) içerik **kartlarla** sunulur: bento ızgara özellikler, gölgeli/kenarlıklı yükseltilmiş yüzeyler, SSS kart akordeon, fiyat kartı, kapanış çağrısı tam genişlik düz bant değil yuvarlak köşeli büyük kart; (4) marka renkleriyle (petrol, pudra, mor) yumuşak degrade/ışık lekeleri, ince desen/ızgara dokusu, cihaz çerçeveli ürün görüntüleri. Dürüstlük kuralları (#15) ve A1 hareketleri aynen kalır; panel etkilenmez |
| — | Künye, destek e-postası, WhatsApp/sosyal medya, hakkımızda | **Şimdilik yer tutucu**; yayına çıkmadan önce kurucu ekleyecek |
| — | Fiyat rakamları ve paketler | Tasarım onayından sonra ayrıca konuşulacak; yer tutucu |

## Tasarım kuralları (ekip için)

- Skill öncelik sırası: bu brif → `docs/tasarim.md` → `impeccable` → `design-taste-frontend` → `frontend-design`; denetim için `web-design-guidelines` (Türkçe uyarlamalar dahil).
- Panel, randevu sayfası, giriş/kurulum ve süper yönetici = **Operate** modu (hız, taranabilirlik, tutarlılık). Tanıtım sitesi = **Persuade** modu.
- Önce telefon: 390 px genişlikte tasarlanır; 768 ve 1440 px'te de kontrol edilir. Başparmakla erişilebilir ana eylemler, en az 44 px dokunma alanı.
- Her ekranın yükleniyor / boş / hata / başarı / yetkisiz durumu tasarlanır.
- Yazı tipi Türkçe karakterleri tam desteklemeli (ı, İ, ğ, ş, ç, ö, ü); `latin-ext` alt kümesi.
- Örnek veriler gerçekçi Türkçe (salon, hizmet, isim, ₺ tutar, tarih) ve kendi içinde tutarlı olmalı; uydurma başarı rakamı yok.
