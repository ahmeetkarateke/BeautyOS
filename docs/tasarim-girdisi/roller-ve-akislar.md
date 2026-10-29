# BeautyOS — Roller, İşlev Envanteri ve Akışlar (Aşama 1 girdisi)

- **Tarih:** 2026-10-28 · **Sahibi:** urun-analisti · **Kod:** `tasima/docker` @ `71ee311` (salt okunur kopya, statik inceleme)
- **Kullanım:** `ui-ux-tasarimci` tasarım ve prototip için, `pazarlama` "Yakında" listesi için, `hukuk-uyum` yasal adımlar için okur.
- **Sınır:** Bu belge ürün girdisidir. Gerçek kod değişikliği kararı müdür/kurucudadır; "DEĞİŞİKLİK" işaretli satırlar backend iş listesidir.

---

## 1. Rol ve yetki matrisi

### 1.1 Mevcut durum (kod)

`UserRole` = `owner`, `manager`, `staff`, `superadmin` (`schema.prisma:86`). Bugün kayıt olan kişi `owner` olur; panelden eklenen herkes `staff` olur (`POST /staff` rolü sabit `staff` yazar, `tenant.route.ts:1447`). **`manager` rolünü oluşturmanın hiçbir yolu yok**; resepsiyon ve muhasebe rolü hiç yok. Yetki kontrolü API'de dosya dosya dağınık (`if role !== 'owner' && ...`), arayüzde ise yalnızca menü gizleme (`sidebar.tsx:93`, `mobile-nav.tsx:85`).

### 1.2 Önerilen rol seti (kurucu kararı: yetki unvana göre)

| Rol (arayüz adı) | Kim | Not |
|---|---|---|
| **Salon sahibi** | İşletme sahibi, kayıt olan kişi | Her şey. Tek kişi; rol devredilemez. |
| **Müdür** | Sahibin güvendiği yönetici | Operasyon + rapor + personel. Abonelik, rol atama, modül açma, hesap silme yok. |
| **Resepsiyon** | Telefon/kapı karşılama, tahsilat | Randevu, müşteri, tahsilat ve gün sonu kasa tam. Rapor, prim, Muhasebe/Yönetim, ayar yok. |
| **Uzman / personel** | Hizmeti veren kişi | Yalnız kendi günü, kendi müşterisi, kendi primi/bahşişi. |
| **Muhasebe** (isteğe bağlı) | Mali müşavir / muhasebeci | **İlk tasarımda çizilmez.** Muhasebe/Yönetim grubuna salt-okunur + dışa aktarma. "Sonra" listesinde. Kurucu "gerekli" derse yetki seti Müdür'ün finans kısmıyla aynı kalır, rapor+cari+fatura düzenler, randevu görmez. |
| **Süper yönetici** | Yalnız şirket (BeautyOS ekibi) | Ayrı yüzey (`/admin`), salon verisine girmez. |

Teknik karşılık (yeni `UserRole` değerleri mi, rol → izin tablosu mu) `mimar`ın kararıdır. Tasarım için fark etmez: **4 görünüm** (sahip, müdür, resepsiyon, uzman) çizilir; sahip ile müdür farkları aşağıda "Yalnız sahip" işaretiyle belli.

### 1.3 Gösterim

- **D** = görür ve düzenler (oluşturma, değiştirme, silme dahil; kısıt varsa dipnotta).
- **G** = yalnız görür.
- **K** = yalnız **kendi** kaydı (uzman için: kendi randevusu, kendi müşterisi, kendi primi).
- **—** = hiç görmez; menüde yok, doğrudan adres yazarsa yetkisiz ekranı.
- **API** sütunu: **VAR** = bugünkü API bu satırı zaten böyle uyguluyor (mevcut üç rol için). **DEĞİŞİKLİK** = backend değişmeli, nedeni yazılı. Resepsiyon ve Muhasebe rolü bugün olmadığından, **Resepsiyon sütunundaki her D/G için rolün kendisi de eklenmeli** (sütun yalnız "kural mevcut mu" bilgisini taşır; ayrıca bkz. 1.5).

### 1.4 Matris

**Günlük**

| # | Ekran / eylem | Sahip | Müdür | Resepsiyon | Uzman | API |
|---|---|---|---|---|---|---|
| 1 | Ana sayfa: bugünün randevu sayısı, doluluk, müşteri sayısı | G | G | G | K (kendi günü) | VAR (uzman için ayrı "Günüm" görünümü arayüzde) |
| 2 | Ana sayfa: ciro kartı ve değişim yüzdesi | G | G | — | — | DEĞİŞİKLİK: `GET /dashboard` ciroyu her role döndürüyor (`tenant.route.ts:159`); arayüz kartı gizliyor ama veri yanıtta |
| 3 | Takvim / randevu listesi (gün, hafta, ay) | D | D | D | K | VAR (uzman filtresi sunucuda, `:323`) |
| 4 | Randevu oluştur | D | D | D | K (yalnız kendi adına) | DEĞİŞİKLİK: `POST /appointments` rol/personel kısıtı yok (`:529`); uzman başkası adına açabilir. Arayüz zorluyor, sunucu zorlamıyor |
| 5 | Randevu notu düzenle | D | D | D | K | VAR (`:1120`) |
| 6 | Randevu saatini değiştir (erteleme) | D | D | D | K | DEĞİŞİKLİK: yalnız owner/manager (`:985`). Resepsiyon için eklenmeli; uzman "kendi randevusunu taşıyabilir" kararı kurucuda (bkz. Açık soru 3) |
| 7 | Durum değiştir: geldi / devam ediyor / iptal / gelmedi | D | D | D | K | VAR (uzman yalnız kendi, `:829`) |
| 8 | Randevuyu tamamla + tutar/ödeme yöntemi gir ("Randevuyu Kapat") | D | D | D | K | VAR (uzman kendi randevusu). DEĞİŞİKLİK önerisi: uzman tutarı değiştiremesin (hizmet fiyatıyla kapansın), değiştirme Resepsiyon/Müdür/Sahip'te |
| 9 | Randevuyu sil (kalıcı) | D | D | — (iptal edebilir, silemez) | — | VAR (owner/manager); Resepsiyon için iptal durumu zaten 7 |
| 10 | Hızlı işlem (randevusuz satış) | D | D | D | K | VAR (aynı kurallar) |
| 11 | Bekleme listesi: görüntüle | D | D | D | — | DEĞİŞİKLİK: bugün uzman da görür/ekler (`waitlist.route.ts:52,128`); müşteri telefonu içeriyor |
| 12 | Bekleme listesi: bildir, randevuya çevir | D | D | D | — | VAR (`/notify`, `/book` rol kısıtsız); sil/süresini bitir yalnız owner/manager (`:235,334`) — Resepsiyon için DEĞİŞİKLİK |

**Müşteri**

| # | Ekran / eylem | Sahip | Müdür | Resepsiyon | Uzman | API |
|---|---|---|---|---|---|---|
| 13 | Müşteri listesi, arama | D | D | D | K (kendi randevusu olanlar) | DEĞİŞİKLİK: `GET /customers` tüm müşterileri tüm rollere döndürüyor (`:383`) |
| 14 | Müşteri ekle | D | D | D | D (yalnız ekle; randevu oluştururken satır içi) | VAR |
| 15 | Müşteri düzenle, notlar | D | D | D | G | DEĞİŞİKLİK: `PATCH /customers/:id` rol kısıtsız (`:1557`), uzman düzenleyebiliyor |
| 16 | Telefon numarası görünürlüğü | Tam | Tam | Tam | **Tam, yalnız kendi müşterisinde**; diğer müşterilerde **maskeli** (R4, kurucu kararı; 0532 *** ** 12). Hukuk-uyum görüşüyle birleşik: toplu liste/dışa aktarma yok | DEĞİŞİKLİK (13 ile aynı) |
| 17 | Anamnez (sağlık formu) görme ve doldurma | D | D | — | D (yalnız kendi müşterisi) | DEĞİŞİKLİK: `ALLOWED_ROLES_*` staff dahil, rol/müşteri ayrımı yok (`customer-enrichment.route.ts:25`). Özel nitelikli kişisel veri: Resepsiyon'a kapalı önerilir, **hukuk-uyum teyidi bekliyor** |
| 18 | Anamnez soru bankası yönetimi | D | D | — | — | VAR (`:27`) |
| 19 | Müşteri fotoğrafları (görme, ekleme, silme) | D | D | — (hukuk-uyum: yüz/vücut görüntüsü hassas; resepsiyonun işi değil) | K (kendi müşterisi; "kendi müşterisi" = ileri tarihli veya son ~12 ay içinde tamamlanmış randevusu olan, süre mimar+kurucu) | DEĞİŞİKLİK (17 ile aynı). Resepsiyon randevu kartında "Sağlık notu var" işaretini de görmez; takvim, bildirim ve kasada sağlık verisi gizli |
| 20 | Müşteri kartındaki cari bakiye | D | D | G | — | DEĞİŞİKLİK: cari uçları staff'a açık (bkz. 31) |
| 21 | Paket şablonları (görme) | D | D | G | G | VAR |
| 22 | Paket şablonu oluştur/düzenle/sil | D | D | — | — | VAR |
| 23 | Müşteriye paket sat | D | D | D | — | DEĞİŞİKLİK: `POST /customer-packages` rol kısıtsız (`packages.route.ts:237`); arayüz uzmandan gizliyor, sunucu izin veriyor |
| 24 | Paket seansı kullan | D | D | D | K | VAR (`:290`) |
| 25 | Müşteri paketini düzenle / iptal / iade | D | D | — | — | VAR (`:365`) |

**Personel ve hizmet**

| # | Ekran / eylem | Sahip | Müdür | Resepsiyon | Uzman | API |
|---|---|---|---|---|---|---|
| 26 | Hizmet listesi (ad, süre, fiyat) | D | D | G | G | VAR |
| 27 | Hizmet ekle/düzenle/sil, prim oranı | D | D | — | — | VAR |
| 28 | Personel listesi (ad, renk, çalışma saati) | D | D | G | G (yalnız ad/renk, takvim filtresi için) | DEĞİŞİKLİK: yanıtta e-posta var (`:484`); minimum alan seti gerekir |
| 29 | Personel ekle/düzenle/çıkar, çalışma saati | D | D | — | — | VAR (`:1419–1523`) |
| 30 | Personele hizmet atama (yetenekler), izin ekleme/silme | D | D | — | G (kendi izinleri) | DEĞİŞİKLİK: yazma yalnız owner (`:2047,2081,2129,2157`); Müdür personel ekleyip hizmet atayamıyor, tutarsız |
| 31 | **Kullanıcıya rol verme / kullanıcı daveti / başkasının şifresini sıfırlama** | **Yalnız sahip** | — | — | — | DEĞİŞİKLİK: rol atama ve davet akışı yok; `POST /staff` rolü hep `staff`. Şifre sıfırlama owner-only VAR (`:1252`) |
| 32 | Personel ödemeleri (prim hakediş hesapla, oluştur, ödendi işaretle, düzenle, sil) | D | D | — | K (yalnız "Benim hakedişim" liste) | VAR (sunucu uzmanı kendi kaydına kısıtlıyor, `staff-payouts.route.ts:159`). Arayüz uzmanı yönlendiriyor (`page.tsx:81`): "Benim primim" ekranı **yok, yeni çizilecek** |
| 33 | Bahşiş: kayıt gir | D | D | D | — | DEĞİŞİKLİK: yalnız owner/manager (`tips.route.ts:118`); Resepsiyon için eklenmeli |
| 34 | Bahşiş: havuzu dağıt, düzenle, sil | D | D | — | — | VAR |
| 35 | Bahşiş: kendi bahşişi | — | — | — | K | VAR (`:208`) |

**Finans ve stok** (menüde "Muhasebe/Yönetim" grubu, kurucu kararı 7)

| # | Ekran / eylem | Sahip | Müdür | Resepsiyon | Uzman | API |
|---|---|---|---|---|---|---|
| 36 | **Günlük kasa özeti** (gün cirosu, nakit/kart, tahsilat listesi) | D | D | G (bugün) | — | **DEĞİŞİKLİK — AÇIK 1.** `GET /reports/daily` rol kontrolsüz (`:1719`), uzman tüm salon cirosunu çekebilir |
| 37 | **Gün sonu kasa kapama** | D | D | D | — | **DEĞİŞİKLİK — AÇIK 1.** `POST /finance/close-day` rol kontrolsüz (`:1606`) |
| 38 | Manuel gelir ekle | D | D | D | — | **DEĞİŞİKLİK — AÇIK 1.** `POST /revenues` rol kontrolsüz (`:1910`) |
| 39 | Gider ekle | D | D | — (R6: kurucu kararı) | — | DEĞİŞİKLİK: yalnız owner (`:1957`). Müdür için genişletilmeli |
| 40 | Gider sil | D | D | — | — | DEĞİŞİKLİK: yalnız owner (`:1992`) |
| 41 | Gelir-gider raporu (tarih aralığı, günlük döküm) | D | D | — | — | **DEĞİŞİKLİK — AÇIK 1** (aynı uç, 36) |
| 42 | **Personel prim raporu** | D | D | — | K (yalnız kendi) | **DEĞİŞİKLİK — AÇIK 1.** `GET /reports/staff-commissions` rol kontrolsüz (`:1844`); uzman herkesin primini görür |
| 43 | **Banka & Kasa hesapları** (bakiye, hareket, transfer) | D | D | — | — | **DEĞİŞİKLİK — AÇIK 2.** `ALLOWED_ROLES_READ` içinde `staff` var (`financial-accounts.route.ts:24`): uzman bakiyeleri okur |
| 44 | **Cari hesap** | D | D | — | — | **DEĞİŞİKLİK — AÇIK 2** (`current-accounts.route.ts:18`) |
| 45 | **Alış faturaları** | D | D | — | — | **DEĞİŞİKLİK — AÇIK 2** (`purchase-invoices.route.ts:24`) |
| 46 | **Tedarikçiler** (liste) | D | D | — | — | DEĞİŞİKLİK: `GET /suppliers` rol kontrolsüz (`stock.route.ts:419`) |
| 47 | Stok: ürün listesi, düşük stok uyarısı | D | D | G | G | VAR (okuma açık) |
| 48 | Stok: ürün ekle/düzenle/sil, hareket gir, reçete, otomatik düşüm | D | D | — | — | VAR (`requireOwnerOrManager`) |

**Ayarlar ve hesap**

| # | Ekran / eylem | Sahip | Müdür | Resepsiyon | Uzman | API |
|---|---|---|---|---|---|---|
| 49 | Salon profili: ad, telefon, adres, çalışma saatleri | D | D | G | — | VAR |
| 50 | Online randevu sayfası ayarları (aç/kapa, marka, logo, WhatsApp, harita) | D | D | — | — | VAR |
| 51 | Modül aç/kapat | D | — | — | — | DEĞİŞİKLİK: bugün owner+manager (`:1192`); ayrıca modül kapıları yalnız arayüzde, sunucuda yok (bulgu 6) |
| 52 | Deneme/plan durumu ve abonelik | G | — | — | — | VAR (arayüz); iletişim adresi düzeltilecek |
| 53 | Hesabım: kendi şifresini değiştir | D | D | D | D | VAR (API); **arayüz uzmandan "Ayarlar"ı saklıyor, uzman şifresini değiştiremiyor** — "Hesabım" ayrı, tüm roller için görünür çizilecek |
| 54 | Bot ayarları, bot konuşmaları (bayrak açıksa) | D | — | — | — | VAR (konuşmalar owner-only) |
| 55 | Veri dışa aktar / hesabı kapat | D | — | — | — | Uç yok — "Yakında" (bkz. 4) |

### 1.5 Denetçinin bulduğu açık ve yeri

Geçen incelemede denetçinin işaret ettiği "uzmanın kasa/rapor/komisyon uçlarına erişimi" şu satırlara oturuyor:

- **AÇIK 1 (para):** 36, 37, 38, 41, 42. Dört uç **hiç rol kontrolü içermiyor** (`/finance/close-day`, `/reports/daily`, `/reports/staff-commissions`, `/revenues`); arayüzde yalnızca menü ve sayfa yönlendirmesiyle saklanıyor. Uzman adres çubuğundan ya da API'yi doğrudan çağırarak tüm salon cirosunu, herkesin primini görebilir, **sahte gelir kaydı ekleyebilir veya günü kapatabilir**. Aynı nedenle satır 2 (ana sayfa cirosu) de açık.
- **AÇIK 2 (bakiye ve alacak/borç):** 43, 44, 45, 46. `ALLOWED_ROLES_READ = owner, manager, staff`: uzman banka bakiyesini, cari borçları, alış faturalarını okur. Yazma kapalı.
- **AÇIK 3 (müşteri verisi):** 13, 15, 17, 19, 23. Uzman tüm müşterileri ve sağlık formlarını okuyabilir, müşteri düzenleyebilir, paket satabilir.
- **Menü sızıntısı:** `sidebar.tsx`'te uzmandan yalnızca `/staff`, `/staff-payouts`, `/finance`, `/settings` gizleniyor. **Banka & Kasa, Cari Hesap, Alış Faturaları, Tedarikçiler uzmana menüde görünüyor** ve API izin verdiği için içi doluyor.
- **Genel öneri:** yetki kontrolü tek bir ara katmana (`requirePermission('finance.report')` gibi) toplanmalı; arayüz menüsü de aynı izin tablosundan üretilmeli. Matrisin sürdürülmesi bu sayede tek yerden olur.

### 1.6 Tasarımcının sorularına cevap (ui-ux-tasarimci, `[SORU]`)

- **Resepsiyon = yeni rol mü, unvan→yetki seti mi?** Ürün tarafında fark yok; **4 görünüm çiz**. Kurucu kararı "yetki unvana göre": arayüzde kişiye bir unvan seçilir, unvan yetki setini getirir. Önerdiğin set doğru, tek farkım: **gün sonu kasa kapama ve bugünkü kasa özeti Resepsiyon'da var** (tahsilatı alan kişi kasayı kapatır); geçmiş gün raporu, gelir-gider, prim raporu, Muhasebe/Yönetim ve ayarlar yok. Kurucu farklı isterse tek satırlık değişiklik (Açık soru 2).
- **Uzman kendi randevusunu oluşturabilir/taşıyabilir mi?** Oluşturma: bugün arayüzde yalnız kendi adına; **evet** çiz. Taşıma: bugün sunucuda yok (yalnız sahip/müdür); önerim **evet, yalnız kendi randevusu** (telefonda "yarın kayabilir miyiz" diyen müşteriyi uzman da yönetsin). Kurucu teyidi bekliyor; prototipte çiz, "teyit bekliyor" notu düş.
- **Müşteri telefonu tam görünür mü?** Sahip, Müdür, Resepsiyon: tam. Uzman: yalnız **kendi randevusu olan** müşterilerde tam (aramak için); başka müşteriler görünmez. Maskeleme (0532 *** ** 12) kurucu isterse eklenir; varsayılan değil.

---

## 2. İşlev envanteri (kontrol listesi)

Yeniden tasarımda hiçbir işlev kaybolmayacak. Her satır bir kutu: tasarımda ekranı/eylemi çizildi mi? Durum sütunu: `[ ]` henüz kontrol edilmedi (Aşama 3'te işaretlenir). Yol: web `apps/web/src/app/...`, API `apps/api/src/routes/...`.

### 2.1 Yüzey A: Salon paneli

**A1 Ana sayfa (`dashboard`)**
- [ ] A1.1 Dönem seçimi: bugün / hafta / ay
- [ ] A1.2 Kartlar: randevu sayısı (+değişim %), ciro (+değişim %), müşteri sayısı, doluluk oranı
- [ ] A1.3 Uzman için sade görünüm (bugün kartları gizli; yeni: "Günüm")
- [ ] A1.4 Deneme süresi uyarısı ("N gün kaldı") ve süresi dolunca `subscription-required` ekranı
- [ ] A1.5 Hızlı kısayollar (yeni randevu vb.): kodda doğrulanmadı, ekran envanteri bakacak

**A2 Randevular (`appointments`)**
- [ ] A2.1 Takvim: gün / hafta / ay görünümü
- [ ] A2.2 Boş aralığa tıklayıp randevu açma
- [ ] A2.3 Personel, durum, müşteri adı filtreleri; filtreleri temizle
- [ ] A2.4 Yeni randevu: müşteri (arama + satır içi yeni müşteri), hizmet, personel (hizmete göre filtreli), müsait saat seçimi, not
- [ ] A2.5 Randevu detayı: müşteri (tıkla-ara), hizmet, personel, saat, ücret, not, durum rozeti
- [ ] A2.6 Saat değiştir (erteleme), not düzenle (500 karakter), sil (onaylı)
- [ ] A2.7 Durum güncelle: Bekliyor, Onaylı, Devam ediyor, Tamamlandı, İptal, Gelmedi
- [ ] A2.8 Randevuyu kapat: tutar (₺) + ödeme yöntemi (nakit / kart) → tahsilat kaydı, prim hesabı, stok düşümü, paket seansı düşümü (tamamlanmış/iptal/gelmedi kilitli)
- [ ] A2.9 Hızlı işlem: randevusuz anlık hizmet + ödeme
- [ ] A2.10 Sürükle-bırak taşıma: **VAR** (frontend-gelistirici doğruladı, `ekran-envanteri.md` §0-1): yalnız gelecekteki ve sonlanmamış randevu, yalnız sahip/müdür (`isEditable`), `PATCH /reschedule`. Telefonda sürükleme zor olduğundan "saati değiştir" eylemi de kalır. Bilinen hata: takvim tarih aralığı vermeden çektiği için yalnız ilk 10 randevu görünüyor (tasarımda gün/hafta aralığı tam yüklenmeli)
- [ ] A2.11 Randevu kaynağı rozeti (manuel / web / bot)

**A3 Bekleme listesi (`waitlist`)**
- [ ] A3.1 Listeye ekle (müşteri, hizmet, tercih tarih/personel)
- [ ] A3.2 Müşteriyi bilgilendir (mesaj önizleme + gönder)
- [ ] A3.3 Randevuya çevir
- [ ] A3.4 Süresini bitir, sil

**A4 Müşteriler (`customers`)**
- [ ] A4.1 Liste + arama; segment rozeti (VIP, Düzenli, Pasif, Risk altında; **segment hiç hesaplanmıyor**, bkz. 4)
- [ ] A4.2 Yeni müşteri (sayfa ve modal), düzenle
- [ ] A4.3 Müşteri kartı sekmeleri: Genel, Müşteri Hakkında (anamnez), Fotoğraflar, Ziyaret Geçmişi
- [ ] A4.4 İletişim bilgileri (tel, e-posta, doğum tarihi vb.), notlar
- [ ] A4.5 Anamnez formu doldurma/kaydetme (sektöre göre soru seti)
- [ ] A4.6 Fotoğraflar: kategori (Saç öncesi/sonrası, Tırnak, Cilt, Diğer), URL ile ekle, büyüt (lightbox), sil
- [ ] A4.7 Randevu geçmişi
- [ ] A4.8 Cari hesap kartı (bakiye, hareket bağlantısı)
- [ ] A4.9 Müşteriye paket sat; müşterinin aktif paketleri, kalan seans, kullanım geçmişi

**A5 Paketler (`packages`)**
- [ ] A5.1 Paket şablonu: ekle, düzenle, sil (hizmet, seans sayısı, fiyat, geçerlilik)
- [ ] A5.2 Müşteri paketleri listesi (durum: aktif, tamamlandı, süresi doldu, iade)
- [ ] A5.3 Seans kullan, paket düzenle/iptal/iade, kullanım geçmişi

**A6 Hizmetler (`services`)**
- [ ] A6.1 Kategoriye göre liste; ekle, düzenle, sil (ad, süre, fiyat, prim oranı, kategori)
- [ ] A6.2 Stok reçetesi (hizmet başına malzeme miktarı) ve otomatik düşüm
- [ ] A6.3 Uzmana salt-okunur görünüm (fiyat/süre bilgisi)

**A7 Personel (`staff`, `staff/[id]`)**
- [ ] A7.1 Liste, ekle (e-posta + şifre), düzenle, çıkar
- [ ] A7.2 Profil: unvan, renk, haftalık çalışma saatleri (7 gün), prim oranı/türü
- [ ] A7.3 Yetenekler (hangi hizmeti verir)
- [ ] A7.4 İzinler (gün/hastalık/yıllık/diğer): ekle, sil
- [ ] A7.5 Ödeme geçmişi sekmesi
- [ ] A7.6 Uzman için "Benim sayfam" (yeni; bugün uzman bu sayfaya giremiyor)

**A8 Personel ödemeleri (`staff-payouts`)**
- [ ] A8.1 Dönem için hakediş hesapla (önizleme), oluştur, düzenle, sil
- [ ] A8.2 Ödendi olarak işaretle; durum filtreleri; personel/tarih filtreleri

**A9 Bahşiş (`tips`)**
- [ ] A9.1 Bahşiş kaydı ekle (kaynak: nakit/kart; havuz/kişiye)
- [ ] A9.2 Personel bazlı toplamlar, kayıt listesi, dağıtılmamış havuz uyarısı
- [ ] A9.3 Havuzu dağıt (pay ayarı), dağıtım geçmişi; kayıt düzenle/sil

**A10 Günlük kasa (`finance`)**
- [ ] A10.1 Tarih seçici: bugün / hafta / ay / yıl / özel aralık
- [ ] A10.2 Özet: toplam ciro, nakit, kart, gider, net; günlük döküm
- [ ] A10.3 Tahsilat listesi (saat, müşteri, hizmet, tutar, yöntem), kategori filtresi
- [ ] A10.4 Gider ekle (kategori: Yemek, Malzeme, Fatura, Personel, Kira, Temizlik, Ekipman, Diğer), gider sil
- [ ] A10.5 Manuel gelir ekle
- [ ] A10.6 Gün sonu kapama (özet: ciro, nakit/kart, gider, net kâr, personel primleri)
- [ ] A10.7 Yazdır
- [ ] A10.8 Personel prim özeti (günlük)

**A11 Muhasebe/Yönetim grubu**
- [ ] A11.1 Banka & Kasa: hesap listesi/detay, hesap ekle/düzenle/sil, hareket ekle/sil, hesaplar arası transfer
- [ ] A11.2 Cari hesap: liste (müşteri/tedarikçi), hareket dökümü, borç/alacak girişi, hareket sil
- [ ] A11.3 Alış faturaları: liste, yeni fatura (kalemler), detay, "işle" (stok+cari etkisi), iptal, sil
- [ ] A11.4 Tedarikçiler: liste, ekle, düzenle, sil
- [ ] A11.5 Stok: ürün listesi, düşük stok, ürün ekle/düzenle/sil, stok hareketi (giriş/çıkış/sayım/iade), hareket sil, hizmet reçeteleri

**A12 Ayarlar (`settings`)**
- [ ] A12.1 Salon profili (ad, telefon, adres, çalışma saatleri)
- [ ] A12.2 Gelişmiş: işletme türü (11 tür), hizmet kategorileri (sektör varsayılanına sıfırla)
- [ ] A12.3 Online randevu: aç/kapa, bağlantı, marka rengi, logo URL, kapak URL, WhatsApp, Google Maps, tanıtım metni
- [ ] A12.4 Modüller (aç/kapat; 18 modül anahtarı)
- [ ] A12.5 Hesabım: şifre değiştir
- [ ] A12.6 Anamnez soruları yönetimi (soru ekle/düzenle/sil)
- [ ] A12.7 Entegrasyonlar: WhatsApp "onay bekleniyor", Telegram "test kanalı" bilgi kartları (**tasarımda yanıltıcı olmayacak biçimde ele alınacak**, bkz. 4)
- [ ] A12.8 Bot ayarları (tanıtım, ton, özel kurallar, SSS) ve Bot konuşmaları ekranı: bayrağa bağlı (`NEXT_PUBLIC_BOT_FEATURES_ENABLED`), canlıda kapalı
- [ ] A12.9 `subscription-required` sayfası (deneme/abonelik bitti)

**A13 Ortak kabuk**
- [ ] A13.1 Gezinme (masaüstü kenar menü, mobil alt/üst menü), grup aç/kapa, modül ve rol filtresi
- [ ] A13.2 Çıkış, kullanıcı adı/e-posta gösterimi
- [ ] A13.3 Koyu tema anahtarı: **kurucu kararı 13: sonra**, bugün var; yeni tasarımda çizilmez, tokenlar hazır
- [ ] A13.4 Toast bildirimleri, onay iletişim kutuları, yükleniyor/boş/hata durumları

### 2.2 Yüzey B: Müşterinin online randevu sayfası (`book/[slug]`)
- [ ] B1 Salon tanıtımı: ad, logo, kapak, marka rengi, telefon, WhatsApp, harita, tanıtım
- [ ] B2 Adımlar: hizmet → personel (veya "fark etmez") → tarih → saat → iletişim
- [ ] B3 İletişim: ad-soyad, telefon, not
- [ ] B4 Telefon doğrulama: 6 haneli SMS kodu (10 dk), tekrar gönder, doğrulanmadan randevu yok
- [ ] B5 Onay ekranı: özet + **referans kodu**
- [ ] B6 Randevu kapalıyken bilgi sayfası ("Bu salon şu anda online rezervasyon kabul etmiyor"), salon bulunamadı durumu
- [ ] B7 Hız sınırı hata mesajları, dolu saat, geçersiz kod durumları
- [ ] B8 Müşterinin iptal/değiştirme yolu: **kodda yok** (bkz. akış 3.4 ve "Yakında")

### 2.3 Yüzey C: Giriş, kayıt, kurulum
- [ ] C1 Giriş (e-posta + şifre, hata, hız sınırı mesajı)
- [ ] C2 Kayıt: 2 adım (salon adı + bağlantı adı/slug; ad-soyad, telefon, e-posta, şifre; işletme türü). 30 gün deneme
- [ ] C3 Şifremi unuttum, şifre sıfırlama (**e-posta gitmiyor**, bilinen sorun; tasarım akışı çizer, vitrin "çalışıyor" demez)
- [ ] C4 Kurulum sihirbazı: 4 adım (Salon, Hizmetler, Personel, Bitiş)
- [ ] C5 Eksik olup eklenecek: çalışma saati adımı (kurulum öneri 18), rezervasyon bağlantısı kopyala/QR, "ilk randevunu oluştur" yönlendirmesi

### 2.4 Yüzey D: Tanıtım sitesi
Mevcut tek sayfa `(marketing)/page.tsx` (hero, özellikler, güven bandı, rakam bandı, fiyat, SSS). İçerik `pazarlama`ndan; ürün tarafı yalnız doğruluk denetimi: bkz. bölüm 4.

### 2.5 Yüzey E: Süper yönetici (`/admin`)
- [ ] E1 Ayrı giriş (`/admin/login`, `POST /auth/admin-login`)
- [ ] E2 Genel bakış: toplam salon, aktif, deneme, süresi dolan, son 30 günde kayıt
- [ ] E3 Salon listesi: arama (ad/slug), plan filtresi (trial, starter, pro), aktif/pasif filtresi; satırda sahip adı/e-posta/telefon, kullanıcı/randevu/müşteri sayısı
- [ ] E4 Salon detayı: plan değiştir, aktif/pasif yap, deneme bitişini uzat, son 30 gün özeti (randevu, müşteri, ciro, son hareket)
- [ ] E5 Süper yönetici oluşturma (`/admin/seed`, yalnız gizli anahtarla; arayüzü yok, çizilmez)

### 2.6 Envanter karşılaştırması (frontend-gelistirici)
`docs/tasarim-girdisi/ekran-envanteri.md` bu belge yazılırken henüz yoktu. Hazır olunca karşılaştırıp farkları `frontend-gelistirici`ya ileteceğim; sonuçlar `inceleme-urun-analisti.md`'ye yazılır. Önceden bilinen, onun envanterinde bulunması gerekenler: bot-konuşmaları ekranı, `subscription-required`, `customers/new` sayfası ile modalın ikiliği, `settings/modules` alt sayfası ve `purchase-invoices/new`.

---

## 3. Akışlar

Hepsi **telefon önce (390 px)**, başparmakla ulaşılabilir ana eylem, tek elle kullanım. "Mevcut" = bugünkü ürün, "Yeni" = tasarımda eklenen/eksik kapatılan adım.

### 3.1 Salon sahibi: kayıt, kurulum, ilk randevu

1. Tanıtım sitesinde "Ücretsiz dene" → kayıt.
2. **Kayıt, adım 1/2:** salon adı, bağlantı adı (slug; anlık "kullanılabilir mi" denetimi, `beautyossapp.com/book/<slug>` önizleme), işletme türü.
3. **Kayıt, adım 2/2:** ad-soyad, telefon, e-posta, şifre (en az 8, harf + rakam). **Yeni (hukuk-uyum):** hizmet şartları + gizlilik + veri işleme sözleşmesi (DPA) kutusu (zorunlu) ve kabul kaydı. Ticari ileti onayı ayrı, isteğe bağlı, varsayılan kapalı.
4. Hesap açılır, 30 günlük deneme başlar, hoş geldin e-postası (gönderim sorunu bilinen).
5. **Kurulum sihirbazı:** (1) Salon: ad, telefon, adres; **Yeni: çalışma saatleri.** (2) Hizmetler: sektör şablonundan hazır hizmet (ad, süre, fiyat) seç/düzenle; **Yeni: şablon önerisi.** (3) Personel: ekle (ad, e-posta, unvan, hangi hizmetleri verir). Atlanabilir; sahip tek başınaysa "sadece ben" seçeneği. (4) Bitiş: **Yeni: kontrol listesi** (Hizmet ekle, Personel ekle, İlk randevuyu oluştur, Rezervasyon bağlantısını paylaş) ve bağlantı kopyala.
6. Ana sayfa: ilk açılışta "İlk randevunu oluştur" büyük eylemi.
7. Randevular → "+" (başparmak bölgesinde yüzen eylem): müşteri ara/yeni ekle → hizmet → personel → müsait saat → kaydet. Randevu takvimde görünür.
8. İsteğe bağlı sonraki adımlar: rezervasyon sayfasını açma (Ayarlar → Online randevu → aç), personel ekleme/rol verme.
- **Durumlar:** bağlantı adı alınmış, zayıf şifre, e-posta kayıtlı, hız sınırı (5 kayıt/saat), yükleme, ağ hatası.

### 3.2 Resepsiyon: telefonla gelen randevu

**Giriş (yeni randevu).** Telefon çalar → Resepsiyon açık uygulamada "+ Yeni randevu".
1. Müşteri alanına numarayı/adı yazar → liste. Kayıtlıysa seç (son ziyaret, not görünür); değilse "Yeni müşteri" satır içi (ad + telefon yeter).
2. Hizmet seç → personel seç ("fark etmez" yeni öneri; yalnız o hizmeti veren uzmanlar listelenir) → tarih → **yalnız müsait saatler** (sunucu `/slots`).
3. İsteğe bağlı not → Kaydet. Onay: toast + takvimde ilgili güne gitme. Dolu saat seçilirse hata ve alternatif saatler.
4. Müşteriye "randevunuz kaydedildi" mesajı **bugün otomatik gitmiyor** (SMS kapalı); arayüz "Müşteriyi WhatsApp'tan bilgilendir" bağlantısı (hazır metinle `wa.me`) sunar. Bu bir geçici çözümdür, gerçek hatırlatma "Yakında".

**Değiştirme.** Müşteri "saati kaydırabilir miyiz?" der.
1. Takvim/arama → randevuya dokun → Detay.
2. "Saati değiştir" → yeni gün/saat (yalnız müsait) → Kaydet. Çakışma varsa hata. (Not: bugün yalnız sahip/müdür yapabiliyor; Resepsiyon için yetki ekleniyor, satır 6.)
3. İptal: Durum → "İptal edildi" + isteğe bağlı neden. Silme yok (Resepsiyon).
4. Gelmeyen müşteri: Durum → "Gelmedi". (Gece otomatik işaretleme ayrıca çalışır.)

**Tamamlama ve ödeme.**
1. Müşteri hizmeti bitirir → Resepsiyon randevuyu açar → "Tamamla".
2. "Randevuyu kapat": tutar (varsayılan hizmet fiyatı; Resepsiyon değiştirebilir, indirim için), ödeme yöntemi (nakit / kart). Müşterinin aktif paketi varsa **Yeni: "Paketten düş"** seçeneği öne çıkar (bugün paket kullanımı ayrı bölümden yapılıyor).
3. Kaydet → tahsilat kaydı, uzmanın primi hesaplanır, reçete varsa stok düşer.
4. Bahşiş varsa "+ Bahşiş" (kişiye/havuza).
5. Kayıtlı sonuç satırı: "Tahsil edildi 750 ₺ nakit". Geri alma yok (tamamlanmış kilitli): hata düzeltmesi sahip/müdür işi, "yanlış tutar" için düzeltme akışı **tasarlanmalı** (Açık soru 5).
- **Hızlı işlem:** randevusuz gelen müşteri için "Hızlı işlem" (müşteri + hizmet + personel + ödeme) tek ekranda.

### 3.3 Uzman / personel: günüm

1. Girişte doğrudan **Günüm**: bugünün sıralı randevuları (saat, müşteri adı, hizmet, süre, durum), şu anki/sonraki randevu vurgusu. Bugün ciro/rapor kartı yok.
2. Randevuya dokun → detay: müşteri adı, tel (tıkla-ara), hizmet, not, müşteri kartına bağlantı (anamnez/uyarı rozeti: alerji vb.).
3. Müşteri geldi → "Başla" (Devam ediyor) → iş bitince "Tamamla" (tutar önceden dolu, ödeme yöntemi; yetki kurucu kararı, Açık soru 3).
4. Müşteri gelmediyse "Gelmedi".
5. Kendi randevusunu ekleme: "+ Randevu" (personel alanı kilitli ve kendisi).
6. **Benim primim** (yeni ekran): bu ay hizmet sayısı ve ciro, hesaplanan prim, ödeme geçmişi (hakediş durumu: ödendi/bekliyor), bahşişlerim.
7. **Hafta/ay** görünümü: kendi takvimi (yalnız kendi); izinlerim (salt-okunur).
8. Hesabım: şifre değiştir (bugün erişilemiyor, yeni).
9. Göremez: kasa, rapor, başkasının primi, finans menüsü, diğer personel randevuları, diğer müşteriler.

### 3.4 Müşteri: online randevu (iptal/değiştirme yolu dahil)

**Randevu alma** (bağlantı: WhatsApp/Instagram/Google profili; telefon, ışık yok, tek elle):
1. Salon başlığı (logo, ad, telefon/WhatsApp/harita kısayolları).
2. **Hizmet** seç (kategori, süre, fiyat).
3. **Personel** seç ("Fark etmez" varsayılan).
4. **Tarih** (kaydırılabilir gün şeridi, kapalı günler pasif) → **Saat** (müsait saat düğmeleri).
5. **Bilgiler:** ad-soyad, telefon, not. **Yeni (hukuk-uyum):** KVKK aydınlatma metnine bağlantı (salona özel), kabul kutusu **gerekmez ama bilgilendirme zorunlu**; SMS ile bilgilendirme (işlem mesajı) ve ticari ileti **ayrı** ve isteğe bağlı.
6. **Telefon doğrulama:** "Kod gönder" → 6 haneli kod (10 dk) → doğrula. Mevcut tasarım bunu 5. adımın ortasında tutuyor; öneri: doğrulamayı **son adıma** al ve tek ekranda göster (SMS kapalıyken tüm akış çalışmıyor, kanal kararı Açık soru 6).
7. **Onay:** özet (hizmet, uzman, tarih-saat, fiyat) + **referans kodu** + "Takvime ekle" (.ics, Yeni) + salon telefonu/WhatsApp.
- Hatalar: saat bu arada doldu (alternatif sun), kod yanlış/süresi doldu, hız sınırı, salon kapalı.

**İptal / değiştirme.**
- **Bugün kodda yok.** `public.route.ts` yalnızca rezervasyon alıyor; müşteri randevusunu kendisi iptal edemez, referans kodu bir yere girilemez.
- **Tasarlanacak hedef akış (MVP+1, ürün kararı Açık soru 7):** hatırlatma SMS'indeki/onay ekranındaki imzalı bağlantı → "Randevunuz: Cuma 14:30" → [İptal et] / [Saati değiştir]. İptal: neden (isteğe bağlı) → onay → salona bildirim. Değiştir: yeni müsait saat seçimi. Kural: salonun belirlediği iptal penceresi (ör. randevudan 12 saat öncesine kadar; sonrası "salonu arayın").
- **Şimdilik (dürüst ara çözüm):** onay ekranında "Randevunuzu değiştirmek veya iptal etmek için salonu arayın" + tek dokunuşla ara + hazır metinli WhatsApp ("<Referans> kodlu randevumu ... yapmak istiyorum"). Tasarımda bu ekran çizilir ve "yakında: kendiniz iptal edebileceksiniz" **vaadi verilmez**.

### 3.5 Gün sonu kasa

Kim: Resepsiyon (veya Müdür/Sahip).
1. Akşam "Günlük kasa" → bugün seçili. Gün özeti: toplam ciro, nakit, kart, gider, net; tahsilat listesi (hizmet, saat, yöntem).
2. **Sayım (yeni):** "Kasadaki nakit" girişi → beklenen nakit ile fark gösterilir (fark ≠ 0 ise neden notu). Bugün sayım alanı yok; tasarım ekleyebilir, kapama bunsuz da çalışır.
3. Eksikler: kapatılmamış (hâlâ Bekliyor/Devam eden) randevu uyarısı → listeden "Tamamla / Gelmedi / İptal".
4. Gün içi gider yoksa "Gider ekle" (kategori, tutar, açıklama).
5. "Günü kapat" → özet raporu (ciro, nakit/kart, gider, net kâr, personel primleri) → yazdır / paylaş.
6. Sahip/Müdür sonradan geçmiş günleri, haftayı, ayı görür ve Banka & Kasa'ya aktarım kaydı yapar. **Kapatılan günü yeniden açma:** bugün tanımsız (Açık soru 5).
- Uzman bu ekranı hiç görmez (AÇIK 1 kapanmalı).

### 3.6 Süper yönetici işleri

1. `/admin/login` (ayrı giriş) → Genel bakış: toplam, aktif, deneme, süresi dolan, son 30 gün kayıt.
2. **Yeni kayıt kontrolü:** Salon listesi → deneme planındakiler → sahip bilgisi (ad, e-posta, telefon) ile iletişim.
3. **Deneme uzatma:** salon detayı → deneme bitişini yeni tarihe uzat.
4. **Abonelik açma (elle tahsilat):** müşteri havaleyle öder (şirket dışı) → plan = starter/pro seç → salonu aktif yap. Bugün **ödeme kaydı/fatura numarası/not alanı yok**; tasarım not alanı ister (yeni, backend gerekir).
5. **Pasife alma:** ödemesi gelmeyen salonu pasif yap (müşteri girişte `subscription-required` görür).
6. **Sağlık bakışı:** son 30 gün randevu/müşteri/ciro, son hareket tarihi: sessiz kalmış denemeler için destek araması.
- Yapamaz/yok (bilerek): salon silme, salon verisine girme (görünüm taklidi), toplu işlem, faturalama, destek bileti. "Sonra" listesi.

---

## 4. "Yakında" listesi (pazarlama için)

Kodda **yok veya yarım** olup tanıtım sitesinde/SSS'de vaat edilmiş ya da müşterinin bekleyeceği işlevler. Kurucu kararı 15: yanıltıcı ifade kalkar, geliştirilebilecek olanlar "yakında / yol haritasında" diye işaretlenir. Tarih vermeyin.

| # | Vaat / beklenti | Kodda gerçek durum | Vitrin dili önerisi | Ön koşul |
|---|---|---|---|---|
| 1 | Depozito / kapora ile no-show koruması, online ödeme | Yok. `Service.requiresDeposit` yalnız şemada, hiçbir yerde okunmuyor; ödeme sağlayıcısı yok | "Yol haritasında" | Ödeme sağlayıcı seçimi, kurucu kararı |
| 2 | iyzico / PCI-DSS ifadeleri | Yok | Kaldır | — |
| 3 | e-Fatura / e-Arşiv entegrasyonu | Yok (alış faturası kaydı var, resmi e-fatura yok) | Kaldır ya da "yol haritasında" | Entegratör seçimi |
| 4 | Otomatik hatırlatma (24 saat / 2 saat) | Kod var, **SMS kapalı olduğu için fiilen çalışmıyor** | "Yakında" (kanal açılınca) | NetGSM + İYS/ticari ileti izni |
| 5 | WhatsApp / Telegram AI randevu asistanı | Kod var; WhatsApp Meta onayı bekliyor, Telegram yalnız test | "Yakında", **ana vaat yapılmaz** | Meta onayı, kurucu kararı (ana değer önerisi) |
| 6 | Müşterinin kendi iptal/değiştirmesi | Yok | "Yakında" | Hatırlatma kanalı |
| 7 | Müşteri sadakat, kampanya, doğum günü mesajı, segmentasyon | Yok; `Customer.segment` hiç hesaplanmıyor (hep "Düzenli") | "Yakında" | Ticari ileti onayı kaydı (hukuk-uyum) |
| 8 | Excel/CSV dışa aktarma, "verilerinizi indirin" | Yok | Kaldır ya da "yakında" | KVKK m.11, sözleşme sonu dışa aktarma |
| 9 | Aylık P&L, doluluk, hizmet/uzman bazlı performans karnesi | Yok; yalnız günlük gelir-gider ve günlük prim raporu | "Yakında" (mevcut: günlük kasa, prim) | — |
| 10 | Koltuk / oda / cihaz takibi | `Resource` modeli var, ekranı/çakışma kontrolü yok | Kaldır ya da "yakında" | — |
| 11 | Çalışırken internetsiz kullanım (offline) | Yok (PWA yok) | Kaldır | — |
| 12 | Stok uyarısı için "anında bildirim", push | Yok; stok uyarısı yalnız sayfada liste | Kaldır ya da "yakında" | — |
| 13 | "AI çakışma riskini tespit eder", "100% kişiselleştirilebilir" | Yok | Kaldır | — |
| 14 | Çoklu şube | Yok (tek salon/kiracı) | "İletişime geçin" (teklif), yakında değil | Mimari karar |
| 15 | Google Takvim / harici takvim | Yok | "Yakında" | — |
| 16 | Fotoğraf yükleme (önce/sonra arşivi) | Yalnız dış URL | Doğru anlat: "bağlantı ile" | Depolama + açık rıza |
| 17 | Abonelik, plan değiştirme, fatura geçmişi, "tek tıkla iptal" | Yok; tahsilat elle | Kaldır "tek tıkla iptal" | Tahsilat modeli, kurucu kararı |
| 18 | Davet bağlantısıyla personel ekleme, müdür/resepsiyon rolleri | Yok (bu belgenin ana konusu) | Yeni özellik olarak "yakında" ya da tasarım bitince "var" | Backend rol işi |
| 19 | Uzman için kendi prim/bahşiş ekranı | API var, ekran yok | Tasarımla birlikte gelir | Yeni ekran |
| 20 | Durum sayfası, destek bileti, kurulum kontrol listesi | Yok (kontrol listesi bu tasarımda geliyor) | Sadece yapılanı yaz | — |
| 21 | Ürün satış primi, hedef primi, tekrar eden gider, belge fotoğrafı | Yok / alan var işleyen kod yok | Anılmaz | — |

Mevcut ve dürüstçe övülebilenler: randevu takvimi, müşteri kartı + anamnez (11 sektör şablonu), paket/seans, prim ve personel ödemesi, bahşiş havuzu, stok + reçete otomatik düşüm, cari hesap, alış faturası, banka-kasa hesapları, bekleme listesi, online randevu sayfası (SMS doğrulamalı), gece no-show işaretleme, süper yönetici paneli. Altyapı beyanı: "Avrupa'da (Frankfurt) kendi sunucumuzda" şeklinde, "AWS", "uçtan uca şifreli", "KVKK uyumlu", "#1", "500+ salon" ifadeleri kalkar (kod: `landing-*.tsx`).

---

## 5. Yasal adımlar (hukuk-uyum ile netleşecek)

Önceki incelemede hukuk-uyum'un bildirdiği 7 gereksinimin **tasarıma düşen yüzü**. Metin ve kapsam hukuk-uyum'un; burada yalnız ekran yeri:

| Gereksinim | Ekran yeri | Durum |
|---|---|---|
| Kayıtta hizmet şartı + DPA kabulü ve kaydı | Kayıt adım 2 (zorunlu kutu) | Tasarıma girecek |
| Salona özel aydınlatma metni | Ayarlar → Salon (metin alanı) + rezervasyon sayfasında bağlantı | Tasarıma girecek |
| Anamnez öncesi açık rıza, geri alınca silme | Müşteri kartı → Anamnez ilk açılış: rıza kutusu, rıza geçmişi, "Rızayı geri al" | Tasarıma girecek |
| Fotoğraf için ayrı rıza | Fotoğraf ekleme modalı | Tasarıma girecek |
| Müşteri silme/anonimleştirme, m.11 dışa aktarma | Müşteri kartı → "Verileri indir" / "Müşteriyi sil/anonimleştir" (Sahip, Müdür) | Backend yok; tasarım çizer, "yakında" etiketi |
| Sözleşme sonu dışa aktarma ve silme | Ayarlar → Hesap → "Verilerimi indir / hesabı kapat" (Sahip) | Backend yok; aynı |
| Ticari ileti onayı kaydı + İYS | Müşteri formu "Kampanya mesajı alabilir" kutusu (varsayılan boş), rezervasyon formu | Kampanya açılmadan zorunlu değil, ama alan şimdiden çizilecek |
| Rol bazlı erişim (ihtiyaç ilkesi) | Bu belgedeki matris (özellikle 13, 17, 19) | `hukuk-uyum` teyidi bekleniyor |

---

### 5.2 Hukuk-uyum görüşü işlendi (düzeltmeler §5 ve §5.1'in yerine geçer)

- **Resepsiyon:** anamnez (17) ve fotoğraf (19) = "—"; randevu kartında içeriksiz "Sağlık notu var" işareti de yok.
- **Uzman, "kendi müşterisi":** süreyle sınırlı (ileri tarihli randevu ya da son ~12 ay içinde tamamlanmış randevu; süreyi mimar+kurucu netleştirir). Uzman müşteri listesini toplu görüntüleyemez ve dışa aktaramaz. Telefon tam görünür. Anamnezde D, ama **rıza kapısı açılmadan form açılmaz**. Salon, Ayarlar → Gizlilik ve KVKK'dan uzman yetkisini G'ye veya "—"ye indirebilir. Anamnez görme/değiştirme her rol için erişim kaydına yazılır (değer yazılmaz). Bekleme listesi uzmana kapalı (satır 11 ile uyumlu).
- **Anamnez rızası:** "rıza kutusu" değil **rıza kapısı**: kanal seçilir (tablette müşterinin kendi onayı / ıslak imza / SMS bağlantısı) → müşteri modu → "Onaylıyorum" ve "Onaylamıyorum" eşit ağırlıkta. Durum satırı: sürüm, tarih, kaydeden, kanal. Kapı alerji notunu (`allergyNotes`, sağlık bölümüne taşınır) da kapsar.
- **Fotoğraf:** rıza modalda değil, **fotoğraf sekmesinin girişinde**, iki ayrı rıza (F1 saklama, F2 tanıtımda kullanım). "URL yapıştır" alanı kalkar (dosya yükleme yolu mimara bağlı).
- **Ticari ileti:** tek kutu yetmez; **kanal başına ayrı satır (SMS / e-posta)**, kaynak seçimi zorunlu ("sözlü" yok), tarih ve metin sürümü kaydı. İYS kaydı "yakında".
- **Aydınlatma metni yeri:** tek yer, **Ayarlar → Gizlilik ve KVKK** (aydınlatma metni, sürümlü rıza metinleri, sağlık erişim rolleri, kabul edilen sözleşmeler). §5 tablosundaki "Ayarlar → Salon" bu yönde okunur.
- **Silme / dışa aktarma:** prototipte "yeni (yasal)" etiketi; ürün içinde "yakında" görünebilir ama ilk gerçek salondan önce zorunlu iş (isteğe bağlı değil).
- **Rezervasyon sayfası:** (a) aydınlatma: kutu yok, metin + alt sayfada (bottom sheet) salonun aydınlatması; işlem SMS'lerini kapsar. (b) İşlem SMS'leri (doğrulama kodu, onay, hatırlatma) bilgilendirme iletisidir, izin istemez, tanıtım içeremez. (c) Ticari ileti kutusu ayrı, isteğe bağlı, işaretsiz; yalnız salon kampanyayı açmışsa görünür; kaynak "Online randevu formu".
- **Eklenen satırlar:** sözleşme güncellenince yeniden kabul ekranı (yalnız Sahip); abonelik sonu veri bilgisi; takvim/bildirim/kasada sağlık verisi gizleme; süper yönetici müşteri içeriğini görmez, destek erişimi nedenle açılır ve kaydedilir; botun karşılama mesajında bilgilendirme satırı; SMS şablonu düzenlerken "tanıtım içeriği eklemeyin" uyarısı.
- **Resepsiyon rıza akışını başlatabilir (karar):** Resepsiyon sağlık içeriğini görmeden "Rıza al" akışını başlatır (kanal seçimi: tablette müşteri modu / SMS bağlantısı / ıslak imza kaydı). Müşteri modunda cihaz müşteriye verilir; gönderimden sonra ekran müşteri formundan çıkar ve içerik Resepsiyon'a gösterilmez. Resepsiyon yalnız içeriksiz durumu görür ("Rıza alındı / Bekliyor / Reddetti / Geri alındı"), form cevaplarını, "Sağlık notu var" işaretini ve klinik notunu görmez. Matris satır 17'ye ek: Resepsiyon "—" kalır, yalnız "Rıza al" eylemi D.
- **Klinikte Müdür (T1):** Müdür klinik notunu, onamı ve erişim geçmişini görmez. Sahip görmesi "Sahip klinik notlarını görür" anahtarına bağlı (varsayılan kapalı). Erişim geçmişini yalnız sahip (anahtar açıksa) ve sorumlu hekim görür.
- **Süper yönetici ciro göstergesi (E4):** "son 30 gün ciro" tek rakam, salon düzeyinde kalır. Kırılım yok (müşteri/personel/işlem satırı gösterilmez), dışa aktarılmaz, yalnız süper yönetici görür. Kullanım Şartları'na toplu kullanım/ciro göstergesi maddesini hukuk-uyum ekliyor.
- Rıza metinleri `yasal-ekran-gereksinimleri.md` §7'de (S1–S5, F1/F2, T1/T2, R1–R5, D1/D2, E1).

### 5.1 Hukuk-uyum girdisi işlendi (`yasal-ekran-gereksinimleri.md` §1–3)

Etiket: **yeni (yasal)** = işlev kaybı değil, yeni yasal işlev; bugün kodda yok. Matrisimle çelişki yok, aşağıdakiler eklenir:

| Yeni (yasal) işlev | Yer | Roller |
|---|---|---|
| Kayıtta her belge için ayrı kabul kaydı (sürüm, zaman, IP, kullanıcı); sürüm değişince yeniden kabul | Kayıt adım 2; giriş sonrası kabul ekranı | Yalnız Sahip kabul eder |
| Sağlık bilgisi rıza kapısı: durumlar rıza yok / var / reddetti / geri alındı (geri alınınca sağlık verisi silinir). Kanallar: tablette müşteri onayı, ıslak imza, SMS bağlantısı. `allergyNotes` genel formdan sağlık bölümüne taşınır | Müşteri kartı → Müşteri Hakkında | Sahip, Müdür görür/düzenler; Uzman yalnız kendi müşterisi; **Resepsiyon görmez** (alerji uyarısı dahil). Salon Ayarlar'dan değiştirebilir (yeni ayar) |
| Fotoğraf: F1 saklama, F2 tanıtımda kullanım ayrı rıza; F1 geri alınınca fotoğraflar silinir | Fotoğraf ekleme/lightbox | Matris satır 19 |
| Ticari ileti izni: kanal başına kayıt, kaynak seçimi zorunlu (sözlü seçeneği yok); hatırlatma SMS'i bundan bağımsız | Müşteri formu, rezervasyon formu | Sahip, Müdür, Resepsiyon kaydeder |
| Müşteri silme (neden seçilir; "KVKK başvurusu" ise 30 günlük süre notu) ve müşteri verisini indirme (m.11) | Müşteri kartı | Sahip, Müdür |
| Salon geneli dışa aktarma ve hesabı kapatma | Ayarlar → Hesap | Yalnız Sahip |
| Ayarlar → Gizlilik ve KVKK | Ayarlar | Yalnız Sahip |
| Sağlık verisi görüntüleme/değiştirme erişim kaydı (değer yazılmaz) | Arka plan; sahip için "erişim kaydı" listesi | Sahip |
| Süper yönetici müşteri içeriğini görmez, yalnız sayıları görür; destek erişimi nedenle açılır ve kaydedilir | /admin | Süper yönetici. Not: E4'teki "30 gün ciro" salon toplamıdır, müşteri içeriği sayılmaz; hukuk-uyum onayı beklenir |

Akışlara etkisi: akış 3.1 adım 3 (kabul kaydı), 3.2 (yeni müşteri: ticari ileti kutusu varsayılan boş; sağlık verisi yalnız yetkiliye), 3.3 (uzmana alerji/sağlık uyarı rozeti yalnız kendi müşterisinde), 3.4 adım 5 (aydınlatma bağlantısı, ticari ileti ayrı).

## 6. Açık sorular (müdür aracılığıyla kurucuya)

1. **Muhasebe rolü** ilk sürümde gerekli mi? (Önerim: hayır, "sonra".)
2. **Resepsiyon gün sonu kasayı kapatır mı?** (Önerim: evet. Geçmiş gün raporu, gelir-gider, prim raporu yok.) Tahsilatı kim alırsa kasayı o kapatır mı?
3. **Uzman** (a) kendi randevusunu taşıyabilsin mi, (b) ödeme tutarını/yöntemini kendisi girip randevuyu kapatabilsin mi, (c) tutarı değiştirebilsin mi? (Önerim: a evet, b evet salon ayarıyla kapatılabilir, c hayır.)
4. **Müşteri telefonu** uzmana maskeli mi görünsün? (Önerim: kendi müşterisinde tam, diğerleri görünmez.)
5. **Kapatılan gün / tamamlanan randevu** hatalı girilirse düzeltmeyi kim yapar, nasıl iz kalır? (Bugün hiçbir yolu yok; hata düzeltmek için veritabanına dokunmak gerekir.)
6. **Hatırlatma kanalı** (SMS / WhatsApp / e-posta) kararı: müşteri online randevu akışı ve "bilgilendir" mesajları buna bağlı.
7. **Müşterinin kendi iptal/değiştirmesi** MVP+1'de mi? İptal penceresi salon bazlı mı sabit mi?
8. **Gider ekleme yetkisi:** Müdür ve Resepsiyon ekler (Önerim) mi, yalnız sahip mi (bugün)?
9. **Modül aç/kapat:** yalnız sahip mi (Önerim), müdür de mi?
10. Rol atama ve davet: kullanıcı e-postasıyla davet bağlantısı mı, sahibin şifre belirlemesi mi? (Bugün sahip şifreyi elle veriyor, ilk girişte değiştirme zorunluluğu görülmedi, doğrulanamadı.)

---

## 7. Backend iş listesi (özet, `mimar`/`gelistirici` için)

1. **Öncelik 1 (güvenlik, tasarımdan bağımsız):** `close-day`, `reports/daily`, `reports/staff-commissions`, `revenues` uçlarına rol kontrolü; dashboard ciro alanını rolle gizle; `ALLOWED_ROLES_READ`'den `staff`'ı finans/cari/fatura uçlarından çıkar; `GET /suppliers`.
2. Müşteri/anamnez/fotoğraf erişimini uzman için "kendi randevusu olan müşteri"yle sınırla; `PATCH /customers`, `POST /customer-packages`, `POST /appointments` için rol/personel kısıtı.
3. Rol modeli: Resepsiyon (ve opsiyonel Muhasebe) rolü, `POST /staff` role parametresi, davet akışı, tek izin tablosu + `requirePermission`; menü aynı tablodan.
4. Eksik yetkiler: Resepsiyon için reschedule, bekleme listesi sil/bitir, bahşiş kaydı, gider ekleme; Müdür için hizmet atama, izin, gider.
5. Uzman için "benim primim/bahşişim" ekranının API'si büyük ölçüde var (`staff-payouts`, `tips`); `reports/staff-commissions` uzman kendi satırını dönecek şekilde daraltılacak.
6. Yeni özellikler (MVP+1, ayrı gereksinim): müşteri iptal/değiştirme bağlantısı, dışa aktarma, rıza kayıtları, aylık raporlar.

---

## 8. Kurucu 2. tur kararları ve klinik kapsamı (S1)

### 8.1 Bölüm 6 kararlarının matrise işlenişi (R1–R9, M1–M2: önerdiğim gibi onaylandı)

Açık sorular kapandı; matris ve akışlar önerimle aynı kaldı, **şu satırlar değişti/netleşti**:

| Karar | Etki |
|---|---|
| R2 Resepsiyon kasayı kapatır | Satır 36–38 olduğu gibi |
| R3 Uzman kendi randevusunu taşır, ödeme alır, **fiyatı değiştiremez** | Satır 6, 8: uzman için tutar alanı kilitli (hizmet fiyatı); DEĞİŞİKLİK: sunucuda uzman için `priceCharged` yok sayılmalı |
| R4 Telefon: uzmana kendi müşterisinde açık, diğerlerinde **maskeli** | Satır 16 güncellendi. **Çelişki:** hukuk-uyum uzmanın müşteri listesini toplu görüntülemesini istemiyor; maskeli de olsa "diğer müşteriler" görünüyorsa toplu görüntüleme olur. Önerim: uzman diğer müşterileri yalnız arama/randevu oluştururken (ad + maskeli numara) görür, liste sayfası yok. hukuk-uyum'a soruldu |
| R5 Düzeltme: tamamlanmış randevu / kapatılmış gün düzeltmesini sahip ve müdür yapar, düzeltme kaydı tutulur | Yeni akış: randevu detayında "Düzeltme" (tutar/yöntem, gerekçe zorunlu) + gün sonunda "Günü yeniden aç"; her ikisi düzeltme kaydına (kim, ne zaman, eski → yeni) yazar. Resepsiyon yapamaz. DEĞİŞİKLİK: bugün hiç yok |
| R6 Gider: müdür ekler, resepsiyon ekleyemez | Satır 39 güncellendi |
| R7 Modüller yalnız sahip | Satır 51 olduğu gibi |
| R8 Davet bağlantısı, personel kendi şifresini belirler | Satır 31 + yeni akış: Sahip "Kişi davet et" (ad, e-posta, unvan/rol) → e-posta bağlantısı → kişi şifresini belirler. **Not:** e-posta gönderimi bugün çalışmıyor (Resend anahtarı boş); davet bağlantısı kopyalanıp WhatsApp'tan gönderilebilmeli |
| R9 Resepsiyon anamnez ve fotoğraf görmez | Satır 17, 19 olduğu gibi |
| M1 Müşteri iptal/değiştirme **randevudan 2 saat öncesine kadar**; ilk aşamada "salonu arayın" da durur | Akış 3.4: iptal penceresi 2 saat sabit (salon bazlı değil). 2 saatten sonra bağlantı "salonu arayın" gösterir |
| M2 Hatırlatma SMS (NetGSM açılacak), e-posta yedek | Yakında listesi #4: kanal kararı verildi; rezervasyon doğrulama kodu ve işlem SMS'i de bu kanala bağlı. Ticari ileti izni ayrı kalır (hukuk-uyum) |

### 8.2 S1: klinik kapsamı (estetik klinik, diş hekimi, randevuyla çalışan diğer sektörler)

**Kodun bugün desteği (statik inceleme).** Kısmi, yalnız "içerik" düzeyinde; "dil ve yapı" düzeyinde yok.

| Alan | Bugün | Boşluk |
|---|---|---|
| `Tenant.businessType` enum'u | 11 değer: `dentist`, `aesthetic_clinic`, `beauty_center`, `hair_salon`, `barbershop`, `spa`, `nail_studio`, `massage`, `tattoo_piercing`, `hair_transplant`, `other`. Kayıtta isteğe bağlı (varsayılan `beauty_center`), Ayarlar'dan değişir | Klinik türleri sınırlı: **dahiliye/fizyoterapi/psikolog/veteriner/diyetisyen/optik vb. yok** (`other` düşer) |
| Etkisi | Yalnız iki şey: (1) hizmet **kategorisi ve öneri listesi** (`sector-data.ts`; diş: Muayene, Dolgu/Kanal, Ortodonti, Estetik Diş, İmplant; estetik klinik: Yüz/Vücut Estetiği, Lazer, Medikal Cilt, Saç Tedavileri; saç ekimi: Konsültasyon, Ekim, Kontrol, PRP); (2) **anamnez varsayılan soru bankası** (`anamnesis-defaults.ts`: diş hekimine özel 13 soru, estetik klinik 12 soru, vb.) | Terim, menü, ekran, alan hiç değişmiyor |
| Terimler | Arayüz sabit: "Salon", "Müşteri", "Personel", "Hizmet", "Randevu". Kodda hasta/danışan/hekim/tedavi kelimeleri yalnız sektör verisinde ve tanıtım sayfasında | Terim sözlüğü yok |
| Kayıtta sektör seçimi | Kurulum adımı yalnız 5 seçenek sunuyor (berber, güzellik merkezi, tırnak stüdyosu, "aesthetic", diğer); **diş hekimi / estetik klinik / saç ekimi seçenekleri kayıtta yok**, ayrıca arayüzdeki `aesthetic` değeri veritabanı enum'undaki `aesthetic_clinic` ile uyuşmuyor (uyuşmazlık doğrulanmalı; mimar/frontend bakacak) | Klinik, kayıtta seçilemiyor |
| Müşteri kaydı | Ad, telefon, e-posta, doğum tarihi, `allergyNotes`, notlar, segment, fotoğraf URL'leri, anamnez | **Yok:** TC kimlik/protokol no, kan grubu, kronik hastalık alanı, kimlik/sigorta, veli/vasi (çocuk hasta), geçmiş tedavi listesi |
| Hizmet/randevu | Hizmet adı, süre, fiyat, kategori, prim oranı, `followUpSchedule` (kontrol takibi şemada var; arayüzde ayar bayrağı `followUpEnabled`) | **Yok:** muayene/tedavi notu (yalnız tek serbest "randevu notu"), tedavi planı ve seans takibi (paket/seans var, ama plan değil), diş şeması, vücut/yüz şeması, reçete, rapor/PDF/röntgen ekleme, onam formu, kontrol hatırlatması (şemada var, çalışmıyor) |
| Personel | `StaffProfile.title` (serbest metin), renk, hizmet atama, çalışma saati, izin | **Yok:** hekim/uzman ayrımı (yardımcı personel, asistan, hemşire), uzmanlık alanı, sicil/diploma no, oda/koltuk ataması (`Resource` modeli var, kullanılmıyor), hekim bazlı farklı süre |
| Fotoğraf | Yalnız dış URL, kategoriler saç/tırnak/cilt/diğer | Klinik görüntü kategorileri (öncesi/sonrası yüz-vücut, röntgen) yok |
| Sağlık verisi koruması | Anamnez tüm rollere açık, rıza yok, erişim kaydı yok (bkz. 1.5) | Klinikte **ilk gerçek müşteriden önce zorunlu** (hukuk-uyum) |

**Klinikte terim/alan ihtiyacı (tasarıma girdi).**

| Genel | Salon | Klinik (diş / estetik / diğer) |
|---|---|---|
| Kurum | Salon | Klinik / Muayenehane |
| Müşteri | Müşteri | **Hasta** (diş, tıbbi) / **Danışan** (estetik, diyetisyen, psikolog) |
| Personel (hizmet veren) | Uzman / personel | **Hekim** (diş, estetik) / Uzman / Terapist |
| Hizmet | Hizmet | **Tedavi / İşlem / Muayene** |
| Paket | Paket / seans | **Tedavi paketi / seans** |
| Randevu | Randevu | Randevu / Muayene |
| Anamnez | Müşteri hakkında | **Tıbbi öykü (anamnez)** |
| Kasa | Günlük kasa | Günlük kasa |

Öneri: ürün tek (ayrı sürüm yok); `businessType` bir **terim sözlüğü seçer** (kurum, müşteri, hizmet veren, hizmet adı için 3–4 ön ayar: *Salon*, *Klinik-hasta*, *Klinik-danışan*, *Genel*). Menü adları, başlıklar, boş durumlar, bildirim şablonları sözlükten gelir. Sahip, Ayarlar'dan tek tek değiştirebilir. Kod anahtarları (rota adları) değişmez. `teknik-yazar` ile sözlük yazılır; `ui-ux-tasarimci` ekranlarda sabit metin yerine sözlük kullanımı çizer.

**Klinik için alan ve ekran ihtiyacı (MVP / sonra).**

| İhtiyaç | Öncelik | Not |
|---|---|---|
| Sağlık verisi rıza kapısı, rol bazlı erişim, erişim kaydı | **MVP (zorunlu)** | Hukuk-uyum girdisi; klinikte en sıkı hâl |
| Kayıtta klinik türleri (diş, estetik, saç ekimi, diğer klinik) ve terim ön ayarı | **MVP** | Enum var, kayıt arayüzü ve sözlük yok |
| Hasta kartında tıbbi öykü (mevcut anamnez) + kronik hastalık/ilaç/alerji özeti üstte | **MVP** | Uyarı rozeti yalnız yetkili rollerde |
| Muayene/tedavi notu (randevu başına, tarih damgalı, kimin yazdığı) | MVP+1 | Bugün tek serbest not |
| Kontrol hatırlatması (ör. tedaviden N gün sonra) | MVP+1 | `followUpSchedule` şemada, işleyen kod yok |
| Hekim bazlı kaynak (muayene odası/koltuk) | MVP+1 | `Resource` yok kullanımda; çakışma kontrolü |
| Dosya/rapor/röntgen ekleme | Sonra | Depolama + rıza, hukuk-uyum |
| Diş şeması, yüz-vücut şeması | Sonra | Ürün farklılaştırıcısı olabilir; ayrı gereksinim |
| Reçete, e-Nabız/MEDULA/sigorta | Sonra / kapsam dışı | Resmî sağlık sistemleri entegrasyonu ayrı büyük iş; ürün "hasta takip yazılımı" değil "randevu ve işletme yönetimi". Vitrin bunu vaat etmez |
| Çocuk hasta/veli bilgisi | MVP+1 | 18 yaş altı rıza, veli onayı (hukuk-uyum) |

**Kliniklerde rol ve sağlık verisi erişimi (en sıkı hâl, hukuk-uyum teyidi bekliyor).**

| Rol (klinik adı) | Sağlık verisi (tıbbi öykü, notlar, görüntü) | Not |
|---|---|---|
| Klinik sahibi (Sahip) | Görür/düzenler, erişim kaydını görür | Gizlilik ve KVKK ayarlarının sahibi |
| Yönetici (Müdür) | Görür/düzenler | Salon bunu daraltabilir (G veya "—") |
| Sekreter / Resepsiyon | **Görmez**, içeriksiz "sağlık notu var" işareti de görmez | Randevu, tahsilat, iletişim (ad, telefon) |
| Hekim / Uzman | Yalnız **kendi hastası** (ileri tarihli veya son ~12 ay içinde tamamlanmış randevu): görür/doldurur; rıza kapısı açılmadan form açılmaz | Kliniklerde **hekim ve yardımcı personel ayrımı** gerekecek: yardımcı (asistan/hemşire) varsayılan olarak "—" veya G; ayrı rol mü, ayarla mı, açık soru |
| Süper yönetici | İçeriği görmez, sayılar | Destek erişimi nedenle açılır, kaydedilir |

Klinikte ek farklar: (1) sağlık verisi **ek koruma** istiyor: yetkisiz çıktı/ekran görüntüsü uyarısı, oturum süresi kısa; (2) tedavi notu değiştirilemez kayıt (düzeltme eski değeri korur); (3) muayene ücreti ve sigorta ayrımı (özel/SGK anlaşmalı) salonda yok; ürün bunu desteklemez, kapsam dışı olarak belirtilir; (4) hekimin kendi cirosu ve primi klinikte daha önemli (hekim payı); mevcut prim hesabı (hizmet bazlı yüzde/sabit) yeterli, "hekim payı" etiketiyle gösterilir.

### 8.3 Pazarlamaya ve tasarıma etkisi

- **Kapsam dürüstlüğü:** vitrin "klinikler için de randevu ve işletme yönetimi" der; tıbbi kayıt, reçete, sigorta/MEDULA, diş şeması **yok / yakında**. "Hasta takip yazılımı", "KVKK uyumlu" gibi iddia yok.
- **Berber ayrı sayfa:** kararı bana bırakıldı (brif S1). Önerim **ayrı berber sayfası evet**: ihtiyaç farkı büyük (anamnez, paket, stok neredeyse yok; hız, sıra, tek kişi). Sayfa dili "kuaför/berber randevu defteri" olur. Pazarlama ile konuşulacak.
- **Klinik sayfası:** diş hekimi ve estetik klinik için tek "Klinikler" sayfası; sektör örnekleri (hizmet adları `sector-data.ts`'ten), güven maddeleri (rol bazlı sağlık verisi erişimi, rıza kapısı) **yalnız yapıldıktan sonra** "var" denir.
- **Prototip:** `ui-ux-tasarimci` örnek veriyi iki sektörle çizer: güzellik salonu ve klinik (terim sözlüğü farkını göstermek için bir ekran çifti: "Müşteriler/Randevu/Hizmet" ↔ "Hastalar/Muayene/Tedavi").

### 8.3b Hukuk-uyum klinik görüşü işlendi (`yasal-ekran-gereksinimleri.md` §9–10; taslak, avukat görüşü değil)

- **R4 çelişkisi çözüldü:** uzman diğer müşterileri yalnız arama ve randevu oluştururken görür (ad + maskeli numara), liste sayfası yok. Şartlar: arama en az 3 karakter, en çok 10 sonuç, dışa aktarma ve kopyalama yok. Klinikte ek: hekim klinik notunu yalnız kendi hastasında görür.
- **Klinik roller (8.2 tablosunu değiştirir):** Hekim ile sağlık personeli (hemşire, asistan) ayrı rol. Klinik notunu yalnız hekim yazar; sağlık personeli sahibin verdiği yetkiyle görür/yazar. **Müdür sağlık meslek mensubu değilse klinik notunu görmez.** Hekim olmayan sahip için "Sahip klinik notlarını görür" anahtarı (varsayılan kapalı). Sağlık verisine erişen her rol için **iki adımlı doğrulama** zorunlu, hareketsizlikte oturum kilidi. **Erişim geçmişi ekranı** (sahip ve sorumlu hekim görür). Bu, 8.4'teki 2. sorunun (hekim/yardımcı ayrımı) cevabıdır: ayrım klinik modunda gerekli.
- **Tedavi notu değiştirilemez:** düzenleme yok; tarihli "Düzeltme ekle" + düzeltme geçmişi. **Hasta silinmez, kaydı kapatılır:** iletişim ve tedavi dışı veri silinir, tıbbi kayıt saklama süresi boyunca kilitli (süre avukattan). Salon modundaki "müşteriyi sil" klinikte "Kaydı kapat" olur.
- **18 yaş altı:** onam/rıza ekranında "Onayı veren: Hasta / Yasal temsilci (ad, yakınlık)"; klinikte doğum tarihi zorunlu ya da en az "18 yaş altı" işareti (biçim avukatla).
- **Alan çizgisi:** MEDULA, provizyon, sigorta no ve **TC kimlik no toplanmaz** (e-Nabız/HBYS değiliz). Kasada yalnız "Ödeme türü: Özel / Kurum anlaşmalı" etiketi (sağlık bilgisi içermez). Çizgi değişirse kurucu kararı + avukat.
- **Klinik metinleri:** hasta aydınlatma şablonu ayrı. Tedavi için KVKK açık rıza kapısı **yok** (dayanak m.6/3, doğrulanacak); yerine "aydınlatma yapıldı" kaydı. Bilgilendirilmiş onam ayrı "Onamlar" bölümünde; formu klinik yükler, BeautyOS yalnız kayıt + imza altyapısı sunar, KVKK rızasıyla aynı ekranda değil. Açık rıza yalnız tedavi dışı amaçlar için (bilgilendirme dışı mesajlar, yurt dışına aktaran mesaj asistanı). Bu, 5.2'deki "anamnez rıza kapısı"nı klinik modunda **"aydınlatma yapıldı + onam"** akışıyla değiştirir; salon modunda 5.2 geçerli.
- **Klinik modunda varsayılan kapalı/gizli:** kampanya (ticari ileti), tanıtımda fotoğraf kullanımı (F2), mesaj asistanı, online randevu sayfasında fiyat gösterimi. **Hatırlatma SMS'lerinde hizmet adı yer almaz.** Muayenehane için aynı kurallar. Kurulumda "İşletme türü" adımı; klinik seçilince kurallar devreye girer (bu, 3.1 adım 5'e eklenir).
- **Tasarım sonucu:** iki mod (Salon / Klinik) gerekir: terim sözlüğü + varsayılanlar + rıza/onam akışı + rol seti farklıdır. Ekran envanterine "Onamlar", "Erişim geçmişi", "Düzeltme ekle", "Kaydı kapat", 2 adımlı doğrulama, oturum kilidi eklenir.

### 8.4 Yeni açık sorular (kurucuya, müdür aracılığıyla)

1. Klinik tarafında **ilk hedef** hangisi: diş hekimi mi, estetik klinik mi? (Anamnez ve terim önceliği buna göre.)
2. Hekim ve yardımcı personel (asistan/hemşire) ayrımı ilk sürümde gerekli mi, yoksa tüm hizmet verenler "Uzman" mı?
3. Kayıtta klinik türleri hangileri: diş, estetik, saç ekimi dışında (diyetisyen, psikolog, fizyoterapi, veteriner, optik) ilk listeye girsin mi, yoksa "Diğer klinik" mi?
4. Terim sözlüğü ön ayarları (Klinik-hasta, Klinik-danışan) kurucunun istediği gibi mi, ve sahip özelleştirebilsin mi?
5. SGK/özel sigorta, reçete, e-Nabız gibi entegrasyonlar kapsam dışı olarak vitrinde açıkça yazılsın mı?
6. Berber için ayrı tanıtım sayfası (önerim: evet).
