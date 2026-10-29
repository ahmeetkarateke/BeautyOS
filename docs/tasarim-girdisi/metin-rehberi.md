# BeautyOS — Metin Rehberi

- **Sahibi:** teknik-yazar · **Tarih:** 2026-10-28 · **Kapsam:** salon paneli, online randevu sayfası, giriş/kayıt/kurulum, süper yönetici paneli (iç kullanım, aynı terimler), uygulama içi hata ve bildirimler. Tanıtım sitesi tonu için en alttaki bölüme bakın.
- **Dayanak:** `docs/tasarim-brief.md` (kararlar 9, 10, 12, 16, 17), `web-design-guidelines` Türkçe uyarlamaları, impeccable `clarify`. Kod kanıtları `apps/web/src` ve `apps/api/src` (71ee311).
- **Müdür kararları (2026-10-28):** (1) Menü grubu adı **Yönetim**. (2) Mesaj asistanı görünür kalır. (3) **Gün sonu** özelliği vardır (API `POST finance/close-day`, testlerle doğrulandı); terim sözlükte kesin. Eylem: "Günü kapat" → "Gün sonu kaydedildi." (4) Destek e-postası yer tutucu kalır (`[DESTEK_E-POSTASI]`), kurucuya müdür soracak.

---

## 1. Ses ve ton

**Üç sözcük:** net, hızlı, modern. Karşıdaki kişi çoğu zaman telefonda, ayakta, müşteri beklerken okuyor.

| Kural | Doğru | Yanlış |
|---|---|---|
| "Siz" hitabı, ama çoğu cümlede özne gizli kalır | "Randevu oluşturuldu." | "Sayın kullanıcımız, randevunuz başarıyla oluşturulmuştur." |
| Cümle düzeni büyük harf (başlık, buton, menü dahil) | "Yeni müşteri ekle" | "Yeni Müşteri Ekle" |
| Etken çatı, kısa cümle (en çok ~12 sözcük) | "Saat dolu. Başka bir saat seçin." | "Seçilen saat dilimi başka bir randevu tarafından kullanılmaktadır." |
| Emir kipi "-in/-ın" (siz), "-sin" değil | "Tekrar deneyin." | "Tekrar dene." (sen hitabı) |
| Özür dileme, suçlama, şaka yok | "Şifre hatalı." | "Üzgünüz!" / "Hata yaptınız." |
| Ünlem yok (yalnız kutlama anı: ilk randevu, kurulum bitişi) | "Kurulum tamam." | "Harika! Başardınız!!!" |
| Emoji yok (arayüzde ⚠ 🛈 👋 kalkar; ikon kullanın) | — | "Hoşgeldiniz 👋" |
| Nokta: tam cümlede var, buton ve etikette yok | Buton: "Kaydet" · Mesaj: "Müşteri kaydedildi." | Buton: "Kaydet." |
| Sayı ve tutar rakamla | "3 seans kaldı" | "üç seans kaldı" |
| Tırnak: “ ” (tek biçim) | “Yeni randevu” | "Yeni randevu" ile “Yeni randevu” karışık |
| Üç nokta tek karakter: `…` | "Kaydediliyor…" | "Kaydediliyor..." |

**Hitap ayrıntısı:** Panelde kullanıcıya "siz" denir. Kullanıcıya ait listelerde birinci tekil serbest ("Randevularım"). Müşteriye giden mesajlar (SMS, e-posta, online randevu sayfası) da "siz" ile yazılır ve salonun adını açıkça verir.

**Ton ayarı:** Ödeme, silme, hesap kaybı, abonelik: ciddi ve açık, sıcaklık serbest, espri yasak. Başarı: tek kısa cümle. İlk kullanım (boş durum, kurulum): davet eden, yönlendiren.

**Tek fikir kuralı:** Başlık söylediğini ikinci satırda tekrarlamaz. Alt metin ya yeni bilgi verir ya hiç yazılmaz.

---

## 2. Terim sözlüğü (her kavram için tek terim)

Bu liste tek kaynaktır. Arayüz, bildirim, e-posta, SMS, yardım ve tanıtım sitesi aynı terimi kullanır. Kod değişken adları (`appointment`, `staff`) etkilenmez; yalnız kullanıcıya görünen metin.

| Kavram | Kullanılacak terim | Kaçınılacak (neden) |
|---|---|---|
| Takvimdeki kayıt | **Randevu** | Rezervasyon (kodda ve vitrinde karışık geçiyor), Appointment, Seans (seans paket kavramı) |
| Müşterinin kendi başına aldığı randevu | **Online randevu** · sayfa: **Online randevu sayfası** | Online Rezervasyon, Çevrim İçi Rezervasyon, Booking |
| Salonun hizmet alan kişisi | **Müşteri** | Danışan, Hasta, Client, Customer |
| Satılan iş kalemi | **Hizmet** | İşlem, Servis, Service |
| Hizmeti veren kişi (genel) | **Personel** | Çalışan, Eleman, Stilist, Staff |
| Hizmeti veren kişi (randevu seçerken) | **Uzman** | Sanatçı, Operatör. Not: yalnız randevu seçim ekranlarında "Uzman"; menü, liste ve ayarlar "Personel". İki terim iki farklı bağlam; aynı ekranda karıştırılmaz |
| Satıştan personele pay | **Prim** (oranlı pay) | Komisyon (kodda `Komisyon` var; tek terim: Prim), Yüzde |
| Personele yapılan ödeme (maaş+prim) | **Personel ödemesi** | Hakediş, Payout, Bordro |
| Müşterinin bıraktığı ek tutar | **Bahşiş** | Tip, Çay parası |
| Para giriş/çıkış ekranı | **Kasa** (menü: Kasa) | Günlük Kasa, Finans, Banka & Kasa karışıklığı (bkz. aşağı) |
| Banka/POS/nakit hesapları | **Hesaplar** | Banka & Kasa (iki sözcük, "Kasa" ile çakışıyor) |
| Günün sonunda kasayı sayıp kapatma | **Gün sonu** (özellik var: `finance/close-day`) | Z raporu, Kapanış, Day close |
| Boş saat yoksa sıraya alma | **Bekleme listesi** | Sıra, Waitlist, Bekleme Listesi (büyük L) |
| Birden çok seanslık satış | **Paket** · içindeki hak: **seans** | Abonelik paketi (abonelik BeautyOS'un kendi planıdır, karıştırma), Kart |
| Pakette kalan hak | **Kalan seans** | Bakiye, Kredi |
| Müşteri/tedarikçi açık hesabı | **Cari hesap** | Açık hesap, Veresiye, Ledger |
| Tedarikçiden gelen fatura | **Alış faturası** | Satın alma, Gider faturası |
| Ürün miktarı | **Stok** · kalem: **ürün** | Envanter (yalnız kodda), Inventory |
| BeautyOS'a ödenen paket | **Plan** · deneme: **Deneme süresi** | Trial, Tarife, Abonelik paketi |
| Salonun BeautyOS hesabı | **Salon hesabı** | Tenant, Hesap sahibi, Kiracı |
| Salon web adresi parçası | **Online randevu adresi** (ör. `beautyossapp.com/book/…`; tasarımın etiketi, "Salon adresi"nden daha açık) | Slug, Kısa ad, URL |
| Ana ekran | **Bugün** | Dashboard, Kontrol paneli, Ana panel |
| Müşteri sağlık/form kartı | **Müşteri formu** | Anamnez, Müşteri Hakkında |
| Tüm uygulama | **BeautyOS** · yönetim ekranı: **Yönetim paneli** | Panel/Portal/CRM karışımı |
| Otomatik mesaj botu | **Mesaj asistanı** (özellik görünür kalırsa) | Bot, Konuşma botu |
| Rol: salon sahibi | **Salon sahibi** | Owner, Admin, Patron |
| Rol: yönetici | **Müdür** (brif R1; "Yönetici" yalnız süper yönetici bağlamında kullanılmaz) | Manager, Yönetici |
| Rol: çalışan | **Personel** | Staff |
| Rol: BeautyOS ekibi | **Süper yönetici** | Superadmin, Süper admin, Süper Admin |
| Randevu durumları | **Bekliyor · Onaylandı · Devam ediyor · Tamamlandı · İptal edildi · Gelmedi** | Pending, No-show, "Gelmedi" ile "Gelmeyen" karışımı |
| Bekleme listesi durumları | **Bekliyor · Haber verildi · Randevu alındı · Süresi doldu · İptal edildi** | Notified, Booked, Expired |
| Ödeme yöntemi | **Nakit · Kart · Karma · Online** | Cash, Mixed, Pos |
| Hesap oturumu | **Giriş yap / Çıkış yap / Oturum** | Login, Logout, Sign in |
| Görünürlük | **Aç / Kapat** (modül, özellik) | Aktif et, Devre dışı bırak |
| Menü grubu (brif kararı 7) | **Yönetim** (ileri modül grubu: Hesaplar, Cari hesap, Alış faturaları, Tedarikçiler, Stok, Personel ödemeleri). Tasarımcı "Muhasebe/Yönetim" adlarından birini seçip tek tutar; öneri: **Yönetim** | Finans & Stok, Muhasebe/Yönetim iki ad birden |

**Kural:** Yeni bir kavram çıkarsa önce bu tabloya eklenir, sonra ekranda kullanılır. Jargon listesi (arayüzde asla görünmeyecek): slug, tenant, token, dashboard, CRM, bot, trial, owner, manager, payload, API, endpoint, 401/403/404, null, undefined, timeout.

---

## 2b. Sektör uyarlaması (klinik vb.)

Kurucu kararı S1: ürün dili işletme türüne göre uyarlanabilir olmalı. Bu nedenle §2 sözlüğü **çekirdek kavramları** sabitler; ekranda görünen ad **terim setinden** gelir. İşletme türü seçilince (kayıt/kurulum) set belirlenir; sahip birkaç ana terimi değiştirebilir (önerilen, soru #25, kurucu kararı bekliyor). **Bugün kodda yok:** tasarım çizer, kodlama sonra gelir.

### Terim setleri

| Çekirdek kavram | **Salon seti** (varsayılan) | **Klinik-danışan seti** | **Klinik-hasta seti** (onay bekliyor) |
|---|---|---|---|
| İşletme | Salon | Klinik | Klinik |
| Rol: sahip | Salon sahibi | Klinik sahibi | Klinik sahibi |
| Hizmet alan kişi | Müşteri | Danışan | Hasta |
| Hizmeti veren (randevu seçerken) | Uzman | Uzman | Hekim (yalnız hekim rolü; hemşire/asistan: Sağlık personeli) |
| Hizmet | Hizmet | Uygulama | İşlem (Tedavi değil; hukuk-uyum) |
| Müşteri formu | Müşteri formu | Danışan formu | Hasta formu |
| Kişi kartı | Müşteri kartı | Danışan kartı | Hasta kartı |
| Kişiye ait liste/ekran | Müşterilerim | Danışanlarım | Hastalarım |
| Kişi kaydını kapatma/silme | Müşteriyi sil | Danışanı sil | Hasta kaydını kapat |
| Boş durum | Henüz müşteri yok. | Henüz danışan yok. | Henüz hasta yok. |
| "İzin" ayrımı (tüm setlerde) | **Kampanya izni** (iletişim onayı) ile **İzin** (personelin izin günü) ayrı kavramlardır; tek başına "İzin" yalnız personel izni | | |
| Müşteri listesi/menü | Müşteriler | Danışanlar | Hastalar |
| Online randevu sayfası başlığı | Salonunuzdan online randevu alın | Kliniğinizden online randevu alın | Kliniğimizden online randevu alın |
| Bekleme listesi, Kasa, Prim, Paket, Cari hesap, Stok, Gün sonu | Sabit | Sabit | Sabit |

"Hasta" seti kurucu onayı bekliyor. **Hukuk-uyum görüşü: koşullu** (`yasal-ekran-gereksinimleri.md` §10.3, §10.6, §10.8; taslak, avukat görüşü değil):
- **Hasta:** yalnız kurulumda işletme türü "Estetik kliniği" veya "Diş kliniği / muayenehane" seçilmişse. Salon ve güzellik merkezinde kullanılmaz. "Danışan" her modda kullanılabilir.
- **Hekim:** yalnız klinik modunda ve yalnız hekim rolündeki kişiler için; unvan kullanıcı seçimi değil rol adından gelir. Hemşire/asistan: "Sağlık personeli"; güzellik merkezindeki estetisyen: "Uzman".
- **Tedavi:** ürün metinlerinde (menü, buton, pazarlama) **kullanılmaz**; yerine **İşlem** (veya Hizmet). Not alanı adı: **Klinik notu**. Kliniğin kendi girdiği hizmet adları (ör. "Kanal tedavisi") onların verisidir, ama SMS/e-posta hatırlatmalarında görünmez (§10.7).
- **Hiçbir modda kullanılmaz:** Hasta dosyası, Tıbbi kayıt, e-Nabız, Reçete, Teşhis/Tanı.

Bu yüzden tablodaki "Tedavi" satırı "İşlem" olarak okunur; Hasta setinde hizmet alan kişi yalnız klinik işletme türlerinde "Hasta". Vitrinde "Hasta" kullanılmaz; tasarım üç seti ve sahip-düzenleme alanını yine çizer.

### Setten gelen metinler

- Menü ve ekran başlıkları, boş durum, buton ve bildirimler: "Müşteri ekle" → "Danışan ekle" → "Hasta ekle"; "Müşteri eklendi." → "Danışan eklendi."
- Hata ve onay metinleri (§4, §6 tablosundaki "müşteri", "hizmet", "uzman" geçen satırlar), randevu SMS/e-posta metinleri, online randevu sayfası, müşteri formu, rapor başlıkları.
- Setten **gelmeyenler:** yasal metinler, durum adları, teknik/finans terimleri (Kasa, Prim, Cari hesap…) ve sabit rol adları **Müdür** ile **Resepsiyon**. Rol adları kararı (müdür): "Salon sahibi" ve "Uzman" seti izler (klinikte "Klinik sahibi", "Hekim" seti); "Resepsiyon"un klinik setlerinde "Sekreter/Asistan" olup olmayacağı kurucunun #23 cevabına bağlı, şimdilik sabit.

### Kurallar

- Bir ekranda tek set; "müşteri/danışan" karışmaz. Metinler tam cümle ve set anahtarıyla yazılır (`{kisi}`, `{isletme}`), parça birleştirme yok. Türkçe ekleri (ünlü uyumu: "Müşteriyi / Danışanı / Hastayı") için her sette ayrı tam cümle yazılır; ek değişkenle üretilmez.
- Terim tablosu kodda tek yerde tutulur (§7.2 metin kaynağı).
- **Vitrin:** kod gelene kadar klinik sayfasında sektör dili "Yakında" rozetli; panel ekran görüntülerinde panelin gerçek terimi (Müşteri/Salon) görünür ve metin bunu gizlemez. Rozet kod geldikten sonra kalkar.

---

## 3. Eylem adları (buton → ilerleme → sonuç)

Aynı eylem akış boyunca aynı fiili taşır. **Buton** emir ("oluştur"), **bildirim** geçmiş zaman ("oluşturuldu"), **ilerleme** şimdiki zaman ("Oluşturuluyor…").

| Eylem | Buton / bağlantı | İlerleme | Başarı bildirimi |
|---|---|---|---|
| Ekleme (yeni kayıt) | Randevu oluştur · Müşteri ekle · Hizmet ekle · Personel ekle · Paket oluştur | Oluşturuluyor… / Ekleniyor… | Randevu oluşturuldu. · Müşteri eklendi. |
| Kaydetme (düzenleme) | Kaydet | Kaydediliyor… | Değişiklikler kaydedildi. |
| Silme | Sil (kalıcıysa: "Müşteriyi sil") | Siliniyor… | Müşteri silindi. |
| İptal (randevu) | Randevuyu iptal et | İptal ediliyor… | Randevu iptal edildi. |
| Vazgeçme (pencereyi kapat) | Vazgeç | — | — |
| Geri dönme | Geri | — | — |
| Randevu durumu | Onayla · Başlat · Tamamla · Gelmedi olarak işaretle | Güncelleniyor… | Randevu tamamlandı. |
| Ödeme alma | Ödeme al · randevu ekranında: Tamamla ve ödeme al (nihai buton "Ödeme al · ₺850") | Ödeme kaydediliyor… | Ödeme alındı. |
| Personel daveti (brif R8) | Davet gönder | Gönderiliyor… | Davet bağlantısı e-postayla gönderildi. |
| Kampanya iznini kaydetme | İzni kaydet | Kaydediliyor… | Kampanya izni kaydedildi. |
| Personel izni (izin günü) | İzin ekle | Kaydediliyor… | İzin eklendi. |
| Paket satma | Paket sat | Paket satılıyor… | Paket satıldı. |
| Seans düşme | Seans düş | Düşülüyor… | Seans düşüldü. 3 seans kaldı. |
| Bekleme listesine ekleme | Listeye ekle | Ekleniyor… | Bekleme listesine eklendi. |
| Haber verme | Müşteriye haber ver | Gönderiliyor… | Müşteriye haber verildi. |
| Bahşiş dağıtma | Bahşişi dağıt | Dağıtılıyor… | Bahşiş dağıtıldı. |
| Personel ödemesi | Ödemeyi oluştur · Ödendi olarak işaretle | Kaydediliyor… | Ödeme oluşturuldu. · Ödendi olarak işaretlendi. |
| Stok hareketi | Stok girişi ekle · Stok çıkışı ekle | Kaydediliyor… | Stok girişi eklendi. |
| Alış faturası | Faturayı kaydet · Faturayı işle (muhasebeleştir yerine) | Kaydediliyor… | Fatura kaydedildi. |
| Giriş/çıkış | Giriş yap · Çıkış yap | Giriş yapılıyor… | — |
| Kayıt | Hesap oluştur | Hesap oluşturuluyor… | Hesabınız hazır. |
| Şifre | Şifre sıfırlama bağlantısı gönder · Şifreyi değiştir | Gönderiliyor… / Kaydediliyor… | Bağlantı e-postanıza gönderildi. · Şifreniz değiştirildi. |
| Telefon doğrulama | Kod gönder · Doğrula | Kod gönderiliyor… | Kod gönderildi. |
| Kopyalama | Bağlantıyı kopyala | — | Bağlantı kopyalandı. |
| Dışa aktarma (özellik varsa) | Dışa aktar | Dosya hazırlanıyor… | Dosya hazır. |
| Yenileme | Yeniden dene (hata sonrası) · Sayfayı yenile (yalnız doğrulama başarısızsa) | Yükleniyor… | — |

**Yasak buton adları:** Tamam, Evet, Hayır, Gönder (nesnesiz), Onayla (neyi belli değilse), Submit, OK, Cancel. Ana buton her zaman fiil + nesne ("Müşteri ekle").

**Yazım:** "Kaydet" ve "Vazgeç" çiftinde "Vazgeç" ikincil, "Kaydet" birincil görünür. Yıkıcı buton eylemin adını taşır ("Müşteriyi sil", "Evet, sil" değil).

---

## 4. Kalıplar

Köşeli parantez değişken demektir. Her mesaj tam cümle olarak çevrilebilir yazılır; parça birleştirilmez.

### 4.1 Hata mesajı

Biçim: **Ne oldu.** + **Ne yapmalı.** İki cümle, en çok. Teknik kod, HTTP numarası, “hata oluştu” tek başına yazılmaz. Neden biliniyorsa söylenir, bilinmiyorsa uydurulmaz.

| Durum | Metin |
|---|---|
| Kayıt kaydedilemedi (neden belirsiz) | Değişiklikler kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin. |
| Alan geçersiz (alan satırında) | Telefon numarası eksik. 10 haneli yazın, ör. 5xx xxx xx xx. |
| Zorunlu alan | Müşteri adını yazın. |
| Beklenmeyen sunucu hatası | Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sürerse destek ekibine yazın. Referans: [istek no] |
| Kayıt bulunamadı | Bu kayıt bulunamadı. Silinmiş olabilir. Listeye dönün. |
| Çakışma | Bu saatte [uzman] için başka bir randevu var. Başka bir saat seçin. |

Alan hatası alanın altında, kırmızı renk + ikon + metin (yalnız renk değil), `role="alert"`. Form üstünde özet gerekiyorsa: "2 alanı düzeltin." ve ilk hatalı alana odak.

### 4.2 Boş durum (davet eden)

Üç parça: ne olduğu, neden işe yarayacağı (isteğe bağlı), **bir birincil eylem**. Boş durum türü ayrılır:

| Tür | Metin kalıbı |
|---|---|
| İlk kullanım | **Henüz hizmet yok.** Müşteriler hizmet seçerek randevu alır. [İlk hizmeti ekle] |
| Arama/filtre sonucu yok | **Sonuç bulunamadı.** Başka bir ad veya telefon deneyin. [Filtreleri temizle] |
| Yetki yok | **Bu bölümü görme yetkiniz yok.** Salon sahibinden yetki isteyin. |
| Yüklenemedi | **Liste yüklenemedi.** Bağlantınızı kontrol edin. [Yeniden dene] |

Sayfa örnekleri: Randevu → "Bugün randevu yok. [Randevu oluştur]"; Müşteri → "Henüz müşteri yok. [Müşteri ekle]"; Personel → "Henüz personel yok. [Personel ekle]"; Paket → "Henüz paket yok. [Paket oluştur]"; Bekleme listesi → "Bekleyen müşteri yok."; Stok → "Henüz ürün yok. [Ürün ekle]".

### 4.3 Onay ve silme

Mümkünse **geri al** önerilir (silindi + "Geri al", 8 sn). Geri alınamayan işlemde onay penceresi: başlık eylemi söyler, gövde sonucu söyler, buton eylemin adıdır. Tarayıcı `confirm()` kullanılmaz.

> **Müşteriyi silmek istiyor musunuz?**
> Ayşe Yılmaz ve geçmiş randevuları kalıcı olarak silinir. Bu işlem geri alınamaz.
> [Vazgeç] [Müşteriyi sil]

Randevu iptali: "**Randevuyu iptal etmek istiyor musunuz?** [Müşteri adı], [gün saat] randevusu iptal edilir. [Randevuyu koru] [Randevuyu iptal et]".
Çıkış yap: onay gerekmez.
Kaydedilmemiş değişiklik: "**Değişiklikler kaydedilmedi.** Çıkarsanız kaybolur. [Kaydet] [Kaydetmeden çık]".
Örnek veriler uydurma ve anonimdir (gerçek kişi yok).

### 4.4 Başarı bildirimi

Bir cümle, geçmiş zaman, nesne + fiil. 4 saniye, kapatılabilir, ekran okuyucuya `role="status"`. Sonraki adım yalnız karar değiştiriyorsa eklenir.

- "Randevu oluşturuldu."
- "Müşteri eklendi."
- "Randevu oluşturuldu. Müşteriye SMS gönderildi." (yalnız SMS gerçekten gittiyse)
- "Şifreniz değiştirildi. Yeniden giriş yapın."

### 4.5 Yükleniyor

Gerçek işlemi söyler. Liste/sayfa yüklemesi için **iskelet (skeleton)** tercih edilir, metin gerekmiyorsa yazılmaz. Metin gerekirse:

| Bağlam | Metin |
|---|---|
| Sayfa/liste | Yükleniyor… |
| Kaydetme | Kaydediliyor… |
| Gönderme | Gönderiliyor… |
| Uzun işlem (sahte yüzde yok) | Dosya hazırlanıyor. Birkaç saniye sürebilir. |
| Saat dilimleri | Boş saatler getiriliyor… |

`...` değil `…`; "Lütfen bekleyin" yazılmaz.

### 4.6 Yetkisiz erişim

Kullanıcıyı suçlamaz, çıkış yolu verir. HTTP numarası yok.

| Durum | Metin |
|---|---|
| Rol yetmiyor | **Bu sayfayı görme yetkiniz yok.** Gerekiyorsa salon sahibinden yetki isteyin. [Bugün’e dön] |
| Eylem yetkisi yok | Bu işlem için yetkiniz yok. (eylem butonu zaten gizlenir; bu metin yalnız doğrudan bağlantıda) |
| Oturum bitti | **Oturumunuzun süresi doldu.** Devam etmek için yeniden giriş yapın. [Giriş yap] |
| Hesap devre dışı | **Hesabınız şu an aktif değil.** Giriş yapmak için salon sahibiyle iletişime geçin. |
| Abonelik/Deneme bitti | **Deneme süreniz doldu.** Devam etmek için bir plan seçin. [Plan seç] (destek adresi tek: [DESTEK_E-POSTASI], yer tutucu; kurucu belirler) |

Buton yerine rol-dışı menü öğesi **gizlenir**, soluklaştırılmaz (rol matrisi: `roller-ve-akislar.md`).

### 4.7 Bağlantı hatası

Tarayıcının “Failed to fetch” metni hiçbir yerde görünmez. Ağ hatasında:

- Üst şerit (sayfa genel): **İnternet bağlantınız yok.** Bağlantı gelince yeniden denenir. (varsa)
- Eylem sonrası: **Bağlantı kurulamadı.** Değişiklikler kaydedilmedi. Bağlantınızı kontrol edip tekrar deneyin. [Yeniden dene]
- Sunucu yanıt vermiyor: **Sunucuya ulaşılamadı.** Birkaç dakika sonra tekrar deneyin.

**Çevrimdışı çalışma desteklenmez;** "çevrimdışı çalışır" iddiası hiçbir metinde yer almaz (musteri-destek bulgusu).

### 4.8 Hız sınırı (gerçek bekleme süresiyle)

Kodda sınırlar sabit (bkz. §6). Metin gerçek süreyi taşır; "birazdan" denmez. Süre yapılandırılabilir hale gelirse metin değişkenden beslenir (`[süre]`).

| Bağlam | Süre (kod) | Metin |
|---|---|---|
| Genel istek sınırı | 15 dk | Çok fazla istek gönderildi. 15 dakika sonra tekrar deneyin. |
| Başarısız giriş | 15 dk | Çok fazla yanlış giriş denemesi. 15 dakika sonra tekrar deneyin. Şifrenizi unuttuysanız “Şifremi unuttum”u kullanın. |
| Kayıt | 1 saat | Çok fazla kayıt denemesi yapıldı. 1 saat sonra tekrar deneyin. |
| Online randevu denemesi | 1 saat | Çok fazla randevu denemesi yapıldı. 1 saat sonra tekrar deneyin. |
| Telefon doğrulama | 1 saat | Çok fazla doğrulama isteği gönderildi. 1 saat sonra tekrar deneyin. |
| Arama / panel randevu oluşturma | 1 dk | Çok hızlı işlem yapıyorsunuz. 1 dakika sonra tekrar deneyin. |

Mümkünse geri sayım: “Tekrar deneyebilirsiniz: 14:32”.

### 4.9 Form etiketleri ve yardım metni

- Etiket her zaman görünür (placeholder etiket yerine geçmez); placeholder yalnız örnek: `5xx xxx xx xx`.
- İsteğe bağlı alan “(isteğe bağlı)” ile işaretlenir; zorunlu işaret yıldız değil, “zorunlu” kuralı sade tutmak için: isteğe bağlı olanlar işaretlenir, geri kalan zorunludur. Tek biçim.
- Yardım metni gizli soruyu yanıtlar: “Salon adresi” → “Online randevu bağlantınızda görünür: beautyossapp.com/[adres]”.

### 4.10 Hata ve 404 sayfaları (şu an yok)

- **404:** “Sayfa bulunamadı. Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir. [Ana sayfaya dön]”
- **Genel hata:** “Beklenmeyen bir sorun oluştu. Sayfayı yenileyin. Sürerse destek ekibine yazın. Referans: [no] · [Yeniden dene]”
- **Bakım:** “BeautyOS kısa süreli bakımda. Birkaç dakika sonra tekrar deneyin.”

---

## 5. Biçimler (tr-TR, Europe/Istanbul, ₺)

Tüm biçimler `Intl` ile üretilir; elle metin birleştirilmez. Saat dilimi `Europe/Istanbul`, hafta Pazartesi başlar.

| Veri | Biçim | Örnek | Not |
|---|---|---|---|
| Tarih (liste/tablo) | `gg.AA.yyyy` | 28.10.2026 | `Intl.DateTimeFormat('tr-TR')` |
| Tarih (okunur) | `g MMMM yyyy` | 28 Ekim 2026 | Başlıklarda |
| Gün+tarih | `g MMMM, EEEE` | 28 Ekim, Çarşamba | Takvim başlığı |
| **Hangi biçim nerede (kural)** | Bağlama göre, tek kural: **başlık ve "bugün" yakınındaki tarih** okunur biçim ("28 Ekim", yıl bu yılsa yok, başka yıldaysa "28 Ekim 2025"); **liste, tablo, kart içi veri ve geçmiş kayıtlar** sayısal `gg.AA.yyyy` ("12.09.2026"). Aynı satırda ya da aynı bileşende ikisi karışmaz. Göreli ifadeler (Bugün, Yarın, Dün) ilk tercih. | | Müşteri kartı "Son ziyaret: 12.09.2026" doğru; ekran başlığı "28 Ekim, Çarşamba" doğru |
| Kısa gün | `Pzt Sal Çar Per Cum Cmt Paz` | | Üç harf, nokta yok |
| Saat | 24 saat `SS:dd` | 14:30 | AM/PM yok |
| Saat aralığı | `SS:dd – SS:dd` (en tire, boşluklu) | 14:30 – 15:15 | |
| Süre | `n dk` / `n sa n dk` | 45 dk · 1 sa 30 dk | |
| Göreli | Bugün · Yarın · Dün; ötesi tarih | | “3 gün önce” yerine tarih |
| Para | **`₺` başta** (Intl tr-TR çıktısı), binlik nokta, kuruş virgül | ₺1.250,00 · kuruşsuz ₺1.250 | `Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'})`; elle `₺` eklenmez. Panel özetlerinde kuruşsuz (`maximumFractionDigits: 0`), kasa/prim/fatura dökümünde kuruşlu; **aynı ekranda iki biçim karışmaz**. (Önceki "₺ sonda" örneği yanlıştı, ui-ux-tasarimci'nın uyarısıyla düzeltildi) |
| Yüzde | `%` başta | %15 | Türkçe yazımı: `%15` |
| Telefon (gösterim) | `0 5xx xxx xx xx` | 0 532 000 00 00 | Girişte `5xx xxx xx xx` maskeli; saklama biçimi API işi |
| Sayı | binlik nokta, ondalık virgül | 1.250 · 3,5 | |
| Çoğul | Sayıdan sonra tekil: “3 randevu”, “0 randevu” | | “randevular(ı)” yazılmaz |
| Büyük/küçük harf | `toLocaleUpperCase('tr-TR')` yalnız gösterimde | i → İ, ı → I | Etiket büyük harfi (ör. menü grubu “GÜNLÜK”) yerine cümle düzeni önerilir; büyük harf kullanılırsa tr-TR |

**Yazı tipi:** `latin-ext` alt kümesi zorunlu (ı İ ğ Ğ ş Ş ç Ç ö Ö ü Ü). Alan adı örnekleri hep `beautyossapp.com`; `beautyos.com`, `app.beautyos.com`, `beautyos.app` yazılmaz.

---

## 6. API hata kodları → kullanıcıya gösterilecek Türkçe karşılık

Kaynak: `apps/api/src` (middleware, routes, app.ts). Zarf: `{ error: { code, message } }`. Arayüz **`message`'ı ham göstermez**; `code`'a göre bu tablodaki metni gösterir, `code` bilinmiyorsa genel hata metnini (§4.1) gösterir. Kod tarafında `message` içinde kalan teknik sözcükler (tenant, slug, token, seed secret, owner/manager) bu yüzden son kullanıcıya gitmemeli.

| Kod | Şimdiki mesaj (API) | Gösterilecek metin (öneri) | Not |
|---|---|---|---|
| `VALIDATION_ERROR` | Zod mesajı (alan adsız, değişken) | Alan altında: ilgili alan mesajı. Genel: “Girdiğiniz bilgileri kontrol edin.” | API alan adını da döndürmeli (gelistirici'ye öneri) |
| `NOT_FOUND` | Kaynağa göre değişir | Bu kayıt bulunamadı. Silinmiş olabilir. | |
| `UNAUTHORIZED` | Token gerekli. / Kullanıcı bulunamadı veya devre dışı. | Oturumunuzun süresi doldu. Yeniden giriş yapın. | |
| `INVALID_TOKEN` | Token geçersiz veya süresi dolmuş. / Geçersiz token türü. | Oturumunuzun süresi doldu. Yeniden giriş yapın. (şifre sıfırlamada: Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.) | Bağlama göre iki metin |
| `FORBIDDEN` | Yetkiniz yok. / Bu işlem için yetkiniz yok. / Sadece yönetici … | Bu işlem için yetkiniz yok. Gerekiyorsa salon sahibinden yetki isteyin. | “Sadece yönetici silebilir” gibi özel mesajlar tek metne iner |
| `FORBIDDEN` (Süper admin yetkisi gerekli) | Süper admin yetkisi gerekli. | Bu sayfa yalnız BeautyOS yönetimine açık. | Yönetim paneli |
| `FORBIDDEN` (Tenant bulunamadı / Tenant erişimi) | … | Bu salona erişiminiz yok. Doğru hesapla giriş yaptığınızdan emin olun. | |
| `FORBIDDEN` (Geçersiz seed secret) | Geçersiz seed secret. | (Son kullanıcıya gitmez; yönetim aracı) | iç kullanım |
| `TENANT_DELETED` | Hesap aktif değil, lütfen yeniden giriş yapın. | Salon hesabınız aktif değil. Destek ekibine yazın. | |
| `SUBSCRIPTION_REQUIRED` | Trial süreniz dolmuş. Lütfen bir plan seçin. / Aboneliğiniz aktif değil. … | Deneme süreniz doldu. Devam etmek için bir plan seçin. · Planınız aktif değil. Devam etmek için planınızı yenileyin. | “Trial” kalkar; web `api.ts` kodu metin olarak fırlatıyor, düzeltilmeli |
| `CONFIG_ERROR` | Sunucu yapılandırma hatası. | Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. | Genel hata |
| `INTERNAL_ERROR` | Sunucu hatası. | Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sürerse destek ekibine yazın. Referans: [no] | İstek no API'den gelmeli |
| `RATE_LIMIT` | Çok fazla istek / giriş / kayıt / rezervasyon / doğrulama / arama / randevu limiti | §4.8 tablosu (bağlama göre süre) | Süre mesajdan değil bağlamdan |
| `INVALID_CREDENTIALS` | E-posta veya şifre hatalı. | E-posta veya şifre hatalı. | Değişmez: kullanıcı varlığını sızdırmaz |
| `DUPLICATE_EMAIL` | Bu e-posta adresi zaten kullanılıyor. / …kayıtlı kullanıcı zaten var. | Bu e-posta adresiyle kayıtlı bir hesap var. Giriş yapın ya da başka bir adres yazın. | Kayıtta hesap varlığını söylemek risk: hukuk-uyum/gelistirici değerlendirsin |
| `DUPLICATE_SLUG` | Bu slug zaten kullanılıyor. | Bu salon adresi kullanımda. Başka bir adres deneyin. | “slug” kalkar |
| `DUPLICATE_PHONE` | Bu telefon numarasıyla kayıtlı müşteri zaten var. | Bu telefon numarasıyla kayıtlı bir müşteri var. [Müşteriyi aç] | Eylem bağlantısı öneri |
| `INVALID_ACCOUNT` | Hesap bulunamadı. / Hesap(lar) bulunamadı. | Seçilen hesap bulunamadı. Hesabı yeniden seçin. | “Hesap” = Hesaplar (banka/kasa) |
| `INVALID_CUSTOMER` | Müşteri bulunamadı. | Müşteri bulunamadı. Listeden yeniden seçin. | |
| `INVALID_SUPPLIER` | Tedarikçi bulunamadı. | Tedarikçi bulunamadı. Listeden yeniden seçin. | |
| `INVALID_INVENTORY` | Ürün bulunamadı. / Bir veya daha fazla stok kalemi bulunamadı. | Seçilen ürün bulunamadı. Listeyi yenileyin. | |
| `INVALID_PASSWORD` | Mevcut şifre hatalı. | Mevcut şifreniz hatalı. Tekrar deneyin. | |
| `INVALID_PHONE` | Geçersiz telefon numarası. | Telefon numarası geçersiz. 5xx xxx xx xx biçiminde yazın. | |
| `PHONE_NOT_VERIFIED` | Telefon numaranızı önce doğrulamanız gerekmektedir. | Önce telefon numaranızı doğrulayın. [Kod gönder] | |
| `CAPTCHA_FAILED` | Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin. | Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin. | |
| `BOOKING_DISABLED` | Bu salon şu anda online rezervasyon kabul etmiyor. | Bu salon şu an online randevu almıyor. Salonu arayarak randevu alın. | “rezervasyon” → “randevu” |
| `PAST_TIME` | Geçmiş bir saate randevu alınamaz. | Geçmiş bir saate randevu alınamaz. İleri bir saat seçin. | |
| `SLOT_TAKEN` | Bu saat dolu, lütfen başka bir saat seçin. | Bu saat doldu. Başka bir saat seçin. | |
| `SLOT_CONFLICT` / `APPOINTMENT_CONFLICT` | Seçilen personelin bu saatte başka bir randevusu var. | [Uzman] için bu saatte başka bir randevu var. Başka bir saat ya da uzman seçin. | İki kod aynı sonuç; API'de tek koda indirilmeli |
| `STAFF_NOT_SKILLED` | Seçilen personel bu hizmeti yapamaz. | [Uzman] bu hizmeti vermiyor. Başka bir uzman seçin. | |
| `STATUS_LOCKED` | Tamamlanan veya iptal edilen randevunun durumu değiştirilemez. / Bu kayıt bildirilemez. / zaten kapalı | Tamamlanan veya iptal edilen randevu değiştirilemez. · Bu kayıt artık işlem kabul etmiyor. | Mesaj bağlama göre ikiye bölünür |
| `APPOINTMENT_LOCKED` | Tamamlanan veya gelmedi işaretli randevu silinemez. | Tamamlanan veya “Gelmedi” işaretli randevu silinemez. | |
| `PACKAGE_NOT_ACTIVE` | Paket aktif değil. | Bu paket aktif değil. | |
| `NO_SESSIONS_LEFT` | Bu pakette kalan seans yok. | Bu pakette kalan seans yok. Yeni paket satabilirsiniz. | |
| `PACKAGE_EXPIRED` | Paketin geçerlilik süresi dolmuş. | Paketin süresi dolmuş. | |
| `ALREADY_POSTED` | Bu fatura zaten muhasebeleşmiş. | Bu fatura zaten işlenmiş. Değiştirilemez. | “muhasebeleşmiş” → “işlenmiş” |
| `ALREADY_PAID` | Bu ödeme zaten yapılmış. | Bu ödeme zaten alınmış. | Yön: alınan/yapılan bağlama göre |
| `CANCELLED` | İptal edilmiş kayıt ödenemez. | İptal edilen kayıt için ödeme alınamaz. | |
| `INSUFFICIENT_STOCK` | Yetersiz stok. Çıkış miktarı mevcut stoktan büyük. | Stokta yeterli ürün yok. Çıkış miktarı mevcut stoktan fazla. | |
| `CONFLICT` | Bu ürün zaten hizmete bağlı. / Dağıtılmış bahşiş düzenlenemez / silinemez. | Bu ürün bu hizmete zaten bağlı. · Dağıtılmış bahşiş düzenlenemez. · Dağıtılmış bahşiş silinemez. | Üç ayrı bağlam, üç metin |

**Tutarsız zarflar (webhook ve telefon doğrulama):** `webhook.route.ts` düz `{ error: 'Unauthorized' }` ve `'Forbidden'` (İngilizce), `phone-verification.ts` farklı şekil döndürüyor. Kullanıcıya görünmez ama arayüz bu yanıtı alırsa genel hata metni (§4.1) gösterilir. Tek zarf için gelistirici'ye öneri.

**Web tarafı:** `apiFetch` ağ hatasını yakalayıp §4.7 metnini üretmeli; ~45 yerdeki `toast(err.message, 'error')` bu tabloya göre `code`'dan metin seçmeli. Ortak `hataMetni(code, bağlam)` işlevi önerilir (frontend-gelistirici işi).

---

## 7. Mevcut arayüzdeki düzeltme listesi

### 7.1 Yazım ve noktalama

| Şimdiki | Doğru | Yer (K = kod kopyası) |
|---|---|---|
| Hoşgeldiniz / Hoşgeldin | Hoş geldiniz (ayrı yazılır) | `tenant/[slug]/dashboard/page.tsx:63` |
| arttırılarak | artırılarak | `landing/landing-faq.tsx` |
| tarifedesiniz | tarifesindesiniz | `landing/landing-pilot.tsx` |
| Sıkça Sorulanlar / Sıkça Sorulan Sorular | **Sık sorulan sorular** (tek ad; cümle düzeni) | `landing-nav`, `landing-faq`, `landing-footer` |
| Kredi kartı bilgisi talep edilmez / gerekmez | “Kredi kartı gerekmez” (tek ifade, doğrulanınca) | landing metinleri |
| Dashboard'a Git | Bugün’e git (ya da “Takvime git”) | `onboarding/steps/Step4Done.tsx` |
| Dashboard | Bugün | `sidebar`, `mobile-nav`, `modules.ts`, `admin-sidebar`, `admin/dashboard` |
| Yükleniyor... | Yükleniyor… | `book/[slug]`, `finance`, `tips`, `staff-payouts` |
| Güncelleniyor... | Güncelleniyor… | `appointment-status-modal.tsx:173` |
| Title Case başlık ve menü: Bekleme Listesi, Personel Ödemeleri, Alış Faturaları, Günlük Kasa, Cari Hesap, Bot Konuşmaları, Müşteri Hakkında | Bekleme listesi, Personel ödemeleri, Alış faturaları, Kasa, Cari hesap, Mesaj asistanı konuşmaları, Müşteri formu | `sidebar.tsx`, `modules.ts` |
| Menü grubu BÜYÜK HARF (GÜNLÜK, MÜŞTERİ, PERSONEL & HİZMET, FİNANS & STOK, BOT) | Cümle düzeni: Günlük, Müşteriler, Personel ve hizmetler, Yönetim | `sidebar.tsx` (“&” yerine “ve”) |
| Banka & Kasa | Hesaplar | `sidebar.tsx`, `modules.ts` |
| Finans / Günlük Kasa (iki ad aynı ekran) | Kasa | `modules.ts`, `sidebar.tsx` |
| Çevrim İçi Rezervasyon / Online Rezervasyon | Online randevu | `landing-features`, `landing-footer`, `login`, `Step4Done`, `settings` |
| Rezervasyon (diğer yerler) | Randevu | `login/page.tsx`, `settings/page.tsx`, `book/[slug]` |
| Komisyon | Prim | `finance/page.tsx`, `staff/[staffId]/page.tsx`, `create-payout-modal`, `modules.ts`, `landing-features` |
| Nail Stüdyo / Nail Studio / Spa & Wellness | Tırnak stüdyosu · Spa ve wellness → **Spa ve güzellik merkezi** (tek, tam Türkçe) | `modules.ts`, kayıt/kurulum sektör listesi |
| “Bot” (ayarlar, sidebar, mobil menü) | Mesaj asistanı (özellik açıksa; `NEXT_PUBLIC_BOT_FEATURES_ENABLED` kapalıyken görünmez) | `settings/page.tsx`, `sidebar.tsx`, `mobile-nav.tsx` |
| Tip (Tips, Add tip) varsa | Bahşiş | `tips/*` |
| “&” işareti metinde | “ve” | menü ve başlıklar |
| ⚠ 🛈 👋 emojiler | İkon bileşeni (metinde emoji yok) | `dashboard/page.tsx:63` ve uyarı kutuları |
| “owner”, “manager” (kullanıcıya görünen) | Salon sahibi, Yönetici | `appointments` (randevu saati değiştirme mesajı) |
| “Trial”, “slug”, “tenant”, “token”, “seed secret” | Deneme süresi; salon adresi; salon hesabı; oturum | API `message`'ları ve kayıt formu |
| Dil/alan adı: `beautyos.com`, `app.beautyos.com`, `beautyos.app` | `beautyossapp.com` (önizlemelerde salon bağlantısı `beautyossapp.com/book/[adres]`) | `landing-hero:257`, `landing-features:297`, `subscription-required`, `admin/login` |
| Destek e-postası üç ayrı (`destek@beautyos.app`, `destek@beautyossapp.com`, `hello@beautyossapp.com`) | Tek adres, yer tutucu: **[DESTEK_E-POSTASI]** (kurucu belirler, alan adı sahipliği doğrulanır) | `subscription-required`, `landing-faq`, `landing-footer` |
| “Tamam/OK” (`confirm()`) | Eylem adlı onay penceresi (§4.3) | `waitlist/page.tsx:162`, `staff-payouts/page.tsx:310` |
| Boş durum tek satır düz metin | §4.2 kalıbı | `services/page.tsx:98`, `staff/page.tsx:76`, `packages/page.tsx:87`, `inventory/page.tsx:293` |
| `toast(err.message,'error')` ham API metni | `code` → §6 tablosu | ~45 yer, ör. `staff-modal.tsx:100` |
| “Failed to fetch” | §4.7 | `lib/api.ts` |
| `SUBSCRIPTION_REQUIRED` metin olarak fırlatılıyor | §6 | `lib/api.ts:29` |

### 7.2 Metin kaynağı

Tüm kullanıcı metni tek yerde toplanır (ör. `apps/web/src/metin/tr.ts`, anahtar-değer; tasarımcı/frontend karar verir). Sebep: terim tutarlılığı, tek düzeltme noktası, ileride sözlük kontrolü. Birleştirilmiş parça yok: `"{ad} için {saat} randevusu"` biçiminde değişkenli tam cümle.

### 7.3 Vitrin iddiaları (kurucu kararı 15)

Metin düzeyinde doğruluk bulguları (kaynak: önceki inceleme + brif): “AWS” (veri DigitalOcean FRA1), “uçtan uca şifreli”, “iyzico PCI-DSS”, “#1”, “500+ salon”, “42/50”, “KVKK uyumlu”, çevrimdışı çalışma, CSV dışa aktarma, tek tıkla iptal: kod karşılığı doğrulanmadan yazılmaz. Geliştirilebilecekler “Yakında” / “Yol haritasında” etiketi taşır (etiket metni: **Yakında**). Karar ve içerik: `tanitim-sitesi-icerik.md` (pazarlama).

---

## 8. Tanıtım sitesi tonu (pazarlama ile uyum)

Panelle **aynı ses, aynı sözlük**; fark yalnız ikna dozu (Persuade modu).

| Konu | Panel (Operate) | Tanıtım sitesi (Persuade) |
|---|---|---|
| Cümle | En kısa, işlev | Fayda odaklı, yine kısa |
| Başlık | “Yeni randevu” | “Takvimi telefondan yönetin” (fiil, somut) |
| Hitap | siz | siz |
| Terim | Sözlük §2 | Aynı sözlük: Randevu, Müşteri, Prim, Online randevu |
| İddia | Gerçek davranış | Doğrulanmış; abartı yok. Rakam yoksa rakam yazılmaz |
| Çağrı | Eylem fiili | “Ücretsiz deneyin” (koşul doğruysa) / “Yakında” rozeti |
| Yasak | Jargon, emoji | “Devrim”, “en iyi”, “#1”, “sınırsız” (doğrulanmadıysa), şablon kalıpları (“Sektörün lideri”, “Geleceğin teknolojisi”), AI klişesi |

**Pazarlama'ya iletilecek:** sözlük §2 tanıtım sitesinde de bağlayıcı; “yakında” etiketi tek biçim; destek adresi tek yer tutucu; ürün ekran görüntüleri yeni tasarımdan (kararlar 14).

---

## 9. Kontrol listesi (her ekran için)

- [ ] Sözlükteki terimler; yasak sözcük yok
- [ ] Cümle düzeni büyük harf, emoji yok, `…` tek karakter
- [ ] Buton fiil + nesne; yıkıcı eylem adı butonda
- [ ] Hata: ne oldu + ne yapmalı; kod görünmüyor
- [ ] Boş durum: açıklama + tek birincil eylem
- [ ] Yükleniyor / boş / hata / başarı / yetkisiz metinleri yazılı
- [ ] Tarih, saat, ₺ biçimi tr-TR
- [ ] Örnek veriler uydurma, anonim, gerçekçi Türkçe, ekran içinde tutarlı
- [ ] Destek adresi: [DESTEK_E-POSTASI]

## 10. Kararlar ve açık kalan

Kapandı (müdür): menü grubu **Yönetim**; **Mesaj asistanı** görünür kalır; **Gün sonu** vardır (eylem "Günü kapat", bildirim "Gün sonu kaydedildi.").
Açık: tek destek e-posta adresi ve alan adı sahipliği (`[DESTEK_E-POSTASI]`, kurucuya müdür soracak).
