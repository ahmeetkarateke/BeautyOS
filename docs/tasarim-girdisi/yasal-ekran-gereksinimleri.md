# BeautyOS Yeniden Tasarım — Yasal Ekran Gereksinimleri

> **TASLAKTIR, AVUKAT GÖRÜŞÜ DEĞİLDİR.** Bu belge tasarımcı için hazırlanmış bir uyum girdisidir. Hukuki görüş yerine geçmez. Buradaki onay kutusu ve bilgilendirme metinleri **öneridir**. Canlıya çıkmadan önce bir bilişim/KVKK avukatına kontrol ettirilmeli ve kurucu tarafından onaylanmalıdır. Mevzuat atıfları 2026-10-27 tarihli `docs/kvkk-tasima-degerlendirmesi.md` §7'ye ve 2026-10-28 incelemesine (`raporlar/inceleme/beautyos-2026-10-28/hukuk-uyum.md`) dayanır. Bu belge için yeniden doğrulanmadı ("teyit" yazan maddeler özellikle kontrol edilmeli). Resmi kaynaklar: kvkk.gov.tr, mevzuat.gov.tr, resmigazete.gov.tr.

- **Tarih:** 2026-10-28 · **Sahibi:** hukuk-uyum · **Okuyan:** ui-ux-tasarimci (birincil), urun-analisti, pazarlama, teknik-yazar
- **Kod referansı:** `tasima/docker` @ `71ee311`
- **Kapsam:** brif kararı 1'deki beş yüzey. Her madde için "ne görünmeli", "nerede", "nasıl davranmalı" yazıldı. Tam yasal metin bu belgenin konusu değildir.

---

## 0. Tasarımcı için 10 temel kural (her ekranda geçerli)

1. **Sözleşme kabulü, aydınlatma ve açık rıza üç ayrı şeydir; asla aynı kutuda birleştirilmez.**
   - *Sözleşme kabulü* (kullanım şartları, DPA): zorunlu onay kutusu.
   - *Aydınlatma*: yalnız **bilgilendirme**. Onay kutusu olmaz, bağlantı ve kısa metin olarak sunulur. "Okudum, onaylıyorum" kutusu **konmaz**.
   - *Açık rıza* (sağlık verisi, fotoğraf, ticari ileti): her amaç için **ayrı**, **isteğe bağlı**, **önceden işaretsiz** kutu ya da düğme. Hizmet almanın şartı yapılmaz.
2. **Önceden işaretli onay kutusu yoktur.** Varsayılan her zaman "işaretsiz / izin yok".
3. **Reddetmek, kabul etmek kadar kolaydır.** "Onaylıyorum / Onaylamıyorum" düğmeleri aynı boyutta, aynı görsel ağırlıkta olur. Biri gri metin bağlantısı, öteki renkli düğme olamaz.
4. **Yasal bağlantılar sayfadan çıkarmaz.** Form doldurulurken açılan metin, telefonda alttan açılan bir sayfa (bottom sheet), masaüstünde modal olur. Girilen bilgi kaybolmaz.
5. **Her rıza ve kabulün izi görünür.** Kayıtlı bir rıza her zaman şu biçimde gösterilir: durum + sürüm + tarih + kaydeden + kanal. Örnek: `Açık rıza: Var · Metin v1 · 12.10.2026 · Kaydeden: Zeynep K. · Tablette imza`.
6. **Geri alma, verme kadar kolaydır.** Her rızanın yanında "Geri al" eylemi bulunur (yetkili rol için).
7. **Sağlık verisi "göz önünde" durmaz.** Takvim kartında, randevu listesinde, bildirim önizlemesinde, kilit ekranı bildiriminde, kasa ekranında anamnez ya da alerji bilgisi **görünmez**. Yalnız "Sağlık notu var" gibi içeriksiz bir işaret kullanılabilir; bu işaret de yalnız yetkili role görünür.
8. **Yanlış güvence yok.** Hiçbir ekranda "KVKK uyumlu", "uçtan uca şifreli", "%100 güvenli", "tam uyumlu" gibi rozet ya da ifade kullanılmaz (bkz. §5).
9. **Yasal metinler prototipte yer tutucudur.** Gövde metni şu kutuyla gösterilir: `[YASAL METİN — avukat onayından sonra eklenecek · Belge: <ad> · Sürüm: v0]`. Uydurma yasal metin (lorem ipsum hukukçası) yazılmaz.
10. **Yıkıcı işlemler (silme, rıza geri alma, hesabı kapatma) iki adımlıdır** ve sonucu (neyin silinip neyin kalacağını) önceden açıkça söyler.

> **Yeni işlev uyarısı (brif kararı 3: "işlevler aynı kalır"):** Aşağıdaki öğelerin bir kısmı bugün kodda **yok** (kabul kaydı, rıza kaydı, müşteri silme, dışa aktarma, salon aydınlatma ayarı, ticari ileti kaydı). Bunlar mevcut bir işlevin kaybı değil, **ilk gerçek salondan önce zorunlu yasal eklemelerdir** (2026-10-28 incelemesi H3–H7). Tasarımcı bunları çizer ve ekran envanterinde **"yeni (yasal)"** etiketiyle işaretler. Kodlanmaları ayrı iştir (urun-analisti + mimar).

---

## 1. Giriş / kayıt / şifre sıfırlama / ilk kurulum (yüzey c)

### 1.1 Kayıt — Adım 2 "Hesap bilgileri"

Bugünkü durum: iki adım var (`signup/page.tsx`), adım 2'de ad, telefon, e-posta, şifre alınıyor. Hiçbir onay kutusu ya da yasal bağlantı yok (H3).

**Karar: Tek zorunlu sözleşme kutusu + ayrı bir aydınlatma satırı + ayrı ve isteğe bağlı bir ticari ileti kutusu.**

| # | Öğe | Tür | Zorunlu mu | Varsayılan |
|---|---|---|---|---|
| K1 | Kullanım Şartları + Veri İşleme Sözleşmesi kabulü | Onay kutusu | **Evet** (işaretlenmeden "Hesap oluştur" pasif) | İşaretsiz |
| K2 | Aydınlatma metni | Kutu yok, yalnız metin + bağlantı | — | — |
| K3 | BeautyOS'un ürün ve kampanya e-postaları | Onay kutusu | Hayır | İşaretsiz |

**Neden K1 tek kutu (iki ayrı kutu değil):** Kullanım Şartları ve DPA, aynı iki taraf (BeautyOS ↔ salon) arasındaki, aynı hizmetin zorunlu sözleşme koşullarıdır. İkisi de hizmetin şartıdır, birini kabul edip ötekini reddetmek mümkün değildir. Ayrı kutu hukuki bir yarar sağlamaz, yalnız sürtünme ekler. Ancak **iki belge ayrı bağlantı olarak, adlarıyla** görünmelidir ve kabul kaydı her belge için **ayrı satır** olarak tutulur. (Avukat iki ayrı kutu isterse tasarım kolayca ikiye bölünebilir. Bileşeni buna uygun kurun.)

**Neden K2 kutu değil:** Aydınlatma bir bilgilendirmedir, rıza değildir. "Okudum, onaylıyorum" kutusu, aydınlatmayı rızaymış gibi gösterir ve Kurul kararlarında eleştirilen bir uygulamadır (Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ, RG 10.03.2018; teyit).

**Neden K3 ayrı ve isteğe bağlı:** Ticari ileti onayı sözleşme kabulüne bağlanamaz. Salon sahibi tacir ya da esnaf olsa bile (bu durumda önceden onay şartının istisnası olabilir, teyit), en temiz ve en profesyonel yol açık bir isteğe bağlı kutudur.

**Yerleşim (390 px):** Şifre Tekrar alanının altında, "Hesap oluştur" düğmesinin hemen üstünde. Sıra: K1 → K3 → K2 (aydınlatma satırı düğmenin hemen üstünde, küçük ama okunabilir, en az 13 px, yeterli kontrast).

**Davranış:**
- Kutu ve etiket metninin tamamı tıklanabilir (en az 44 px yükseklik). Bağlantılar etiket içinde ayrı odaklanabilir öğedir. Bağlantıya dokunmak kutuyu işaretlemez.
- K1 işaretlenmeden gönderilmeye çalışılırsa kutunun altında hata: "Devam etmek için Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni kabul etmeniz gerekir."
- Bağlantılar bottom sheet/modal açar. Sheet içinde belge adı, sürüm, yürürlük tarihi ve yer tutucu gövde görünür. Sheet içinde "Kabul ediyorum" düğmesi **olmaz** (kabul yalnız formdaki kutudan verilir).

**Önerilen metinler:**
- K1: `Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni okudum, kabul ediyorum.` (iki belge adı ayrı bağlantı)
- K3: `BeautyOS'un yeni özellik ve kampanya duyurularını e-postayla almak istiyorum. (İsteğe bağlı)`
- K2: `Kişisel verilerinizin nasıl işlendiğini Aydınlatma Metni'nde bulabilirsiniz.`

**Kabul kaydı (arka uç için; tasarımda görünmez ama Ayarlar'da gösterilir, bkz. §2.8):** her belge için ayrı satır:
`belge türü (kullanım şartları / DPA / ticari ileti) · belge sürümü · kabul eden kullanıcı · salon (tenant) · tarih-saat (UTC) · IP adresi · tarayıcı bilgisi · kanal (web kayıt / yeniden kabul) · kutu etiketinin sürümü`. Aydınlatma için "gösterildi" kaydı (sürüm + tarih) tutulması önerilir, kabul olarak değil.

### 1.2 Sözleşme sürümü değişince yeniden kabul ekranı (yeni)

Kullanım Şartları ya da DPA'nın yeni sürümü yayınlandığında, salon sahibi (yalnız `owner`) girişten sonra tam ekran bir bildirimle karşılaşır:
- Başlık: `Kullanım koşullarımız güncellendi`
- Gövde: değişikliklerin 2–4 maddelik özeti (yer tutucu) + belge bağlantıları + yürürlük tarihi.
- Tek zorunlu kutu (K1 metni) ve "Devam et" düğmesi. İkincil eylem: "Hesap ayarlarına git" (feshetmek isteyen için).
- Diğer roller (resepsiyon, personel) bu ekranı görmez. Sahip kabul edene kadar onlara üstte ince bir şerit gösterilebilir: "Salon sahibinizin onaylaması gereken bir güncelleme var."

### 1.3 Giriş

- Onay kutusu **yok**.
- Sayfanın altında küçük bağlantılar: `Kullanım Şartları · Gizlilik Politikası · Aydınlatma Metni`.
- "Türkiye'nin #1 Salon Platformu" ve "500+ salon güveniyor" **kaldırılır** (H16). Yerine sosyal kanıt yok; kısa ürün tanımı yeterli (bkz. §5).

### 1.4 Şifre sıfırlama

- E-posta girildikten sonra her durumda **aynı** mesaj: `Bu e-posta adresiyle bir hesap varsa, şifre sıfırlama bağlantısını gönderdik.` Hesabın var olup olmadığı açığa çıkarılmaz (KVKK m.12 güvenlik tedbiri).

### 1.5 İlk kurulum sihirbazı

Salonun **veri sorumlusu** olarak kimliği bu adımda toplanır. Bu bilgiler salonun müşterilerine yönelik aydınlatma metninde kullanılır (bkz. §2.7).
- "Salon yasal bilgileri" adımı (atlanabilir, "Sonra tamamla" ile; atlanırsa panelde kalıcı bir hatırlatma kartı): `Ticari unvan / ad soyad`, `Adres`, `İletişim e-postası`, `Telefon`. Yardım metni: `Bu bilgiler, müşterilerinize gösterilecek aydınlatma metninde "veri sorumlusu" olarak yer alır.`
- "Müşteri aydınlatma metni" adımı: `BeautyOS şablonunu kullan` (önerilen, birincil) / `Kendi metnimi yapıştır`. Şablon önizlemesi yer tutucu.
- Fatura bilgileri (abonelik faturası için: unvan, vergi dairesi, VKN/TCKN, adres) **sihirbazda zorunlu değil**; ödeme altyapısı gelene kadar Ayarlar > Abonelik altında yer tutucu (H13, finans kararı).

---

## 2. Salon paneli (yüzey a)

### 2.1 Müşteri ekle / düzenle formu

- **Veri en aza indirme:** zorunlu alanlar yalnız `Ad Soyad` ve `Telefon`. Doğum tarihi, e-posta, adres, notlar isteğe bağlı. TC kimlik numarası alanı **eklenmez**.
- **Alerji notu (`allergyNotes`) sağlık verisidir.** Genel müşteri formunda serbest metin alanı olarak durmaz. "Sağlık bilgileri" bölümüne (anamnezle birlikte) taşınır ve aynı açık rıza kapısının arkasında olur (bkz. §2.2). Genel "Notlar" alanının yardım metni: `Sağlık bilgisi yazmayın; bunun için Sağlık bilgileri bölümünü kullanın.`
- **Ticari ileti izni** (bkz. §2.4) formda ayrı bir bölüm olarak bulunur, varsayılan "izin yok".
- Formun altında salon personeline yönelik tek satır hatırlatma (müşteriye değil): `Müşterinizi kişisel verileri hakkında bilgilendirdiğinizden emin olun. Aydınlatma metnini yazdır / gönder.` → aydınlatma metnini yazdırma ya da SMS ile bağlantı gönderme eylemi (bağlantı gönderme bir bilgilendirme iletisidir, İYS gerekmez).

### 2.2 Sağlık bilgileri (anamnez + alerji) — açık rıza akışı

Sağlık verisi özel nitelikli veridir (KVKK m.6). Güzellik salonu için pratikteki dayanak **açık rızadır** (bkz. `kvkk-tasima-degerlendirmesi.md` §3.1). Bugün rıza kaydı yok (H4).

**Durum 1 — rıza yok (varsayılan):** Müşteri detayındaki "Sağlık bilgileri" sekmesi açıldığında form **gösterilmez**, yerine bir kilit paneli:
- Başlık: `Sağlık bilgileri için açık rıza gerekiyor`
- Metin: `Alerji ve sağlık geçmişi gibi bilgileri kaydetmeden önce müşterinizden açık rıza almanız gerekir.`
- Birincil eylem: `Rıza al` · İkincil: `Rıza metnini yazdır`

**`Rıza al` akışı — kanal seçimi (3 seçenek):**
1. **Tablette / telefonda müşteri onayı** (önerilen): Ekran "müşteri moduna" geçer. Panel menüsü, diğer müşteriler ve personel bilgisi **gizlenir**. Ekranda yalnız salon adı, rıza metni (yer tutucu, sürüm numarasıyla), müşterinin adı ve **eşit ağırlıkta iki düğme**: `Onaylıyorum` / `Onaylamıyorum`. İsteğe bağlı parmakla imza alanı. Sonra "Cihazı personele geri verin" ekranı; panele dönüş için personel kilidi (PIN ya da yeniden giriş). Müşteri modunda geri tuşu panele dönmez.
2. **Islak imzalı form**: `Rıza metnini yazdır` → personel imzalı formu aldıktan sonra `Islak imzalı formu aldım` seçer. İsteğe bağlı olarak taranmış formu yükleme alanı (fotoğraf yükleme altyapısı gelince; o zamana kadar yalnız işaret).
3. **SMS bağlantısıyla onay**: Müşterinin telefonuna rıza sayfası bağlantısı gider. Sayfa, müşteri modundaki ekranın aynısıdır. Bekleme durumu: `Onay bekleniyor · SMS 12.10.2026 14:32'de gönderildi · Yeniden gönder`.

**Durum 2 — rıza var:** Formun üstünde durum satırı: `Açık rıza: Var · Metin v1 · 12.10.2026 · Kaydeden: Zeynep K. · Tablette onay`. Sağda `…` menüsü: `Rıza geçmişi`, `Rızayı geri al`.

**Durum 3 — müşteri onaylamadı:** `Müşteri sağlık bilgisi paylaşmayı kabul etmedi · 12.10.2026`. Form kapalı kalır. `Yeniden sor` eylemi.

**Rızayı geri al:** İki adımlı onay penceresi:
- Başlık: `Açık rıza geri alınsın mı?`
- Metin: `Bu müşterinin kayıtlı tüm sağlık bilgileri (anamnez cevapları ve alerji notu) kalıcı olarak silinecek. Bu işlem geri alınamaz.`
- Düğmeler: `Vazgeç` / `Rızayı geri al ve sil` (yıkıcı renk).

**Yetki ve kayıt (urun-analisti rol matrisiyle eşlenmeli):**
- Sağlık bilgilerini kimin görüp düzenleyebileceğini salon belirler (Ayarlar > Gizlilik ve KVKK, bkz. §2.7). Varsayılan öneri: `owner` ve `manager` görür/düzenler, `staff` yalnız **kendi randevusu olan** müşterinin bilgisini görür, resepsiyon görmez.
- Yetkisiz rol sekmeyi görür ama içerik yerine: `Bu bilgiyi görüntüleme yetkiniz yok.` (Sekmeyi tümden gizlemek de kabul edilir; tasarımcı tutarlılığa göre seçer.)
- Sekmenin altında küçük not: `Sağlık bilgilerinin görüntülenmesi ve değiştirilmesi kayıt altına alınır.` (Kurul 2018/10 sayılı karar: erişim kaydı. Kayıtta **değer** tutulmaz, yalnız kim-ne zaman-ne işlem.)

**Önerilen rıza ekranı metni (kısa, yer tutucu gövdeyle):**
> **Sağlık bilgileriniz için açık rıza**
> [Salon Adı], size uygun ve güvenli bir uygulama yapabilmek için alerji ve sağlık geçmişinize ilişkin bilgileri kaydetmek istiyor. Bu bilgiler yalnız salon içinde, yetkili personel tarafından görülür. Onay vermeniz zorunlu değildir; onayınızı istediğiniz zaman geri alabilirsiniz.
> `[RIZA METNİ — avukat onayından sonra eklenecek · Sürüm v0]`
> [ Onaylıyorum ]   [ Onaylamıyorum ]

> Not (avukata sorulacak): Bazı uygulamalar sağlık bilgisi olmadan güvenli yapılamayabilir. Salon "bu işlemi rıza olmadan yapamayız" diyebilir mi, yoksa bu rızayı hizmet şartına bağlamak mı sayılır? Tasarım bu iki durumu da taşıyabilecek biçimde kalmalı (rıza reddi randevuyu engellemez, yalnız sağlık formu kapalı kalır).

### 2.3 Fotoğraflar (öncesi / sonrası)

Bugün personel dış bir URL yapıştırıyor (H9). Bu, hukuken savunulamaz (bilinmeyen yurt dışı sunucu, silme ve erişim kontrolü yok).
- Tasarımda fotoğraflar **uygulama içine yükleme** olarak çizilir. "https URL yapıştırın" ifadesi ve alanı tasarımda **yer almaz**. (Bu, mevcut işlevin biçim değişikliğidir; URL yönteminin kaldırılması işlev kaybı sayılırsa karar müdür/kurucudadır. Benim önerim kaldırmak.)
- Fotoğraf bölümü de rıza kapısının arkasındadır, ama **sağlık rızasından ayrı** bir rızayla. İki ayrı amaç, iki ayrı onay:
  - **F1 — Kayıt amaçlı saklama** (müşteri dosyasında, uygulamanın takibi için): `Uygulama öncesi ve sonrası fotoğraflarımın salon kayıtlarımda saklanmasını kabul ediyorum.`
  - **F2 — Tanıtımda kullanım** (sosyal medya, vitrin): `Fotoğraflarımın, yüzüm görünmeyecek şekilde / görünecek şekilde [seçim], [Salon Adı]'nın tanıtımlarında kullanılmasını kabul ediyorum.` F2, F1'den bağımsızdır; F1 olmadan da F2 sorulmaz (önce saklama).
- Her fotoğraf kartında küçük etiket: `Yalnız kayıt` ya da `Tanıtımda kullanılabilir`. F2 yoksa fotoğrafın "paylaş / indir" eylemleri yalnız yetkili role açık olur ve uyarı gösterir: `Bu fotoğraf için tanıtım izni yok.`
- F1 geri alınırsa: `Bu müşterinin tüm fotoğrafları silinecek.` iki adımlı onay.
- Rıza alma kanalları §2.2 ile aynı bileşeni kullanır (müşteri modu / ıslak imza / SMS bağlantısı).

### 2.4 Ticari ileti izni (müşteri detayında)

Bugün `marketingConsentSms/Email` alanları okunuyor ama hiçbir yerde yazılmıyor (H6).
- Bölüm başlığı: `Kampanya ve duyuru izinleri`
- Her kanal ayrı satır: `SMS`, `E-posta` (arama izni gerekirse üçüncü satır). Her satırda durum: `İzin yok` (varsayılan) / `İzin var · 12.10.2026 · Kaynak: Online randevu formu`.
- İzin ekleme eylemi personelden **kaynak** ister (seçim, zorunlu): `Online randevu formu`, `Islak imzalı form`, `Müşterinin SMS ile onayı`. "Sözlü" seçeneği **konmaz** (ispat edilemez; teyit).
- Bilgi notu: `İzin, İleti Yönetim Sistemi'ne (İYS) salonunuz adına kaydedilir.` (İYS entegrasyonu yoksa bu satır `İYS kaydı: yakında` olarak dürüstçe işaretlenir.)
- İzin kaldırma tek dokunuştur, onay penceresi gerekmez (geri almak kolay olmalı).
- **Hatırlatma ve doğrulama SMS'leri bu izinden bağımsızdır** (bilgilendirme iletisidir). Bu ayrım ekranda tek satırla anlatılır: `Randevu hatırlatmaları bu izinden bağımsız olarak gönderilir.`

### 2.5 Müşteri silme (yeni)

- Yer: müşteri detayında `…` menüsünün en altında, yıkıcı renkte: `Müşteriyi sil`. Yalnız `owner` ve `manager` görür (urun-analisti matrisiyle eşlenmeli).
- Onay penceresi (iki adım):
  - Başlık: `Ayşe Yılmaz silinsin mi?`
  - Metin: `Müşterinin kişisel bilgileri, sağlık bilgileri, fotoğrafları ve izinleri kalıcı olarak silinir. Geçmiş ödeme ve fatura kayıtları yasal saklama süresi boyunca isim içermeden tutulur. Gelecekteki randevuları iptal edilir.`
  - İsteğe bağlı alan: `Silme nedeni` (`Müşterinin talebi (KVKK başvurusu)`, `Mükerrer kayıt`, `Diğer`). "Müşterinin talebi" seçilirse ek not: `Başvuruyu 30 gün içinde yanıtlamanız gerekir. Silme tarihi kaydedilir.`
  - Düğmeler: `Vazgeç` / `Kalıcı olarak sil`.
- Sonuç: toast `Müşteri silindi.` (Geri al düğmesi **olmaz**; kalıcı silme.)

### 2.6 Müşteri verisini dışa aktarma (yeni)

- Müşteri detayı `…` menüsü: `Müşteri verisini indir`. Amaç: müşterinin KVKK m.11 başvurusunu (verilerimi görmek istiyorum) yanıtlayabilmek.
- Açıklama: `Bu müşteriye ait tüm kayıtlar (kişisel bilgiler, randevular, ödemeler, izinler, sağlık bilgileri ve fotoğraflar) tek dosyada indirilir.` Biçim seçimi: PDF (müşteriye vermek için) / CSV (yer tutucu; mimar karar verir).
- Sağlık bilgisi içerdiği için yalnız sağlık bilgisi yetkisi olan rol indirebilir; işlem kayda geçer.
- **Salon geneli dışa aktarma** (Ayarlar > Veri > `Tüm verileri dışa aktar`, yalnız `owner`): abonelik sonu veri iadesi için. Bu özellik yapılmadan tanıtım sitesinde "Excel/CSV dışa aktarım" denmez (H14).

### 2.7 Ayarlar > Gizlilik ve KVKK (yeni bölüm, yalnız `owner`, isteğe bağlı `manager` görüntüler)

| Alan | İçerik |
|---|---|
| Veri sorumlusu bilgileri | Sihirbazdaki salon yasal bilgileri (§1.5), düzenlenebilir |
| Müşteri aydınlatma metni | Şablon / kendi metni, sürüm numarası, son güncelleme, önizleme. Online randevu sayfası ve bot bu metne bağlanır |
| Rıza metinleri | Sağlık bilgileri, fotoğraf (F1, F2), ticari ileti. Her biri sürümlü, şablondan. Metin değişince yeni sürüm oluşur, eski rızalar eski sürümle kayıtlı kalır |
| Sağlık bilgisi erişimi | Hangi rol görür / düzenler (anahtarlar) |
| İYS bilgisi | Salonun İYS marka kodu (yer tutucu; kampanya özelliği gelince) |
| Sözleşmeler | Kabul edilen Kullanım Şartları ve DPA: sürüm, tarih, kabul eden. Alt işleyen listesi bağlantısı |
| Bilgi kutusu | `VERBİS kaydı gerekip gerekmediğini avukatınız ya da mali müşavirinizle değerlendirin.` + bağlantı (yer tutucu rehber) |

### 2.8 Ayarlar > Abonelik / Hesap

- Deneme ya da abonelik bitiş ekranı veri akıbetini **açıkça** söyler: `Aboneliğiniz sona erdiğinde verileriniz [SÜRE — kurucu kararı] gün saklanır. Bu sürede verilerinizi dışa aktarabilirsiniz. Süre sonunda tüm veriler kalıcı olarak silinir.` (Bugün veri süresiz kalıyor ve SSS "hesap kendiliğinden kapanır" diyor; H5.)
- `Hesabı kapat ve verileri sil` (yalnız `owner`, en altta, yıkıcı): iki adımlı onay, önce dışa aktarma önerisi, sonra salon adını yazarak onay.

### 2.9 Takvim, randevu, kasa, bildirimler

- Randevu kartı ve detayında sağlık bilgisi **gösterilmez**. Yetkili role yalnız içeriksiz bir simge: `Sağlık notu var` (dokununca müşteri detayına, yetki kontrolüyle gider).
- Push/kilit ekranı bildirim önizlemesinde müşteri adı + hizmet yeterli; telefon numarası ve not yok.
- Kasa ve rapor ekranlarında telefon numarası listede maskeli gösterilebilir (`0532 *** ** 12`); tam numara detayda. (Öneri, zorunlu değil; ekran müşteriye dönük resepsiyon tabletinde olabilir.)

### 2.10 Mesaj şablonları ve bot ayarları

- Hatırlatma/doğrulama SMS şablonu düzenlenebiliyorsa alanın altında uyarı: `Bu mesajlar bilgilendirme amaçlıdır. Kampanya, indirim ya da tanıtım içeriği eklemeyin; bu, ticari ileti izni gerektirir.`
- Telegram/WhatsApp botu karşılama mesajı önizlemesinde **sabit, silinemez** bilgilendirme satırı: `Kişisel verileriniz [Salon Adı] tarafından randevu amacıyla işlenir. Mesajlarınız yapay zekâ destekli bir hizmetle yurt dışındaki sunucularda işlenebilir. Ayrıntılar: [bağlantı]` (H7, H8; metin avukatla netleşmeli.)
- Personel daveti: davet e-postasında/kabul ekranında BeautyOS Kullanım Şartları ve Gizlilik Politikası bağlantısı (personelin kendi hesap verisi için). Kabul kutusu gerekmez; sözleşmenin tarafı salondur.

---

## 3. Müşterinin online randevu sayfası (yüzey b)

Veri sorumlusu **salondur**. BeautyOS yalnız altyapıdır; sayfa salonun adıyla konuşur.

### 3.1 "İletişim bilgileri" adımı

Sıra (yukarıdan aşağı): seçilen hizmet özeti → Ad Soyad → Telefon + doğrulama → **ticari ileti kutusu (R2)** → **aydınlatma satırı (R1)** → Turnstile → `Randevu talebini gönder`.

**R1 — Aydınlatma (kutu yok):**
`Kişisel verileriniz, randevunuzu oluşturmak ve size hatırlatma göndermek amacıyla [Salon Adı] tarafından işlenir. Ayrıntılar için Aydınlatma Metni'ni inceleyebilirsiniz.`
"Aydınlatma Metni" bağlantısı bottom sheet açar (salonun §2.7'deki metni; yoksa BeautyOS şablonu salon bilgileriyle).

**R2 — Ticari ileti izni:**
- Ayrı, **isteğe bağlı**, **önceden işaretsiz** onay kutusu. Randevu göndermeyi engellemez.
- Metin: `[Salon Adı]'nın kampanya ve duyurularını SMS ile almak istiyorum. (İsteğe bağlı)`
- Kutu yalnız salon kampanya gönderimini açmışsa gösterilir. Kapalıysa hiç gösterilmez (kullanılmayacak izin toplanmaz). Prototipte iki varyant da çizilir.
- İşaretlenirse kaydın kaynağı: `Online randevu formu`, tarih, metin sürümü (§2.4'te görünür).

**SMS doğrulama metinleri:**
- `Kod gönder` düğmesinin altında, düğmeye basılmadan önce: `Telefon numaranızı doğrulamak için bu numaraya tek kullanımlık bir kod göndereceğiz.`
- Kod alanının altında (mevcut metin uygun, "giriniz" yerine "siz" hitabı korunarak): `Telefonunuza gönderilen 6 haneli kodu girin. Kod 10 dakika geçerlidir.`
- SMS gövdesi önerisi (yalnız bilgilendirme, tanıtım yok): `[Salon Adı] randevu doğrulama kodunuz: 123456. Kod 10 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.`
- "Geliştirme modu — kod: …" kutusu canlıda **asla** görünmez (OTP ifşası; H17). Prototipte de çizilmez.

### 3.2 Diğer randevu sayfası öğeleri

- Sayfada sağlık sorusu ya da serbest "not" alanı **yoktur**. İleride not alanı eklenirse yardım metni: `Sağlık bilgisi yazmayın; salonunuz bunu sizinle ayrıca konuşacaktır.`
- Sayfa altı (footer): `[Salon Adı] · Adres · Telefon` + `Aydınlatma Metni` + küçük `BeautyOS altyapısıyla` (BeautyOS Gizlilik Politikası'na bağlanır).
- Tamamlandı ekranı: randevu özeti + `Randevunuzu değiştirmek ya da iptal etmek için [Salon Adı] ile iletişime geçin: [telefon]`. (İlgili kişinin veri sorumlusuna ulaşabileceği yol.)
- Turnstile kullanıldığı için çerez politikasında (BeautyOS) Cloudflare Turnstile yer alır; ayrı banner gerekmez (bkz. §6).

---

## 4. Süper yönetici paneli (yüzey e)

BeautyOS burada **veri işleyendir**; salonun müşteri verisine yalnız DPA'daki talimat ve destek amacıyla erişebilir.
- Salon listesinde ve detayında yalnız **salon düzeyi** bilgi: ad, plan, durum, kullanıcı sayısı, müşteri **sayısı**, son giriş. Mevcut "son 30 gün ciro toplamı" tek rakam olarak kalabilir (kırılım yok, dışa aktarma yok); Kullanım Şartları'nda BeautyOS'un toplu göstergeleri görebileceği yazılır. Salonun müşteri listesi, telefonları, sağlık bilgileri, fotoğrafları **gösterilmez**.
- Salon hesabına "destek amaçlı giriş" (taklit) özelliği varsa ya da eklenirse: giriş öncesi `Destek nedeni` zorunlu alan; oturum boyunca üstte kırmızı şerit `Destek erişimi · Bu oturum kayıt altına alınıyor`; sağlık bilgisi sekmeleri bu modda kapalı. Salon sahibi Ayarlar'da destek erişimi geçmişini görebilir.
- Yasal kayıtlar sekmesi (yeni): salon bazında Kullanım Şartları/DPA kabul sürümleri ve tarihleri; eski sürümde kalan salonlar listesi.
- Yasal belge sürümü yayınlama (yeni): belge seç → yeni sürüm → yürürlük tarihi → "yeniden kabul iste" anahtarı. (Metnin kendisi avukat onaylı dosyadan gelir.)
- Duyuru/şerit gönderme özelliği veri ihlali bildiriminde de kullanılabilecek biçimde tasarlanmalı (BeautyOS → salon 24 saat hedefi; prosedür DPA'da).

---

## 5. Tanıtım sitesi (yüzey d)

### 5.1 Kaldırılacak ifadeler ve dürüst karşılıkları (brif madde 15; H1, H14, H16)

| Bugünkü ifade (kaynak) | Sorun | Yerine kullanılabilecek | Not |
|---|---|---|---|
| "AWS Avrupa bölgesi" (`landing-faq.tsx:14`, `landing-footer.tsx:137`) | Yanlış: veri DigitalOcean Frankfurt'ta | `Ana veritabanınız Almanya'daki (Frankfurt) sunucularda tutulur.` | Tüm verinin AB'de olduğu söylenmez: e-posta, hata izleme, bot, yapay zekâ gibi alt hizmetler yurt dışında. Yanına `Kullandığımız hizmet sağlayıcılar` bağlantısı (alt işleyen listesi) |
| "Veriler uçtan uca şifreli olarak saklanır" (`landing-trust-band.tsx:7`) | Yanlış; bu mimaride mümkün değil | `Bağlantılarınız TLS ile şifrelenir. Yedekler şifreli olarak saklanır.` | Uygulama düzeyinde alan şifrelemesi (mimar ADR) yapılınca güncellenir |
| "KVKK uyumlu / KVKK uyumludur / KVKK Uyumluluğu" (`landing-hero.tsx:131`, `trust-band:7`, `footer:137`, `faq:14`) | İspatlanamaz; aydınlatma metni bile yok | **Şimdilik hiçbir karşılık kullanılmaz.** Özellikler yapılınca: `KVKK yükümlülüklerinizi kolaylaştıran araçlar: açık rıza kaydı, müşteri silme, veri dışa aktarma.` | "Uyumlu" sıfatı avukat kontrolünden sonra bile kullanılmamalı; araç anlatımı tercih edilir. Araçlar yokken "yakında" ile anlatılır |
| "Türkiye'nin yasal ve teknik standartlarına tam uyumlu" | Kanıtsız mutlak iddia | Kaldırılır, karşılık yok | — |
| "iyzico PCI-DSS" / iyzico logosu | Entegrasyon yok, iş terk edildi | Kaldırılır. Online ödeme anlatılacaksa: `Online ödeme — yakında` | Logo **hiç** kullanılmaz (marka izni de yok) |
| "e-Fatura Entegrasyonu" / logosu | Kodda yok | `e-Fatura — yol haritasında` ya da tamamen kaldırma | Logo yok |
| "Türkiye'nin #1 Salon Platformu" (`login/page.tsx:109`) | İspatlanamaz üstünlük (TTK m.55) | Kaldırılır. Örnek: `Salonunuzun randevu, müşteri ve kasa işleri tek yerde.` | Pazarlama son metni yazar |
| "500+ salon güveniyor" (`login/page.tsx:158`) | Gerçek dışı | Kaldırılır, karşılık yok | Gerçek sayı olursa yalnız doğrulanabilir sayı, tarihli |
| Sabit "42 / 50 kontenjan" sayacı (`landing-pilot.tsx`) | Sahte kıtlık | Gerçek veriden beslenen sayaç ya da sayaçsız: `Kurucu üye programı sınırlı sayıda salonla yürütülür.` | Sayaç varsa veri kaynağı gerçek olmalı |
| "Ömür boyu ₺499" | Koşulsuz bağlayıcı taahhüt | `[FİYAT TAAHHÜDÜ — kurucu kararı]` yer tutucu. Öneri: `İlk 12 ay fiyat kilidi` + `Koşullar` bağlantısı | Koşullar Kullanım Şartları'na yazılmalı |
| "İstediğiniz zaman Excel/CSV olarak dışa aktarabilirsiniz" (`faq:14`) | Özellik yok | `Verilerinizi dışa aktarma — yakında` | §2.6 yapılınca geri gelir |
| "Offline çalışır" | Doğru değil (urun-analisti) | Kaldırılır | — |
| "Hesap kendiliğinden kapanır" (`faq:10`) | Veri akıbeti belirsiz | `Deneme süresi bitince hesabınız durdurulur; verileriniz [SÜRE] gün saklanır, bu sürede dışa aktarabilir ya da aboneliğe geçebilirsiniz.` | Süre kurucu kararı |
| Kullanıcı yorumları / salon logoları (varsa) | Gerçek değilse yanıltıcı | Gerçek, yazılı izinli yorum yoksa bölüm hiç konmaz | Yorum için salondan yazılı izin + kişi adı/fotoğraf için ayrı izin |

**Sosyal kanıt yerine kullanılabilecek dürüst güven öğeleri:** gerçek ürün ekran görüntüleri (brif 14), açık fiyat, "kredi kartı gerekmez" (doğruysa), künye ve iletişim bilgisinin görünür olması, yasal belgelerin gerçekten açılması, "Verileriniz nerede?" sorusuna net cevap.

### 5.2 "Yakında" işaretinin hukuken yeterli biçimi

Amaç: ziyaretçinin, özelliğin **bugün olmadığını** ilk bakışta anlaması.
1. **Metinle yazılır:** `Yakında` ya da `Yol haritasında` rozeti, metin olarak (yalnız renk ya da simgeyle değil). Rozet özellik başlığının **hemen yanında**, aynı satırda; dipnotta, tooltip'te ya da yalnız masaüstünde görünen yerde değil.
2. **Ayrı bölüm tercih edilir:** Mevcut özellikler ve yakında gelecekler aynı kart ızgarasında karışık durmaz. `Yol haritası` başlıklı ayrı ve görsel olarak daha sakin bir bölüm en temizidir. Karışık ızgara kullanılırsa yakında kartları belirgin biçimde ayrışmalı (rozet + soluk ton yeterli; ama kontrast WCAG AA'yı korumalı).
3. **Fiyat paketlerinde yakında özellik "pakete dahil" listesinde yer almaz.** Listede yer alacaksa satır sonunda `(yakında)` yazılır ve paket fiyatının bu özelliğe dayanmadığı açık olur. Öneri: paket listesinde hiç olmasın.
4. **Tarih vaadi yok.** Tarih verilecekse yalnız `2027'nin ilk yarısı için planlanıyor; değişebilir.` biçiminde.
5. **Görsel:** Yakında özellik için gerçek ekran gibi görünen ekran görüntüsü kullanılmaz. Taslak görsel kullanılırsa üzerinde `Tasarım aşamasında` etiketi bulunur.
6. **SSS ve başlıklarda** yakında özellik "var" gibi cevaplanmaz. Hero ve ana başlık yalnız bugün çalışan özelliklerle kurulur.
7. **Entegrasyon logoları** yalnız canlıda çalışan ve marka sahibinin kullanımına izin verdiği entegrasyonlar için kullanılır. Yakında entegrasyon logo ile değil, düz metinle anılır.

### 5.3 Footer künyesi

6563 sayılı Kanun m.3 ve Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik gereği (alan listesi 2026-10-28'de yeniden doğrulanmadı; **teyit edilmeli**). Tüm değerler **yer tutucu**, kurucu doldurur:

- `[TİCARİ UNVAN — şahıs şirketi: Ad Soyad + işletme adı]` ("BeautyOS bir [unvan] markasıdır." biçiminde)
- `[ADRES]`
- `[E-POSTA]` · `[TELEFON]`
- `[VERGİ DAİRESİ] · VKN: [VERGİ KİMLİK NO]` (şahıs için TC kimlik numarası yayımlanmaz; VKN kullanılır, mali müşavirle teyit)
- `MERSİS: [varsa]` · `Sicil no: [ticaret/esnaf sicili, varsa]` · `KEP: [varsa]` · `Meslek odası: [varsa]`

Footer'da kısa satır (`© 2026 [Unvan] · BeautyOS`) + `Künye ve İletişim` bağlantısı; tam bilgiler `/iletisim` sayfasında. Telefon ekranında da footer'dan iki dokunuşta erişilebilir olmalı.

### 5.4 Yasal sayfa listesi

Mevcut footer yolları korunur (eski bağlantılar kırılmasın), eksikler eklenir:

| Sayfa | Yol | İçerik | Kimin için |
|---|---|---|---|
| KVKK Aydınlatma Metni | `/kvkk` | BeautyOS'un **veri sorumlusu** olduğu veriler: salon sahibi/kullanıcı hesabı, site ziyaretçisi, iletişim formu | Salon kullanıcıları, ziyaretçiler |
| Gizlilik Politikası | `/gizlilik` | Genel veri işleme yaklaşımı, güvenlik tedbirleri (doğru olanlar), saklama, haklar, başvuru yolu | Herkes |
| Çerez Politikası | `/cerez` | Bugün yalnız zorunlu depolamalar: oturum belirteci (localStorage), Cloudflare Turnstile (yurt dışı; bkz. §6 istisna maddesi) | Herkes |
| Kullanım Şartları / Abonelik Sözleşmesi | `/sartlar` | Taraflar, ücret, deneme, fesih, veri iadesi ve silme, sorumluluk sınırı, fiyat taahhüdü koşulları | Salonlar |
| Veri İşleme Sözleşmesi (DPA) | `/veri-isleme-sozlesmesi` | BeautyOS'un **veri işleyen** olduğu veriler (salonun müşterileri), talimat, gizlilik, ihlal bildirimi, alt işleyenler, süre sonu | Salonlar |
| Alt İşleyenler | `/veri-isleme-sozlesmesi#alt-isleyenler` (ya da ayrı sayfa) | Sağlayıcı · amaç · ülke · aktarım dayanağı tablosu | Salonlar |
| Künye ve İletişim | `/iletisim` | §5.3 bilgileri + iletişim yolları + KVKK başvuru adresi | Herkes |
| (Sonra) Hizmet Seviyesi (SLA) | `/hizmet-seviyesi` | Erişilebilirlik hedefi, destek saatleri | Salonlar |

**Her yasal sayfanın şablonu (tasarım):** başlık · `Sürüm vX · Yürürlük: GG.AA.YYYY · Son güncelleme: GG.AA.YYYY` · telefonda daraltılabilir içindekiler · okunabilir uzun metin tipografisi (satır uzunluğu ~70 karakter) · alt kısımda `Önceki sürümler` bağlantısı ve `Sorularınız için: [e-posta]`. Gövde prototipte yer tutucu kutusu (§0 kural 9).

**Yayın kuralı:** Bir yasal sayfa, avukat onaylı metin hazır olmadan canlıda boş ya da yer tutucuyla yayınlanmaz. Metin hazır değilse bağlantı gizlenir; **404 bırakılmaz** (H2). Ayrıca aydınlatma yükümlülüğü veri toplanırken doğar: aydınlatma metni yayında olmadan gerçek salonların kaydı açılmamalıdır.

### 5.5 Tanıtım sitesindeki formlar (demo talebi, iletişim, bülten varsa)

- Aydınlatma satırı (kutu yok): `Bilgileriniz yalnız talebinize yanıt vermek için kullanılır. Ayrıntı: KVKK aydınlatma metni.` (pazarlama metniyle aynı)
- Ticari ileti kutusu: **konmaz** (pazarlama kararı, `tanitim-sitesi-icerik.md` §8; kabul edildi, en temiz yol). İleride bülten açılırsa yalnız isteğe bağlı, işaretsiz K3 kutusuyla.
- "Talep gönder" sonrası otomatik tanıtım e-postası gönderilmez (yalnız talep onayı). Talebe verilen yanıt ticari ileti değildir; sonrasında izinsiz kampanya gönderilmez.
- Telefonla dönüş WhatsApp üzerinden yapılacaksa (Meta, yurt dışı) bu aydınlatma metninde belirtilir; formda "WhatsApp ile dönüş" ifadesi kullanılmaz.

---

## 6. Çerezler

**Bugün banner gerekmez.** Kodda analitik ya da reklam betiği yok; yalnız zorunlu depolama var (oturum belirteci `localStorage`'da, randevu sayfasında Cloudflare Turnstile). Zorunlu olanlar için rıza gerekmez, ancak Çerez Politikası'nda listelenir (Kurum'un Çerez Uygulamaları Hakkında Rehberi, 2022; teyit). Footer'da `Çerez Politikası` bağlantısı yeterlidir. **Prototipte banner çizilmez**; aşağıdaki ilkelerle yalnız tasarım sistemine "ileride" bileşeni olarak eklenebilir.

**Üçüncü taraf istek kuralı ve Turnstile istisnası (müdür kararı, 2026-10-28):** Üretimde sayfalar üçüncü taraflara istek göndermez (yazı tipleri sunucudan; CDN ya da analitik yok; `inceleme-hukuk-uyum.md` U7). Tek bilinçli istisna, online randevu sayfasındaki (gerekirse kayıt sayfasındaki) **Cloudflare Turnstile**. Bu hizmet SMS kötüye kullanımına karşı zorunlu bir güvenlik önlemidir (KVKK m.12; hukuki sebep m.5/2-f meşru menfaat, teyit). Yalnız gereken sayfada yüklenir; rıza banner'ı gerekmez. Yasal metinlere şunlar girer:
- **Çerez politikası:** "Zorunlu" kategoride Cloudflare Turnstile. Amaç: bot ve kötüye kullanım koruması. Sağlayıcı: Cloudflare, Inc. (ABD).
- **Salon aydınlatma şablonu ve BeautyOS aydınlatma metni:** "Randevu formunun kötüye kullanılmasını önlemek için Cloudflare'in güvenlik doğrulama hizmeti kullanılır. Bu sırada IP adresiniz ve tarayıcı bilgileriniz yurt dışındaki (ABD) sunucularda işlenebilir."
- **DPA alt işleyen listesi:** Cloudflare · Amaç: ağ güvenliği ve bot koruması (Turnstile, proxy) · Ülke: ABD ve küresel ağ · Aktarım dayanağı: KVKK m.9 standart sözleşme (kurulmadı, avukatla; 2026-10-28 incelemesi H12).

**Analitik, piksel ya da üçüncü taraf gömülü içerik eklendiği gün banner zorunlu olur. Tasarım ilkeleri:**
1. İlk katmanda üç eylem: `Tümünü kabul et` · `Reddet` · `Tercihleri yönet`. **`Kabul et` ve `Reddet` aynı boyut, aynı renk/ağırlık, yan yana.** `Reddet` ikinci katmana gizlenmez.
2. Hiçbir kategori önceden işaretli değildir (zorunlu çerezler hariç; onlar "her zaman açık" olarak gösterilir ve kapatılamaz).
3. Rıza verilmeden analitik betik **yüklenmez** (yalnız gizlemek yetmez).
4. Çerez duvarı yok: siteyi kullanmak çerez kabulüne bağlanmaz. Banner içeriği kapatmaz; telefonda alt kısımda, ekranın en fazla yaklaşık üçte birini kaplar.
5. "Kapat (X)" düğmesi varsa `Reddet` ile aynı anlamı taşır.
6. Footer'da her zaman `Çerez tercihleri` bağlantısı; tercih istenince aynı panel tekrar açılır, geri alma vermek kadar kolaydır.
7. Rıza kaydı tutulur (tercih, tarih, banner metni sürümü).
8. Uygulama içi (giriş yapılmış panel) ile tanıtım sitesi ayrı değerlendirilir; panelde analitik eklenirse aynı kurallar geçerlidir.
9. Önerilen banner metni: `Sitemizin çalışması için zorunlu çerezler kullanırız. İzin verirseniz, siteyi geliştirmek için ziyaret istatistiklerini de toplarız. Ayrıntılar: Çerez Politikası.`

---

## 7. Onay kutusu ve bilgilendirme metinleri — hızlı başvuru

Hepsi **öneri ve taslaktır**; teknik-yazar ses ve üslup için düzeltebilir, anlamı değişirse hukuk-uyum'a sorulur. Köşeli parantezler dinamik alandır.

| Kod | Yer | Tür | Metin |
|---|---|---|---|
| K1 | Kayıt | Zorunlu kutu | `Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni okudum, kabul ediyorum.` |
| K1-hata | Kayıt | Hata | `Devam etmek için Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni kabul etmeniz gerekir.` |
| K2 | Kayıt | Bilgi satırı | `Kişisel verilerinizin nasıl işlendiğini Aydınlatma Metni'nde bulabilirsiniz.` |
| K3 | Kayıt, site formları | İsteğe bağlı kutu | `BeautyOS'un yeni özellik ve kampanya duyurularını e-postayla almak istiyorum. (İsteğe bağlı)` |
| G1 | Yeniden kabul | Başlık | `Kullanım koşullarımız güncellendi` |
| S1 | Sağlık sekmesi kilidi | Başlık + metin | `Sağlık bilgileri için açık rıza gerekiyor` / `Alerji ve sağlık geçmişi gibi bilgileri kaydetmeden önce müşterinizden açık rıza almanız gerekir.` |
| S2 | Müşteri modu | Rıza özeti | `[Salon Adı], size uygun ve güvenli bir uygulama yapabilmek için alerji ve sağlık geçmişinize ilişkin bilgileri kaydetmek istiyor. Bu bilgiler yalnız salon içinde, yetkili personel tarafından görülür. Onay vermeniz zorunlu değildir; onayınızı istediğiniz zaman geri alabilirsiniz.` |
| S3 | Müşteri modu | Düğmeler (eşit) | `Onaylıyorum` · `Onaylamıyorum` |
| S4 | Rıza geri alma | Onay penceresi | `Açık rıza geri alınsın mı?` / `Bu müşterinin kayıtlı tüm sağlık bilgileri (anamnez cevapları ve alerji notu) kalıcı olarak silinecek. Bu işlem geri alınamaz.` |
| S5 | Sağlık sekmesi altı | Bilgi | `Sağlık bilgilerinin görüntülenmesi ve değiştirilmesi kayıt altına alınır.` |
| F1 | Fotoğraf rızası | İsteğe bağlı | `Uygulama öncesi ve sonrası fotoğraflarımın salon kayıtlarımda saklanmasını kabul ediyorum.` |
| F2 | Fotoğraf rızası | İsteğe bağlı, ayrı | `Fotoğraflarımın [Salon Adı]'nın tanıtımlarında (sosyal medya dahil) kullanılmasını kabul ediyorum.` + seçim: `Yüzüm görünmeyecek şekilde` / `Yüzüm görünebilir` |
| T1 | Müşteri detayı | Bilgi | `Randevu hatırlatmaları bu izinden bağımsız olarak gönderilir.` |
| T2 | Müşteri detayı | Bilgi | `İzin, İleti Yönetim Sistemi'ne (İYS) salonunuz adına kaydedilir.` |
| N1 | Müşteri formu, Notlar | Yardım | `Sağlık bilgisi yazmayın; bunun için Sağlık bilgileri bölümünü kullanın.` |
| D1 | Müşteri silme | Onay penceresi | `[Ad Soyad] silinsin mi?` / `Müşterinin kişisel bilgileri, sağlık bilgileri, fotoğrafları ve izinleri kalıcı olarak silinir. Geçmiş ödeme ve fatura kayıtları yasal saklama süresi boyunca isim içermeden tutulur. Gelecekteki randevuları iptal edilir.` |
| D2 | Silme nedeni = KVKK başvurusu | Bilgi | `Başvuruyu 30 gün içinde yanıtlamanız gerekir. Silme tarihi kaydedilir.` |
| E1 | Müşteri dışa aktarma | Açıklama | `Bu müşteriye ait tüm kayıtlar (kişisel bilgiler, randevular, ödemeler, izinler, sağlık bilgileri ve fotoğraflar) tek dosyada indirilir.` |
| A1 | Abonelik sonu | Bilgi | `Aboneliğiniz sona erdiğinde verileriniz [SÜRE] gün saklanır. Bu sürede verilerinizi dışa aktarabilirsiniz. Süre sonunda tüm veriler kalıcı olarak silinir.` |
| R1 | Online randevu | Bilgi satırı | `Kişisel verileriniz, randevunuzu oluşturmak ve size hatırlatma göndermek amacıyla [Salon Adı] tarafından işlenir. Ayrıntılar için Aydınlatma Metni'ni inceleyebilirsiniz.` |
| R2 | Online randevu | İsteğe bağlı kutu | `[Salon Adı]'nın kampanya ve duyurularını SMS ile almak istiyorum. (İsteğe bağlı)` |
| R3 | Online randevu, kod gönder | Bilgi | `Telefon numaranızı doğrulamak için bu numaraya tek kullanımlık bir kod göndereceğiz.` |
| R4 | Doğrulama SMS gövdesi | SMS | `[Salon Adı] randevu doğrulama kodunuz: [KOD]. Kod 10 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.` |
| R5 | Tamamlandı ekranı | Bilgi | `Randevunuzu değiştirmek ya da iptal etmek için [Salon Adı] ile iletişime geçin: [Telefon]` |
| P1 | Şifre sıfırlama | Sonuç | `Bu e-posta adresiyle bir hesap varsa, şifre sıfırlama bağlantısını gönderdik.` |
| B1 | Bot karşılaması | Sabit satır | `Kişisel verileriniz [Salon Adı] tarafından randevu amacıyla işlenir. Mesajlarınız yapay zekâ destekli bir hizmetle yurt dışındaki sunucularda işlenebilir. Ayrıntılar: [bağlantı]` |
| M1 | SMS şablon düzenleme | Uyarı | `Bu mesajlar bilgilendirme amaçlıdır. Kampanya, indirim ya da tanıtım içeriği eklemeyin; bu, ticari ileti izni gerektirir.` |
| Y1 | Yasal sayfa gövdesi (prototip) | Yer tutucu | `[YASAL METİN — avukat onayından sonra eklenecek · Belge: <ad> · Sürüm: v0]` |

---

## 8. Prototip örnek verisi için uyarılar

- Örnek telefon numaraları gerçek bir kişiye ait olmamalı: `0500 000 00 01` gibi açıkça kurgusal numaralar kullanın (0532/0555 gibi gerçek operatör aralıkları rastgele bir kişiye denk gelebilir).
- Örnek müşteri adları kurgusal ve yaygın olmalı; gerçek kişi, ünlü ya da bilinen salon adı kullanılmaz.
- Ekran görüntülerinde gerçek müşteri verisi **asla** yer almaz. Tanıtım sitesindeki ürün ekran görüntüleri (brif 14) yalnız kurgusal veriyle alınır.
- Örnek anamnez/sağlık bilgisi ekranlarında içerik gerçekçi ama kurgusal olmalı ve tanıtım sitesi görsellerinde **hiç** gösterilmemeli.

---

## 9. Kurucu kararları ve açık maddeler

**Karara bağlananlar (brif "Kurucu kararları — 2. tur", 2026-10-28):**
- V1: Deneme/abonelik bitince veri **30 gün** saklanır, sonra silinir. Belgedeki her `[SÜRE]` = **30**. (Klinik için ek ekran öğeleri: §10.6.)
- V2: "Ömür boyu" yok; `İlk 12 ay fiyat sabit` seçeneği var, **varsayılan kapalı**. Açılırsa koşulları Kullanım Şartları'nda yazılı olur.
- V3: Fotoğrafta URL yapıştırma kalkar, dosya yükleme gelir (§2.3 öneriyle aynı).
- V4: Dışa aktarma aracı gelene kadar talep eden salona veri **elle** iletilir. §2.6 ve §2.8'deki ekranlarda, araç yokken eylem `Verilerinizi talep edin` olarak çizilir (talep formu/e-posta → BeautyOS elle iletir; talep tarihi kaydedilir).
- R9: Resepsiyon anamnezi ve fotoğrafı görmez. R4: Uzmana telefon yalnız kendi müşterisinde açık, diğerlerinde maskeli.
- S1: Klinikler de hedefte → §10.

**Hâlâ yer tutucu:** Künye bilgileri (§5.3): unvan, adres, VKN, vergi dairesi, MERSİS/sicil, KEP. Kurucu yayından önce ekler.

**Avukata sorulacaklar:**
1. K1'in (şartlar + DPA) tek kutu olması yeterli mi?
2. Salonda sağlık rızası hizmet şartı yapılabilir mi (§2.2 not)?
3. Yasal metin seti (aydınlatma, gizlilik, çerez, şartlar, DPA, alt işleyen listesi).
4. Künye alan listesi (6563 m.3 ve yönetmelik).
5. Tacir/esnaf alıcılara ticari ileti istisnası.
6. Klinik maddeleri: §10.9.

## 10. Klinikler (kurucu kararı S1: estetik kliniği, diş hekimi ve benzeri)

> **Uyarı:** Bu bölümdeki mevzuat değerlendirmeleri ilk okumadır. Sağlık mevzuatı (Sağlık Bakanlığı yönetmelikleri, meslek kuralları) KVKK'dan daha dağınıktır ve sık değişir. "Teyit" yazan her madde avukatla, tercihen sağlık hukuku bilen biriyle doğrulanmalıdır. Kurucu kararı tartışmaya açılmıyor; aşağıda riskler ve bu riskleri karşılayan ekran öğeleri var.

### 10.1 Klinikte ne değişiyor (özet)

| Konu | Salon (güzellik merkezi, kuaför) | Klinik (estetik kliniği, diş hekimi) |
|---|---|---|
| İşletmenin niteliği | Ticari işletme | **Sağlık hizmeti sunucusu** (ruhsatlı özel sağlık kuruluşu ya da muayenehane), sır saklama yükümlülüğü olan hekim |
| Kişi | Müşteri | **Hasta** (sektör diline göre "danışan" da olabilir) |
| Sağlık verisinin hukuki dayanağı | Pratikte yalnız **açık rıza** | Teşhis, tedavi ve bakım amacıyla **açık rıza gerekmeden** işlenebilir: KVKK m.6/3, 7499 s.K. ile değişik hâli (sır saklama yükümlülüğü altındaki kişilerce). Tedavi dışı amaçlar için (tanıtım, pazarlama, araştırma) yine açık rıza gerekir. **Teyit.** |
| Tıbbi müdahale onayı | Yok | **Bilgilendirilmiş onam** (Hasta Hakları Yönetmeliği). KVKK açık rızasından **ayrı** bir belgedir; onu yerine getirmez, onun yerine de geçmez |
| Kayıt silme | Talep üzerine silinir | Tıbbi kayıtlar yasal saklama süresi boyunca **silinemez** (süre teyit, §10.5) |
| Kayıt düzeltme | Düzenlenebilir | Tıbbi kayıt **üzerine yazılmaz**; düzeltme tarihli ek kayıtla yapılır, eski hâl görünür kalır |
| Reklam ve kampanya | Ticari ileti izniyle serbest | Sağlık hizmetlerinde reklam ve indirim/kampanya duyurusu büyük ölçüde **yasak ya da sınırlı** (özel sağlık kuruluşları mevzuatı, meslek kuralları; teyit) |
| Öncesi/sonrası fotoğraf tanıtımı | Ayrı rızayla serbest | Sağlık reklamı yasağı nedeniyle tanıtımda kullanımı büyük ölçüde **yasak** (teyit) |
| VERBİS | Çoğunlukla eşik altı (teyit) | Ana faaliyeti sağlık verisi işlemek olduğu için büyük olasılıkla **kayıt yükümlüsü** (teyit) |
| Ek mevzuat | KVKK, 6563 | KVKK + Kişisel Sağlık Verileri Hakkında Yönetmelik (RG 21.06.2019; bazı maddeleri hakkında yargı kararı olabilir, teyit), Hasta Hakları Yönetmeliği, Ayakta Teşhis ve Tedavi Yapılan Özel Sağlık Kuruluşları Hakkında Yönetmelik, e-Nabız/USS veri gönderim yükümlülükleri, meslek örgütü (TTB, TDB) kuralları |

### 10.2 Temel risk: BeautyOS'un konumlanması

1. **BeautyOS bir hasta bilgi yönetim sistemi (HBYS) ya da tıbbi kayıt sistemi değildir.** Klinikler e-Nabız/USS'ye veri gönderimi gibi yükümlülükleri kendi sistemleriyle yerine getirir. BeautyOS bu sistemlerin yerine geçiyormuş gibi sunulursa iki risk doğar: (a) klinik yükümlülüğünü yerine getirmediğinde BeautyOS'u sorumlu tutabilir, (b) Sağlık Bakanlığı'nın sağlık bilgi sistemi sağlayıcılarına yönelik kayıt ve uyum şartlarının BeautyOS'a uygulanması gündeme gelebilir (teyit).
2. **Bu yüzden klinik modunda ürün, randevu ve operasyon aracı olarak konumlanır.** "Tıbbi öykü / tedavi notu" alanları sınırlı tutulur ve her yerde `Klinik notu` olarak adlandırılır. "Hasta dosyası", "e-Nabız", "HBYS" ifadeleri ürün ve sitede kullanılmaz (bkz. §10.8). Bu bir ürün kapsamı kararıdır; tasarım bu çizgiye göre yapılır. Kapsam genişletilmek istenirse hukuk-uyum ve avukat yeniden değerlendirir.
3. **Sağlık verisinin hacmi ve hassasiyeti artar.** Bir ihlalin etkisi salona göre çok daha ağır olur (Kurul cezaları, meslek kuralları, itibar). Kurul 2018/10 kararındaki yeterli önlemler (şifreleme, iki adımlı kimlik doğrulama, erişim kaydı, yetki matrisi) klinikte **zorunlu kabul edilir**.

### 10.3 Sektör modu (ekran öğesi)

- Kurulum sihirbazının ilk adımında `İşletme türü` sorulur: `Kuaför / berber`, `Güzellik merkezi`, `Estetik kliniği`, `Diş kliniği / muayenehane`, `Diğer (randevuyla çalışan)`. Seçim sonradan yalnız sahip tarafından ve uyarıyla değiştirilebilir.
- **Terimler (teknik-yazar ile, 2026-10-28):** "Hasta" ve "Hekim" yalnız klinik modunda kullanılır. "Hekim" unvanı rol adından gelir, kullanıcı seçemez. "Danışan" her modda kullanılabilir. Ürünün kendi metinlerinde "Tedavi" yerine "İşlem" ya da "Hizmet" kullanılır, not alanının adı "Klinik notu"dur. "Hasta dosyası", "Tıbbi kayıt", "e-Nabız", "Reçete" ve "Teşhis/Tanı" hiçbir modda kullanılmaz.
- Seçim **dil** dışında **kuralları** da belirler. Klinik türü seçilince §10.4–§10.7'deki öğeler etkinleşir. (Brif S1: "sağlık verisi kuralları en sıkı hâliyle uygulanır.")
- Klinik seçilince sihirbaza bir adım eklenir: `Sağlık kuruluşu bilgileri`. Alanlar: kuruluş adı, ruhsat/tescil numarası, mesul müdür ya da sorumlu hekim adı, meslek odası sicil no (alanlar teyit; isteğe bağlı, "sonra tamamla"). Bu bilgiler aydınlatma metninde ve online randevu sayfasının alt bilgisinde kullanılır.
- Klinik seçiminde tek seferlik bilgilendirme ekranı (onay kutusu değil, `Anladım` düğmesi): `BeautyOS randevu ve klinik operasyonu için bir araçtır. e-Nabız bildirimleri ve yasal tıbbi kayıt yükümlülükleriniz için kullandığınız sistemin yerine geçmez.` Bu ekranın gösterildiği kaydedilir.

### 10.4 Rıza, onam ve aydınlatma: klinikte nasıl değişir

**Sağlık bilgisi kapısı (§2.2) klinikte farklı çalışır:**
- Tedavi amaçlı klinik notu ve sağlık öyküsü için **açık rıza kapısı gösterilmez** (dayanak m.6/3, teyit). Yerine sekmenin başında bilgi satırı: `Bu bilgiler teşhis ve tedavi amacıyla, hekim sır saklama yükümlülüğü kapsamında işlenir.`
- Hastanın **aydınlatıldığı** kaydedilir: `Aydınlatma: Yapıldı · Metin v1 · 12.10.2026 · Kanal: Tablette gösterildi / Basılı verildi`. Aydınlatma yapılmamışsa uyarı şeridi gösterilir (engelleyici değil): `Bu hastaya aydınlatma metni gösterildiği kaydedilmemiş.`
- **Açık rıza yalnız tedavi dışı amaçlar için** istenir. Her amaç ayrıdır, isteğe bağlıdır ve önceden işaretli gelmez: bilgilendirme dışındaki SMS ve e-postalar (§10.7'ye bakın), yapay zekâ destekli mesaj asistanı ile yurt dışı aktarım (§10.7), varsa araştırma ve istatistik.

**Bilgilendirilmiş onam (yeni, yalnız klinik):**
- Hasta detayında `Onamlar` bölümü. Her tıbbi işlem için onam kaydı tutulur: işlem adı, onam formu (yüklenen PDF ya da tablette imza), tarih, hekim, hasta ya da yasal temsilci, sürüm.
- Onam formunun içeriğini BeautyOS yazmaz. Klinik kendi formunu yükler; BeautyOS yalnız kayıt ve imza altyapısı sunar. Ekranda şu not bulunur: `Onam formunun içeriğinden kliniğiniz sorumludur.`
- KVKK açık rızasıyla **aynı ekranda birleştirilmez**. Tablet "müşteri modu" (§2.2) iki ayrı adım gösterir: önce onam, sonra (varsa) KVKK rızaları.
- Reşit olmayan hasta ya da yasal temsilci: onam ve rıza ekranında `Onayı veren: Hasta / Yasal temsilci (ad, yakınlık)` seçimi bulunur (teyit).

**Fotoğraflar (§2.3) klinikte:**
- Tedavi takibi için çekilen fotoğraflar klinik kaydın parçasıdır (F1 rızası yerine tedavi dayanağı, teyit). Erişim yalnız hekimlere açıktır.
- **F2 (tanıtımda kullanım) klinik modunda varsayılan olarak kapalıdır ve gizlenir.** Sağlık reklamı yasağı nedeniyle risk yüksektir. Salon sahibi açmak isterse uyarı gösterilir: `Sağlık hizmetlerinde hasta fotoğraflarının tanıtımda kullanılması mevzuat ve meslek kurallarınızla sınırlı olabilir. Açmadan önce hukuk danışmanınıza danışın.` (Avukat görüşünden sonra tümden kaldırılabilir.)

### 10.5 Saklama ve silme: klinikte nasıl değişir

- **Tıbbi kayıt saklama süresi:** `[SÜRE — avukat/mevzuat teyidi]`. Uygulamada 15–20 yıl gibi uzun süreler ve hekim sorumluluğu davalarına ilişkin zamanaşımları konuşulur. Ekranlarda süre yer tutucu olarak gösterilir.
- **Hasta silme (§2.5) klinikte "silme" değil, "kısıtlama"dır:**
  - Eylemin adı: `Hasta kaydını kapat`.
  - Pencere metni: `Hastanın iletişim bilgileri ve tedavi dışı kayıtları (kampanya izinleri, notlar) silinir. Klinik notları, onamlar ve tedavi kayıtları yasal saklama süresi ([SÜRE]) boyunca kilitli tutulur; bu sürede yalnız sorumlu hekim görüntüleyebilir. Süre sonunda kalıcı olarak silinir.`
  - "KVKK başvurusu" nedeni seçilirse ek not: `Tıbbi kayıtların saklama zorunluluğu varsa silme talebi bu kayıtlar için reddedilebilir; başvuru sahibine gerekçeli yanıt verin.`
- **Klinik notu düzeltme:** Not kaydedildikten sonra düzenleme düğmesi yoktur. Düğme `Düzeltme ekle` olarak adlandırılır ve tarihli, hekim adına bir ek kayıt oluşturur. Notun geçmişi `Düzeltme geçmişi` bağlantısıyla görülür. Silme yalnız saklama süresi dolunca otomatik olur.
- **Abonelik sonu (kurucu kararı V1: 30 gün) klinikte ek öğeler:**
  - Bitiş ekranında daha güçlü uyarı: `Aboneliğiniz sona erdikten 30 gün sonra tüm veriler, klinik notları ve onamlar dahil, BeautyOS'tan kalıcı olarak silinir. Tıbbi kayıtları yasal süre boyunca saklama yükümlülüğü kliniğinize aittir. Verilerinizi bu süre içinde mutlaka indirin ya da talep edin.`
  - Klinik modunda `Hesabı kapat ve verileri sil` akışında dışa aktarma adımı **atlanamaz**. Sahip `Verilerimi indirdim / talep ettim ve saklama sorumluluğunun bende olduğunu biliyorum` kutusunu işaretlemeden silme düğmesi açılmaz.
  - Abonelik bitiminden önce 30., 7. ve 1. günlerde e-posta hatırlatması gider (bilgilendirme iletisi).
  - V4 (elle iletim) klinikte öncelikli işlenir. Talep tarihi ve iletim tarihi kaydedilir.
  - Kullanım Şartları ve DPA'ya şu madde girer: "Tıbbi kayıtların yasal saklama yükümlülüğü veri sorumlusu kliniğe aittir; BeautyOS abonelik bitiminden 30 gün sonra veriyi siler." (Hukuk-uyum taslağına eklenecek.)

### 10.6 Erişim ve kayıt: klinikte nasıl değişir

- **Roller:** Klinikte `Uzman` rolü `Hekim` olarak (ve gerekirse `Sağlık personeli`: hemşire, asistan) adlandırılır. `Resepsiyon` rolü `Sekreter / Resepsiyon` olur ve kurucu kararı R9 burada da geçerlidir: klinik notu, onam, fotoğraf ve sağlık bilgisi görülmez; yalnız randevu ve iletişim bilgisi görülür.
- **Klinik notunu** yalnız hekim yazar. Sağlık personeli ancak sahibin verdiği yetkiyle görür ya da yazar.
- **Müdür** (sağlık meslek mensubu değilse): klinik notunu **görmez**. Salondaki varsayılandan farklı olarak sahip bu yetkiyi müdüre açabilir, ama açarken uyarı gösterilir.
- **Sahip:** Klinik sahibi hekim değilse (ör. şirket ortağı) klinik notlarını görmesi kısıtlanabilmelidir: `Sahip klinik notlarını görür` anahtarı, varsayılan **kapalı** (teyit).
- **Erişim kaydı:** Salonda kayıt tutulur ama ekranda gösterilmez. Klinikte ise hasta detayında `Erişim geçmişi` (yalnız sahip ve sorumlu hekim görür) bulunur: kim, ne zaman, hangi bölümü görüntüledi ya da değiştirdi. Kayıtta değer tutulmaz. Hasta başvurusunda bu liste dışa aktarılabilir (teyit: Kişisel Sağlık Verileri Yönetmeliği kapsamı).
- **İki adımlı doğrulama:** Klinik modunda sağlık bilgisine erişebilen her rol için **zorunlu** (Kurul 2018/10: uzaktan erişimde iki kademeli kimlik doğrulama). Tasarlanacak ekranlar: 2FA kurulumu (doğrulama uygulaması, SMS yedek), girişte kod ekranı, kurtarma kodları, sahibin personel 2FA durumunu gördüğü liste. Salonda ise isteğe bağlı ve önerilen.
- **Oturum:** Klinik modunda hareketsizlikte otomatik kilitleme. Süre [15 dk] yer tutucu. Kilit ekranında hasta adı görünmez.
- **Süper yönetici (§4):** Klinik hesaplarında destek erişimi modunda klinik notu, onam ve fotoğraf **teknik olarak kapalıdır**; salon sahibi açsa bile açılmaz. BeautyOS personeli hekim sır saklama yükümlülüğü altında değildir.

### 10.7 İletişim, online randevu ve bot: klinikte nasıl değişir

- **Bilgilendirme SMS'leri ve e-postaları (doğrulama, onay, hatırlatma) hizmet adı içermez.** Kilit ekranında görünen "İmplant kontrolü" ya da "Botoks" gibi bir ifade sağlık verisini ifşa eder. Önerilen hatırlatma metni: `[Klinik Adı]: 14 Kasım Cuma 14:30 randevunuzu hatırlatırız. Değişiklik için: [telefon]`. Salonda hizmet adı kalabilir. Klinik modunda şablon düzenleme alanında hizmet adı değişkeni sunulmaz.
- **Kampanya / ticari ileti (§2.4) klinik modunda varsayılan olarak kapalı ve gizlidir.** Sağlık hizmetlerinde reklam ve indirim duyurusu kısıtlı olduğu için (teyit) online randevu sayfasındaki R2 kutusu klinikte gösterilmez. Sahip açmak isterse §10.4'tekine benzer bir uyarı gösterilir.
- **Online randevu sayfası (§3) klinikte:**
  - Alt bilgide kuruluş adı, ruhsat/tescil no ve sorumlu hekim (§10.3; teyit) yer alır.
  - Hizmet listesinde fiyat ve indirim gösterimi klinik modunda varsayılan olarak kapalıdır (reklam kuralları, teyit). Sahip açabilir.
  - "Öncesi/sonrası" görselleri ve yorum/puan yoktur.
  - R1 metni: `Kişisel verileriniz, randevunuzu oluşturmak ve size hatırlatma göndermek amacıyla [Klinik Adı] tarafından işlenir. Ayrıntılar için Aydınlatma Metni'ni inceleyebilirsiniz.`
  - Formda şikâyet/sebep alanı **olmaz**. Hizmet seçimi zaten bir sağlık bilgisi ipucudur; bu bilgi minimumda tutulur.
- **Mesaj asistanı (bot) klinik modunda varsayılan olarak kapalıdır.** Hastalar serbest metinde sağlık bilgisi yazar ve bu metin yurt dışına (Telegram, Gemini) gider. Sağlık verisinin yurt dışına aktarımı için KVKK m.9 mekanizması kurulmadan açılmamalıdır. Sahip açarsa hastaya ilk mesajda açık rıza sorulur ve botun her mesajında `Lütfen sağlık bilginizi buraya yazmayın.` satırı bulunur.

### 10.8 Tanıtım sitesi: klinik sayfası (pazarlama için)

- **Kullanılmaz:** "hasta dosyası", "elektronik hasta kaydı", "HBYS", "e-Nabız entegrasyonu/uyumlu", "Sağlık Bakanlığı onaylı", "tıbbi kayıt sistemi", "sağlık verisi için KVKK uyumlu", "hekimler için güvenli".
- **Kullanılabilir:** `Kliniğiniz için randevu ve operasyon yönetimi`, `Hekim bazında takvim`, `Klinik notlarına yalnız yetkili hekimler erişir` (§10.6 canlıdayken), `Sağlık bilgisine erişimde iki adımlı doğrulama` (canlıdayken), `Hatırlatma mesajlarında işlem adı yer almaz` (canlıdayken).
- **Zorunlu sınır cümlesi** (klinik sayfasında, okunur büyüklükte): `BeautyOS randevu ve klinik operasyonu için bir araçtır. e-Nabız bildirimleri ve yasal tıbbi kayıt yükümlülükleriniz için kullandığınız sistemin yerine geçmez.`
- Klinik sayfasında yorum, logo ya da "X klinik kullanıyor" ifadesi yazılı izin olmadan kullanılmaz. Ekran görüntülerinde sağlık bilgisi (klinik notu, onam, tedavi adı) gösterilmez. Takvim görselindeki hizmet adları nötr olmalıdır (ör. "Muayene", "Kontrol").

### 10.9 Avukata sorulacaklar (klinik)

1. Estetik kliniği ve diş hekimi için tedavi amaçlı sağlık verisinin KVKK m.6/3 (7499 s.K. değişikliği) kapsamında açık rıza olmadan işlenebileceği doğru mu? Bu durum muayenehane, poliklinik ve tıp merkezi için aynı mı?
2. Tıbbi kayıtların (klinik notu, onam, tedavi fotoğrafı) asgari saklama süresi nedir? Diş hekimleri ve estetik uygulamaları için özel süre var mı?
3. BeautyOS'un klinik modunda Sağlık Bakanlığı'nın sağlık bilgi sistemi sağlayıcılarına yönelik kayıt, sertifika ya da uyum şartlarına tabi olup olmadığı ve "randevu/operasyon aracı" konumlanmasının bunu dışarıda bırakıp bırakmadığı.
4. Kişisel Sağlık Verileri Hakkında Yönetmelik'in güncel yürürlükteki hükümleri ve veri işleyen olarak BeautyOS'a doğrudan yükümlülük getirip getirmediği (ör. sunucuların yurt içinde olması şartı var mı?). **Kritik:** Ana veritabanı Almanya'da. Sağlık verisi için yurt içinde barındırma şartı çıkarsa klinik hedefi mimari değişiklik gerektirir.
5. Sağlık hizmetlerinde reklam yasağı kapsamında şunlar yasak mı: online randevu sayfasında fiyat gösterimi, kampanya SMS'i, öncesi/sonrası fotoğraflarının hastanın rızasıyla tanıtımda kullanımı?
6. Klinik sahibinin hekim olmadığı durumda klinik notlarına erişimi ve sır saklama yükümlülüğünün kapsamı.
7. BeautyOS personelinin (sır saklama yükümlülüğü olmayan veri işleyen) DPA'ya eklenecek gizlilik taahhüdü ve sağlık verisine özel DPA eki.
8. Hasta silme talebinin saklama yükümlülüğü gerekçesiyle reddi ve bunun yanıt metni.
9. Reşit olmayan hasta ve yasal temsilci için onam ve rıza alma biçimi.
10. Kliniklerin VERBİS kayıt yükümlülüğü (muayenehane dahil).
11. Abonelik sonunda 30 gün içinde silme kararının (V1), kliniğin tıbbi kayıt saklama yükümlülüğü karşısında BeautyOS'a sorumluluk doğurup doğurmadığı ve sözleşmede bu riskin nasıl sınırlandırılacağı.
12. Sağlık verisinin yurt dışı aktarımında (DigitalOcean AB, Backblaze, Sentry, Gemini, Telegram) m.9 standart sözleşmenin yeterli olup olmadığı ve sağlık verisi için ek şart bulunup bulunmadığı.

## Kaynaklar (2026-10-28 itibarıyla; bu belge için yeniden doğrulanmadı)

- 6698 sayılı KVKK (m.4, 5, 6, 7, 9, 10, 11, 12) — mevzuat.gov.tr; 7499 s.K. değişiklikleri, yürürlük 01.06.2024
- Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ (RG 10.03.2018)
- Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (RG 28.10.2017)
- Kurul'un 31.01.2018 tarihli ve 2018/10 sayılı kararı (özel nitelikli veri yeterli önlemler)
- Kurum, Çerez Uygulamaları Hakkında Rehber (2022) — kvkk.gov.tr
- 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun m.3, m.6; Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik; Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik
- 6102 sayılı TTK m.55 (haksız rekabet)
