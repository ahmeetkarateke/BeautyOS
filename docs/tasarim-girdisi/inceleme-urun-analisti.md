# İnceleme: ürün analisti — tasarım turu 1 (salon paneli)

- **Tarih:** 2026-10-28 · **İncelenen:** `docs/tasarim.md` sürüm 0.9 + `docs/tasarim/prototip/` (`prototip.js` yetki tablosu `Y`, `panel.js`, `panel-ek.js`, `veri.js`, `DURUM.md`)
- **Karşı tutulan:** `roller-ve-akislar.md` §1.4 (matris), §5.2 (hukuk), §8 (R1–R9, M1–M2, klinik, §8.3b), işlev kontrol listesi A1–A13/B/C/E
- **Kapsam:** salon paneli ve tasarım dili. Online randevu, giriş/kayıt/kurulum, tanıtım, süper yönetici sayfaları "planlandı" olduğundan yalnız belgedeki tanımları okundu (bkz. 4).
- **Yöntem:** prototipin tarayıcıda çalıştırılması yerine kaynak koddan okundu (yetki tablosu, menü, ekran üreticileri). Görsel bakış bu incelemede yok.

## 1. Genel sonuç

Rol/yetki uygulaması büyük ölçüde matrise uyuyor: R1–R9'un çoğu birebir yansımış (Resepsiyon gider eklemez, kasayı kapatır, sağlık ve fotoğraf görmez, uzman tutarı değiştiremez, uzman yalnız kendi müşterisini tam görür, Müdür modül/yetki/davet yapamaz, düzeltme ve günü yeniden açma yalnız sahip/müdür, uzman "Günüm", "Benim primim", "Hesabım"). Kalan sorunlar iki grupta: (a) **klinik modunda sağlık verisi rolleri hukuk-uyum görüşüyle çelişiyor** (yüksek), (b) birkaç işlev kontrol listesinde çizilmemiş ya da gerekçesi yazılmamış.

| Önem | Adet |
|---|---|
| Yüksek | 4 (B1, B2, B3, B4) |
| Orta | 6 (F1, F2, F3, F4, B5, F8) |
| Düşük / bilgi | 6 |

## 2. Bulgular: rol ve görünürlük

| # | Önem | Bulgu | Kanıt | Öneri |
|---|---|---|---|---|
| B1 | Yüksek | **Klinikte Müdür sağlık verisini ve klinik notunu görüyor.** Hukuk-uyum: Müdür sağlık meslek mensubu değilse klinik notunu görmez; hekim olmayan sahip için "Sahip klinik notlarını görür" anahtarı vardır, varsayılan **kapalı**. | `tasarim.md` §6 "Sağlık bilgileri, fotoğraf: Sahip Var, Müdür Var"; `prototip.js` `'saglik': 'SYP'`; `panel-ek.js:73–75` klinikte Onamlar, Klinik notu, Erişim geçmişi sekmeleri `P.yetki('saglik')` ile Sahip ve Müdür'e açık | Klinik modunda notu yazan/okuyan yalnız Hekim (kendi hastasında). Ayarlar → Gizlilik ve KVKK'ya "Klinik notunu kimler görür" anahtarları (Sahip, Müdür, Sağlık personeli; varsayılan kapalı). Salon modunda anamnez S/M/U olarak kalır. §6 tablosuna klinik sütunları ekle. Prototipte `tur=estetik` ile Sahip/Müdür görünümünde klinik notu sekmesi kilitli ya da "Yetkiniz yok" göstermeli. |
| B2 | Yüksek | **Sağlık personeli (hemşire, asistan) görünümü yok ve tanım hukuk görüşüyle çelişiyor.** Tasarım "atandığı randevular, klinik notunu okur" diyor; hukuk-uyum: sahibin açıkça verdiği yetki olmadan görmez/yazmaz. | `tasarim.md` §7.2 son madde; `prototip.js:23` `ROLLER` yalnız 4 rol (klinikte "personel" = "Hekim"); beşinci görünüm yok | Rol değiştiricide klinik türlerinde 5. görünüm "Sağlık personeli" (varsayılan: takvim + kendi atandığı randevular, klinik notu "—"). Sahibin yetki verdiği hâl ikinci örnek. |
| B3 | Yüksek | **Resepsiyon izin ekleyip silebiliyor.** Matris satır 30: izin yazma yalnız Sahip/Müdür; Resepsiyon yok. | `prototip.js:37` `'izin-kaydet': 'SYR'` | `'SY'` yap; Resepsiyon izinleri salt okunur görür. (Backend: bugün yalnız owner, Müdür'e açılacak; Resepsiyon eklenmeyecek.) |
| B4 | Yüksek | **Uzman müşteri araması hukuk şartlarını karşılamıyor.** Şart: en az 3 karakter, en çok 10 sonuç, uzmanda dışa aktarma/kopyalama yok, diğer müşterilerde ad + maskeli numara, liste sayfası yok. Tasarım: "müşteri ara (ad/telefon, ≥2 karakter)". | `tasarim.md` §8.1 "Akış: resepsiyon" ve `panel.js:313+`; `panel-ek.js:18` açıklama doğru ("yalnız aramayla … maskeli") | Uzman için arama alanı 3 karakter + "En çok 10 sonuç" bilgi satırı; sonuçta telefon maskeli ve seçilemez (kopyalanamaz: `user-select: none`); "Kendi müşterilerim" listesi dışında genel liste yok (prototip bunu yapıyor, doğru). Resepsiyon/Müdür/Sahip için 2 karakter kalabilir. |
| B5 | Orta | **Klinikte "Fotoğraflar" sekmesi tamamen gizli: işlev kaybı riski.** Brif kararı 3 "hiçbir işlev kaybolmaz"; estetik klinikte işlem öncesi/sonrası görüntü saklama gündelik iştir. Hukuk-uyum klinikte yalnız **tanıtımda kullanım (F2)** ve fotoğraf kampanyasını kapalı tutuyor, F1 (saklama) rızası için sekme yasak değil. | `tasarim.md` §7.2 "Fotoğraflar sekmesi gösterilmez"; `panel-ek.js:75` `P.yetki('foto') && !P.klinik` | Müdür üzerinden kurucuya karar: (a) klinikte "Klinik görüntüleri" olarak kalsın (F1 rızası, F2 kapalı, hekim/yetkili) ya da (b) bilinçli olarak ilk sürümde kaldırılsın ve vitrinde söylensin. Önerim (a). Kararı bekleyene kadar tasarımda "yakında/yetki kapalı" değil, kararın kendisi yazılsın. |
| B6 | Düşük | Resepsiyonun bahşiş girişi nerede? Matris satır 33: Resepsiyon bahşiş kaydı gireyor. Yetki var (`'bahsis-gir': 'SYR'`) ama **Bahşiş ekranı Yönetim grubunda (yalnız S/M)**; erişim yalnız "Tamamla ve ödeme al" içindeki isteğe bağlı bahşişten. | `prototip.js:39,40`, `panel.js` MENU `bahsis: y 'yonetim'` | Yeterli olabilir; `tasarim.md` §8.1'e "Resepsiyon bahşişi ödeme kapanışında girer, listeyi ve dağıtımı görmez" cümlesini ekle. |
| B7 | Düşük | **Uzmanın izin görünümü.** Matris: uzman kendi izinlerini salt okunur görür. Tasarımda "Günüm: izinlerim" yazıyor ama prototipte ayrı satır doğrulanamadı. | `tasarim.md` §8.1 `gunum` | Günüm altına "İzinlerim" bölümü (salt okunur) ekle ya da yaz. |
| B8 | Düşük | "Hekim" terimi yalnız `personel` rolüne bağlı; klinik-danışan setinde (estetik) hizmeti veren "Uzman" kalıyor. Menüde tutarlı mı kontrol edilmeli. | `prototip.js:23` | Terim setine göre; hukuk-uyum klinik rolleri "Hekim ≠ Sağlık personeli" olarak ayrı tuttuğundan klinik-danışan setinde de rol adı ayrımı korunsun. |

Uygun bulunanlar: Müdür yönetim grubunu görür, ayar kısıtları (abonelik, modüller, gizlilik, kullanıcılar, terimler yalnız sahip); `gider-ekle` Müdür var, Resepsiyon yok; `gun-sonu` Resepsiyon var, `kasa-gecmis`/`raporlar`/`yonetim` yok; `tutar-degistir` uzmanda yok; `duzeltme` ve `gun-ac` yalnız S/M; `musteri-sil`/`musteri-indir` yalnız S/M; `bekleme` uzmanda yok; maskeli telefon ve "randevunuz olanlar" açıklaması; yetkisiz ekran suçlamıyor ve çıkış yolu veriyor; rol dışı menü öğeleri gizli; klinikte resepsiyon "Sağlık notu var" işaretini görmüyor; hatırlatma SMS'inde işlem adı yok; kasada TC/sigorta alanı yok.

## 3. Bulgular: işlev eksiksizliği (kontrol listesi A1–A13)

| # | Önem | Kontrol listesi | Eksik / belirsiz | Öneri |
|---|---|---|---|---|
| F1 | Orta | A12.2 | **İşletme türünü değiştirme ve hizmet kategorileri yönetimi** (sektör varsayılanına sıfırla) Ayarlar listesinde yok. | Ayarlar → Salon (Klinik) bilgileri altında "İşletme türü" ve "Hizmet kategorileri" (sıfırla). İşletme türü değişince terim seti ve anamnez varsayılanı uyarısı (zaten hâlihazırda soru yoksa yeniden yüklenir). |
| F2 | Orta | C2 / A12.2 | **Kayıtta 6 tür, veri modelinde 11.** `nail_studio`, `spa`, `massage`, `tattoo_piercing`, `hair_transplant` "Diğer"e düşerse bu sektörlerin hizmet kategorileri/önerileri ve anamnez setleri sessizce kaybolur (mevcut işlev kaybı). "Ayarlarda ayrıntılı alt tür listesi" tek cümlelik söz. | Kayıtta "Diğer randevulu işletme" seçilince 5 alt tür ve "Başka" listelensin ya da kayıtta 11 türün hepsi 6 grup altında seçilebilsin. Eşleme tablosunu belgeye ekle (mimar/teknik-yazar). Ayrıca kodda kurulum sihirbazındaki `aesthetic` ile veritabanı `aesthetic_clinic` uyuşmazlığı mimara iletildi. |
| F3 | Orta | A2.3 | Takvimde **durum süzgeci** yok (yalnız personel çipi); müşteri adı arama üst barda. Mevcut ürün: personel + durum + ad filtresi. | Masaüstünde durum çipleri (Bekleyen, Onaylı, Devam, Tamamlanan, İptal, Gelmedi) ya da "Bekleyenler" kuyruğu bulgu şeridinden açılan liste. |
| F4 | Orta | A2.10 | **Sürükle-bırak ile taşıma** tasarımda ne korunuyor ne reddediliyor. Mevcut: sahip/müdür, yalnız gelecek ve sonlanmamış randevu. Takvimin ilk 10 randevuyu göstermesi mevcut hata. | Masaüstü takvimde sürükle-bırak korunur (sahip/müdür/resepsiyon; Resepsiyon artık saat değiştirebiliyor) ve "Saati değiştir" ikinci yol olarak kalır; ya da gerekçeyle kaldırılır. Gün/hafta aralığı tam yüklenecek not düşülsün. |
| F5 | Düşük | A4.1 | Müşteri **segment rozetleri** (VIP, Düzenli, Pasif, Risk altında) çizilmemiş. Segment bugün hiç hesaplanmıyor, kayıp değil. | "Yakında" olarak bırak; çizme. |
| F6 | Düşük | A11.3 | Alış faturasında **iptal ve sil** eylemleri ayrıntılı tarif edilmemiş (yalnız "Faturayı işle"). | Fatura ayrıntısında İptal et / Sil (onaylı) eylemleri. Prototipte doğrulanamadı. |
| F7 | Düşük | A2.1 | **Ay görünümü** planlı. | Çizilsin; mevcut işlev. |
| F8 | Orta | A3, B8, M1 | Müşteri iptal/değiştirme (M1) **bağlantı sayfası** ve 2 saat sonrası "salonu arayın" durumu `randevu-al.html` kapsamında; hatırlatma SMS'i içindeki bağlantının hedefi ayrı ekran olarak yazılmamış. | `randevu-iptal` ekranı: randevu özeti, İptal et / Saati değiştir, 2 saat kuralı, geçmiş/iptal edilmiş durumu, hız sınırı. SMS kapalıyken bu bağlantının geleceği yer onay ekranıdır, bunu da yaz. |
| F9 | Düşük | R8 | Davet bağlantısı planlı; e-posta gönderimi bugün çalışmıyor (Resend anahtarı boş). | Davet ekranında "Bağlantıyı kopyala" ve paylaşım yolu birincil olsun, e-posta ikincil. |
| F10 | Düşük | A12.7 | WhatsApp "onay bekleniyor" ve Telegram "test kanalı" kartları kaldırılmış; "Mesaj asistanı" kapalı durumda dürüst bilgi veriyor. Uygun. | — |

Çizildiği doğrulanan (kod/belge okumasıyla): Bugün, Günüm, Takvim gün/hafta, Randevu oluştur, ayrıntı, durumlar, saat değiştir, Tamamla ve ödeme al (paketten düş dahil), Randevusuz işlem, Müşteriler (liste, yeni, kart: genel, randevular, sağlık rıza kapısı, fotoğraf F1/F2, paket, cari, sil, indir), Hizmetler, Personel (+ detay), Kasa (gün sonu, sayım, gider/gelir), Raporlar, Bekleme listesi, Yönetim grubu (stok, paketler, hesaplar+virman, cari, faturalar, tedarikçiler, personel ödemeleri, bahşiş), Benim primim, Ayarlar (10 bölüm), Hesabım, Menü, Abonelik bitti, Yeniden kabul. Randevu kaynağı ("Online randevu" / "Salonda oluşturuldu") ayrıntıda var.

## 4. Henüz çizilmediği için bakılamayanlar

- **Online randevu (B), giriş/kayıt/kurulum (C), tanıtım (D), süper yönetici (E):** `tasarim.md` §8.2–8.5 okundu, çelişki bulunmadı. Olumlu: doğrulama son adıma alınmış; fiyat/ticari ileti klinikte kapalı; çalışma saati ve rezervasyon bağlantısı kurulumda; süper yönetici yalnız tek ciro rakamı ve sayı görür. Prototip gelince kontrol listesi A12/B/C/E işaretlenecek.
- **Klinik ekranları** (2FA, oturum kilidi, Hasta kaydını kapat, Düzeltme ekle): planlı; B1/B2 kapanınca yeniden bakılacak.

## 5. Kontrol listesi durumu (tur 1)

| Grup | Durum |
|---|---|
| A1 Ana sayfa | Tam (A1.5 kısayol: Bugün'de "Randevu oluştur" + alt menü +) |
| A2 Randevular | Tam, F3 (durum süzgeci), F4 (sürükle-bırak), F7 (ay) açık |
| A3 Bekleme listesi | Tam |
| A4 Müşteriler | Tam; F5 segment "yakında"; B5 klinikte fotoğraf kararı bekliyor |
| A5 Paketler / A6 Hizmetler | Tam |
| A7 Personel / A8 Ödemeler / A9 Bahşiş | Tam; B3 yetki düzeltmesi, B7 izin görünümü |
| A10 Günlük kasa | Tam (tarih aralığı seçici, yazdır, sayım var) |
| A11 Muhasebe/Yönetim | Tam; F6 fatura iptal/sil doğrulanamadı |
| A12 Ayarlar | F1 (işletme türü + kategoriler) açık; terimler/güvenlik planlı |
| A13 Kabuk | Tam (koyu tema gizli, kurucu kararı) |
| B, C, D, E | Henüz çizilmedi |

## 5b. Vitrin ekranları: "bugün canlıda çalışıyor mu" eşleme listesi (pazarlama P1, P10)

Durum **kodun bugünkü hâli** (`tasima/docker` @ `71ee311`) içindir. Yeni tasarımın kodlanma sırası ve yayın tarihi henüz yok; o yüzden tarih yerine "neye bağlı" yazıyorum. Vitrinde bir ekran gösterilirken yanında olmayan işlevin etiketi ("Yakında" ya da "Tasarım önizlemesi") bulunmalı; ürün resmi canlı sistemmiş gibi sunulmamalı.

| Vitrin ekranı / öğe | Bugün canlıda | Bağlı olduğu iş |
|---|---|---|
| Takvim, randevu oluştur/taşı/durum, müşteri kartı, hizmet, personel | **Var** (arayüz farklı, işlev aynı) | Yeni arayüzün kodlanması |
| "Tamamla ve ödeme al" (nakit/kart), paketten düş | Ödeme var; **paketten düş kapanışta yok** (ayrı bölümden yapılıyor) | Kod değişikliği |
| Günlük kasa, gün sonu "Günü kapat" | Kasa özeti ve kapama **var**; **kasa sayımı (beklenen nakit/fark) yok** | Yeni alan |
| Günü yeniden aç, düzeltme kaydı (R5) | **Yok** | Backend |
| Personelin günü doluluk şeridi, "Şu an boş" cümlesi | **Yok** (veriden türetilebilir, arayüz yeni) | Frontend |
| Ayrı "Günüm", "Benim primim" (uzman) | **Yok** (API var, ekran yok) | Frontend |
| Roller: Müdür, Resepsiyon, rol setleri, davet bağlantısı | **Yok** (yalnız sahip + personel; müdür/resepsiyon oluşturulamıyor) | Backend rol modeli |
| Maskeli telefon, "yalnız kendi müşterilerin" | **Yok** (uzman tüm müşteriyi görüyor) | Backend |
| Online randevu (bulgu şeridi "N online randevu onay bekliyor") | Online randevu sayfası var ama **SMS kapalı, Turnstile yok: fiilen kapalı**; **onay bekleyen durum akışı yok** (randevu bekliyor olarak düşer) | Kanal kararı (NetGSM), onay akışı |
| Online randevuda fiyat, takvime ekle (.ics) | **Yok** (public API fiyat döndürmüyor) | Backend |
| Müşteri iptal/değiştirme bağlantısı, 2 saat kuralı | **Yok** | Backend + SMS |
| Hatırlatma SMS 24s/2s | Kod var, **gönderilmiyor** | NetGSM + İYS |
| Sağlık verisi rıza kapısı, Onamlar, Erişim geçmişi, klinik notu | **Yok** (anamnez formu var, rıza ve erişim kaydı yok) | Hukuk-uyum gereksinimleri, backend |
| Fotoğraf F1/F2 rızaları, dosya yükleme | **Yok** (yalnız dış URL, rıza yok) | Depolama + rıza |
| Müşteri sil / veri talebi / dışa aktarma | **Yok** | Backend |
| Klinik modu (terim seti, 2FA, oturum kilidi, Hasta kaydını kapat) | **Yok** (yalnız sektöre göre hizmet kategorisi ve anamnez seti) | Büyük iş, ayrı gereksinim |
| Ayarlar › Terimler, Güvenlik/2FA, Gizlilik ve KVKK | **Yok** | Backend + frontend |
| Mesaj asistanı | Kod var, **kapalı** (bayrak); Telegram yalnız test | Meta onayı, kurucu kararı |
| Cari, alış faturası, banka-kasa, stok, tedarikçi, paket, bahşiş, prim, personel ödemesi, bekleme listesi | **Var** | Yeni arayüz |
| Raporlar: kasa raporu, prim raporu | **Var**; aylık/hizmet-bazlı/doluluk raporları **yok** ("Yakında" etiketli) | — |
| Süper yönetici paneli | **Var** (plan, aktiflik, deneme uzatma, özet); not alanı, yasal sürüm yayınlama **yok** | Backend |

**Kural önerisi (pazarlama için):** "Yok" satırları vitrin görsellerinde ya hiç gösterilmez ya da görselin yanında "Tasarım önizlemesi, yakında" etiketi taşır; metinde "var" gibi yazılmaz. "Var" satırları, yeni arayüz canlıya alınana kadar eski arayüzde de çalıştığı için işlev olarak doğrudur, ama ekran görüntüsü yeni tasarımdan geliyorsa "yeni arayüz" yayına çıkana kadar yayın tarihi bu listeye bağlanır.

**Kodlama sırası önerisi (kurucu onayı gerekir, müdür kararı):** (1) güvenlik açıkları (kasa/rapor/cari uçlarında rol kontrolü, Açık 1–3); (2) rol modeli + davet + yetki tablosu; (3) yeni arayüz (kabuk, Bugün, Takvim, Randevu, Müşteri, Kasa); (4) hatırlatma kanalı + online randevu onay akışı + müşteri iptali; (5) hukuk gereksinimleri (rıza kapısı, silme, dışa aktarma); (6) klinik modu. Vitrin 3'ten sonra "yeni arayüz", 4'ten sonra "hatırlatma ve online randevu", 6'dan sonra "klinikler için" diyebilir. Tarih vermek için mimar/gelistirici tahmini gerekir.

## 6. Yapılacaklar (sahibi ui-ux-tasarimci)

1. B1, B2, B3, B4 düzelt (rol/yetki; yüksek).
2. B5 için müdürden kurucu kararı iste (klinikte fotoğraf).
3. F1, F2, F3, F4, F8 kapsamı tasarıma al; F5–F10 not düş.
4. Prototip güncellenince yeniden bakacağım; son turda kontrol listesinin tamamını işaretleyeceğim.

---

# Tur 2 (2026-10-28): yanıtların doğrulanması ve yeni yüzeyler

İncelenen: `docs/tasarim/bulgu-yanitlari.md`, `prototip.js` (`Y`, `P.yetki`, `SETLER`), `panel.js`, `panel-ek.js`, `randevu-al.html`, `giris.html`, `yonetici.html`, `sistem.html`. `tanitim.html` bu turda **incelenmedi** (pazarlama/hukuk kapsamında; ürün tarafı yalnız §5b eşlemesi). Yöntem yine kaynak okuma; tarayıcıda çalıştırılmadı.

## 7. Tur 1 yanıtlarının doğrulanması

| # | Yanıt | Doğrulama |
|---|---|---|
| B1 | Uygulandı | **Doğrulandı.** `P.yetki`: klinikte `saglik`/`foto`/`musteri-indir` yalnız Hekim ve `?sahipNot=1` açıkken Sahip; Müdür ve Resepsiyon kapalı. Erişim geçmişi yalnız Sahip ve Hekim, `saglik` yetkisiyle birlikte kontrol ediliyor. |
| B2 | Uygulandı | **Doğrulandı.** Klinikte "Sağlık personeli" rolü (`G_EK`: takvim, günüm, müşteriler, hesabım, hizmetler); sağlık/klinik notu yok. |
| B3 | Uygulandı | **Doğrulandı, küçük kalıntı.** Personel izni `personel-duzenle` (SY) arkasında; `personel-izni` anahtarı tanımlı ama kodda kullanılmıyor (ölü anahtar, temizlenebilir). `izin-kaydet: SYR` müşteri **kampanya izni** için, kasıtlı. |
| B4 | Uygulandı | Belge/prototipte 3 karakter, 10 sonuç, maskeli numara, bilgi satırı. Seçilemez/kopyalanamaz davranış kaynak okumada tam doğrulanamadı; frontend kodlamada `user-select: none` ve dışa aktarma yokluğu kabul kriteri olsun. |
| B5 | Uygulandı (müdür varsayımı) | **Kurucu kararı bekliyor.** Klinikte "Klinik görüntüleri" yalnız Hekim, F2 kapalı. |
| B6–B8 | Uygulandı | Doğrulandı (bahşiş cümlesi §6'da, Günüm'de izinlerim, Hekim/Uzman/Sağlık personeli ayrımı). |
| F1 | Bekliyor | Kapanmadı: tür değişim uyarısı hâlâ yok. İşletme türü seçiminin Ayarlar'daki yeri var (`panel-ek.js:389`); uyarı penceresi (terim seti, kategori ve anamnez varsayılanı değişir; klinik ↔ salon geçişinde yasal varsayılanlar ve 2FA etkisi) çizilsin. |
| F2 | Uygulandı (belge) | **Prototipte yok.** `giris.html` kaydında işletme türü yalnız 6 seçenekli liste (`TURLER`); "Diğer randevulu işletme" seçilince alt tür (tırnak, spa, masaj, dövme, saç ekimi, başka) sorusu gelmiyor. Belge söylüyor, ekran yapmıyor. |
| F3 | Bekliyor | **Aslında yapılmış:** takvim başlığında "Duruma göre süz" seçici var (`panel.js:254`). Yanıt dosyasını güncelle. |
| F4 | Uygulandı (belge) | Uygun. Kodlama kabul kriteri: gelecek ve sonlanmamış randevu, yalnız Sahip/Müdür/Resepsiyon; takvim tam aralık yüklesin. |
| F6 | Bekliyor | Doğrulanamadı (fatura ayrıntısında İptal et/Sil). |
| F7 | Bekliyor | **Aslında yapılmış:** Gün/Hafta/Ay seçici başlıkta (`panel.js:254`). Ay görünümünün içeriği bu turda açılıp bakılmadı. |
| F8 | Uygulandı | **Doğrulandı** (`randevu-al.html#degistir`): özet, saati değiştir, iptal (onaylı), "2 saatten az kaldıysa salonu arayın". Kimlik doğrulama ( imzalı bağlantı) prototipte belirtilmemiş; backend notu olsun. |
| F9 | Uygulandı | **Doğrulandı:** kurulumda davet, `giris.html#davet`; Davet gönder + bağlantı kopyalama. |

## 8. Yeni bulgular (tur 2)

| # | Önem | Bulgu | Kanıt | Öneri |
|---|---|---|---|---|
| N1 | Orta | **Online randevu onay biçimi tutarsız.** Panelde "2 online randevu onay bekliyor" şeridi ve online randevu `bekliyor` durumunda; müşteri tarafında "Randevunuz alındı." Hangisi geçerli: otomatik onay mı, salon onayı mı? Bugünkü ürün bu ayrımı yapmıyor. | `veri.js` online kayıtlar `bekliyor`; `randevu-al.html` `onay()` | Ayarlar › Online randevu'ya "Onay biçimi: otomatik / salon onaylar" ayarı. Salon onaylar seçiliyse müşteri metni "Talebiniz alındı. Salon onayladığında size SMS ile haber vereceğiz." Kurucu kararı (varsayılan: otomatik). |
| N2 | Orta | **Klinikte davet kabulünden sonra 2FA kurulumu yok.** Davetli `panel.html`'e gidiyor; klinik hesabında sağlık verisine erişen her rol için 2FA zorunlu (hukuk-uyum §10.6). | `giris.html` `davet` → `data-git="panel.html…"` | Klinikte davet akışı: şifre → 2FA kurulumu → kurtarma kodları → panel. Resepsiyon (sağlık görmez) için zorunluluk kapsamı hukuk-uyum'a sorulsun. |
| N3 | Orta | **"Hatırlatma mesajını randevudan önce SMS ile alacaksınız."** SMS kanalı bugün kapalı (M2: NetGSM açılacak, tarih yok). Yayında yanlış vaat olur. | `randevu-al.html` `onay()` | Kanal açılana kadar cümle çıkar ("Salon sizinle gerekirse iletişime geçecektir") ya da `kanalAcik` bayrağına bağla; aynı kural Ayarlar › Bildirimler (zaten "gönderilmiyor" uyarısı var, doğru) ve tanıtım için. |
| N4 | Orta | `sistem.html` çevrim dışı sayfası "Bağlantı gelince yeniden denenir." diyor: uygulamada yeniden deneme ya da çevrim dışı kuyruğu yok (offline iddiası, eski bulgu 13). Bakım sayfası "Randevularınız ve kayıtlarınız güvende." doğrulanamaz bir güvence. | `sistem.html` `cevrimdisi`, `bakim` | "İnternet bağlantınızı kontrol edip tekrar deneyin." Güvence cümlesini sil. |
| N5 | Düşük | Online randevu formunda eski **"not" alanı kalkmış** (yalnız ad ve telefon). Sağlık verisi toplamamak için bilinçliyse yeterli; mevcut işlevse kayıp. | `randevu-al.html` `bilgi()` | Gerekçeyi `tasarim.md` §8.2'ye yaz ("salon notu istiyorsa isteğe bağlı kısa not, sağlık bilgisi yazmayın uyarısıyla salon modunda"); klinikte kapalı kalsın. |
| N6 | Düşük | `personel-izni` ölü anahtar; `bulgu-yanitlari.md`'de F3 ve F7 "Bekliyor" ama yapılmış. | bkz. 7 | Temizle/güncelle. |
| N7 | Düşük | Kayıt adım 1: işletme adı alanı "Defne Güzellik Salonu" ile önceden dolu (prototip kolaylığı). Gerçekte boş olmalı. | `giris.html` `kayit` | Frontend kabul kriteri. |
| N8 | Bilgi | Kurtarma kodları ekranı kodları bir kez gösterir ve onay kutusu zorunlu; iyi. Kodların sunucuda saklanma biçimi (özetli) mimar işi. | `giris.html` `kurtarma` | — |

## 9. Yeni yüzeyler: kontrol listesi durumu

| Kalem | Durum |
|---|---|
| **B1** salon tanıtımı (ad, logo, telefon, WhatsApp, harita) | Var. Logo yer tutucu (baş harfler); kapak fotoğrafı ve tanıtım metni çizilmedi (mevcut ayar alanları: kapak URL, kısa tanıtım). Küçük eksik, F-düşük: kapak/tanıtım alanı online randevu başlığında gösterilsin ya da gerekçesiyle kaldırıldığı yazılsın. |
| **B2** adımlar | Var (hizmet → uzman+gün+saat → bilgiler → doğrulama → onay); doğrulama son adıma alınmış. |
| **B3–B4** iletişim, SMS kodu (6 hane, 10 dk, yeniden gönder sayacı) | Var. |
| **B5** onay + referans kodu | Var; takvime ekle (backend), iptal/değiştirme bağlantısı var. |
| **B6** kapalı, bulunamadı, hata durumları | Var (kapalı, bulunamadı, dolu saat, kod hatası, hız sınırı, ağ). |
| **B7** hız sınırı ve geçersiz kod | Var. |
| **B8** müşteri iptal/değiştirme (M1, 2 saat) | Var; N1, N3 açık. |
| **C1** giriş (hata, hız sınırı) | Var; klinikte 2FA, kurtarma, oturum kilidi de var. |
| **C2** kayıt 2 adım, K1 zorunlu kabul, ticari ileti ayrı | Var; F2 alt tür eksik. |
| **C3** şifre unuttum/sıfırla | Var; e-posta gelmezse destek yolu yazılı. |
| **C4–C5** kurulum sihirbazı, çalışma saati, rezervasyon bağlantısı, ilk randevu görevi | Var (tür, klinik bilgisi, HBYS bilgilendirme, güvenlik, saatler, hizmetler, ekip, yasal, hazır). |
| **E1** ayrı yönetici girişi | Var (2FA kodu dahil). |
| **E2** genel bakış (5 sayı) | Var. |
| **E3** salon listesi, arama, plan/durum süzgeci | Var (arama "ad ya da adres"; API ad+slug, kodda eşleme). |
| **E4** salon ayrıntısı: plan, aktif/pasif (onaylı), deneme uzatma, 30 gün özeti, not alanı, yasal kayıtlar, destek erişimi nedenle ve kayıtlı şeritle | Var. Müşteri verisi gösterilmiyor, ciro tek rakam: hukuk-uyum şartlarıyla uyumlu. Not alanı ve yasal sürüm yayınlama backend gerektirir. |
| **D** tanıtım | İncelenmedi (bu tur kapsam dışı). |

## 10. Sonuç ve yapılacaklar (tur 2)

Tüm yüksek bulgular kapandı. Kalanlar: N1 (kurucu kararı gerektirir), N2, N3, N4 (orta, ekran/metin düzeltmesi), F1 tür-değişim uyarısı, F2 alt tür seçimi (prototipte), B5 (kurucu kararı), geri kalan düşük kalemler. Bu liste kapanınca `[TASARIM HAZIR]` için ürün tarafından engel kalmaz. Kurucuya sorulacaklar (müdür aracılığıyla): B5, N1.

---

# Son tur (2026-10-28): `[TASARIM HAZIR]` sonrası kontrol

**Sonuç: kurucuya sunulabilir.** Engel yok. Aşağıdaki "kalan notlar" frontend kodlama kabul kriteridir, tasarım engeli değil. Yöntem: kaynak okuma + `bulgu-yanitlari.md` karşılaştırması; tarayıcıda çalıştırılmadı. `tanitim.html` ürün tarafından yalnız §5b eşlemesi kadar kontrol edildi, ayrıntıyı pazarlama/hukuk imzalar.

## 11. N1–N7, F1, F2 kapanışı

| # | Durum | Doğrulama |
|---|---|---|
| N1 onay biçimi | **Kapandı** | `panel-ek.js` Online randevu ayarında onay biçimi seçimi (salonda varsayılan: hemen onaylı, klinikte: siz onaylayana kadar "Bekliyor"); `randevu-al.html` onay ekranı ayara göre "Randevunuz alındı" / "Randevu talebiniz alındı. <Salon> onayladığında randevunuz kesinleşir." Kurucu kararı yine de gerekir (varsayılanlar önerimle aynı). |
| N2 klinikte davet → 2FA | **Kapandı** | `giris.html` davet: klinikte `#2fa-kur`, salonda panel. |
| N3 SMS vaadi | **Kapandı** | Onay ekranı "Onay ve hatırlatma SMS ile gelir" yalnızca `?sms=1` (kanal açık) iken. |
| N4 sistem sayfası cümleleri | **Kapandı** | `sistem.html`'de "yeniden denenir" ve "kayıtlarınız güvende" yok. |
| N5 online randevuda not alanı | **Açık, engel değil** | Alan hâlâ yok ve gerekçe `tasarim.md`'ye yazılmamış (yanıt dosyasında da kaydı yok). Kabul: sağlık verisi toplamamak için bilinçli kapsam dışı sayılır; gerekçeyi bir cümleyle yazın. |
| N6 ölü anahtar / yanıt tablosu | **Kapandı** | `bulgu-yanitlari.md` F3, F7 düzeltildi; `personel-izni` anahtarı "kodlamada izin tablosuna taşınır" notuyla kayıtlı. |
| N7 kayıtta önceden dolu ad | **Açık, engel değil** | `giris.html` kayıt adım 1 "Defne Güzellik Salonu" değerli. Frontend kabul kriteri: gerçek ekran boş. |
| F1 tür değişim uyarısı | **Kapandı** | `panel-ek.js:420` onay penceresi: eylem "Türü değiştir", mevcut kayıtlar silinmez, klinik türüne geçişte 2FA zorunlu. 12 türlü liste Ayarlar'da. |
| F2 alt tür | **Kapandı** | `giris.html:50–51` "Diğer randevulu işletme" seçilince alt tür listesi (tırnak, spa, masaj, dövme, saç ekim, başka). Not: alt türden veri modelindeki 11 değere eşleme tablosu hâlâ mimar/teknik-yazar işi. |

## 12. İşlev envanteri: son durum (roller-ve-akislar.md §2)

Durum: **Var** (tasarım+prototip), **Belge** (yalnız `tasarim.md`'de tanımlı), **Kapsam dışı** (bilinçli, gerekçeli).

| Grup | Durum |
|---|---|
| A1.1–A1.4 Bugün: dönem, kartlar, uzman "Günüm", deneme uyarısı + `abonelik-bitti` | Var |
| A1.5 kısayollar | Var (alt menü +, "Randevu oluştur") |
| A2.1 Gün/Hafta/Ay | Var (Ay: gün başına sayı, güne dokun) |
| A2.2–A2.9 boş saat tıkla, filtre (personel+durum), yeni randevu, ayrıntı, saat değiştir, durum, kapat+ödeme (paketten düş), hızlı işlem | Var |
| A2.10 sürükle-bırak | Belge (masaüstünde korunur, "Saati değiştir" ikinci yol) |
| A2.11 kaynak rozeti (online/salonda) | Var |
| A3 bekleme listesi | Var |
| A4.1–A4.5, A4.7–A4.9 müşteri liste/kart/anamnez/geçmiş/cari/paket | Var |
| A4.1 segment rozetleri | Kapsam dışı ("yakında", segment hesaplanmıyor) |
| A4.6 fotoğraf: kategori, ekle, büyüt, sil | Var; URL yerine dosya yükleme (V3). Klinikte "Klinik görüntüleri" (B5 kararı bekliyor) |
| A5 paketler / A6 hizmetler (reçete dahil) | Var |
| A7 personel (profil, yetenek, izin, ödeme geçmişi, "Benim sayfam" olarak Günüm/Benim primim) | Var |
| A8 personel ödemeleri / A9 bahşiş | Var |
| A10 günlük kasa: dönem, özet, tahsilat, gider, gelir, sayım, gün sonu, yazdır, primler | Var |
| A11 hesaplar+virman, cari, alış faturası (sil/iptal et), tedarikçi, stok (hareket, reçete) | Var |
| A12.1–A12.4, A12.6 salon, işletme türü+kategori, online randevu (onay biçimi), modüller, anamnez soruları | Var |
| A12.5 Hesabım (şifre, tüm roller) | Var |
| A12.7 WhatsApp/Telegram kartları | Kapsam dışı (kaldırıldı; "Mesaj asistanı" kapalıyken dürüst bilgi) |
| A12.8 bot ayarları + konuşmalar | Var ("Mesaj asistanı"; bayrağa bağlı) |
| A12.9 `abonelik-bitti` | Var |
| A13.1–A13.2, A13.4 kabuk, çıkış, durumlar | Var |
| A13.3 koyu tema | Kapsam dışı (kurucu kararı 13; tokenlar hazır) |
| B1–B8 online randevu | Var |
| C1–C5 giriş, kayıt, şifre, kurulum | Var (kayıtta işletme adı örnek dolu: N7) |
| D tanıtım sitesi | Ürün tarafı yalnız §5b ("yok" satırları etiketli); ayrıntıyı pazarlama/hukuk imzalar |
| E1–E4 süper yönetici | Var (not alanı ve yasal sürüm yayınlama backend gerektirir) |
| "Yeni (yasal)" işlevler (rıza kapısı, onam, silme/kapatma, veri talebi, 2FA, oturum kilidi, erişim geçmişi) | Var (klinik ve salon modları) |

İşlev kaybı: **yok**. Kapsam dışı olanlar (segment, entegrasyon kartları, koyu tema, URL ile fotoğraf, online randevu notu) gerekçeli.

## 13. Kurucu kararlarının uygulanması (brif 2. tur)

| Karar | Durum |
|---|---|
| R1 4 rol | Uygulandı (+ klinikte Hekim, Sağlık personeli: K2) |
| R2 Resepsiyon kasayı kapatır | Uygulandı |
| R3 uzman kendi randevusunu taşır, ödeme alır, fiyat değiştirmez | Uygulandı (`tutar-degistir` SYR) |
| R4 maskeli telefon | Uygulandı (3 karakter/10 sonuç dahil) |
| R5 düzeltme kaydı, günü yeniden aç | Uygulandı (yalnız Sahip/Müdür, gerekçe + kayıt) |
| R6 gider: Müdür var, Resepsiyon yok | Uygulandı |
| R7 modül yalnız Sahip | Uygulandı |
| R8 davet bağlantısı, kendi şifresi | Uygulandı (kopyala + gönder) |
| R9 Resepsiyon sağlık/fotoğraf görmez | Uygulandı (rıza al eylemi içeriksiz) |
| M1 iptal/değiştirme 2 saat | Uygulandı (+ "salonu arayın") |
| M2 hatırlatma SMS, e-posta yedek | **Kısmen:** SMS dürüstçe "kapalı" gösteriliyor; **e-posta yedek kanal seçimi çizilmemiş** (kodlama sırasında Ayarlar › Bildirimler'e eklenecek, engel değil) |
| V1 veri saklama 30 gün | Uygulandı (abonelik sonu, pasif yap, hesap kapatma) |
| V2 "ilk 12 ay fiyat sabit" (varsayılan kapalı) | **Plan ve abonelik ekranında yok**; fiyat kararıyla birlikte (brif: fiyat sonra) çizilecek. Engel değil |
| V3 fotoğraf URL kalkar, dosya yükleme | Uygulandı (backend/depolama gerekir) |
| V4 veri talebi, elle iletim | Uygulandı ("Verilerinizi talep edin", araç gelene kadar elle) |
| V5 kayıt aktarımı yardımı (Excel) | Vitrin/SSS düzeyinde (panel ekranı gerekmez) |
| S1 klinikler hedef | Uygulandı (iki mod, terim setleri, klinik güvenliği) |
| K1 önce estetik kliniği | Uygulandı (öncelik, varsayılan tür) |
| K2 hekim / sağlık personeli | Uygulandı |
| K3 kayıt türleri (6 grup, "Diğer" alt tür) | Uygulandı |
| K4 terim setleri | Uygulandı (Salon / Klinik-danışan / Klinik-hasta; sahip değiştirir) |
| K5 SGK/sigorta/reçete/e-Nabız kapsam dışı vitrinde | Pazarlama imzalar; kurulumda HBYS bilgilendirmesi var |
| K6 berber sayfası | Belge/vitrin (fiyat netleşmeden yayın yok) |

## 14. Kalan notlar (engel değil; frontend/kurucu)

1. N5 gerekçesini yaz, N7 örnek değerini kodlamada boşalt.
2. M2 e-posta yedek ve V2 "ilk 12 ay sabit" fiyat seçeneği: Ayarlar tasarımına, fiyat kararıyla birlikte.
3. A2.10 sürükle-bırak: kodlama kabul kriteri (gelecek ve sonlanmamış randevu; Sahip/Müdür/Resepsiyon; takvim tam aralık yüklesin, eski 10 randevu hatası tekrar etmesin).
4. B4 telefon kopyalama engeli ve uzman için dışa aktarma yokluğu kabul kriteri.
5. Alt tür → veri modeli (11 değer) eşleme tablosu ve `aesthetic`/`aesthetic_clinic` uyuşmazlığı: mimar.
6. Backend iş listesi `roller-ve-akislar.md` §7'de; güvenlik açıkları (Açık 1–3) tasarımdan bağımsız ve ilk iştir.

**Kurucudan beklenen kararlar:** B5 (klinikte görüntü saklama sekmesi), N1 (online randevu varsayılan onay biçimi), roller-ve-akislar.md §6/§8.4'teki kalan sorular (kayıt klinik türleri listesi, berber sayfası, SGK/sigorta vitrin dili).
