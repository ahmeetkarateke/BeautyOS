# BeautyOS Yeniden Tasarım — hukuk-uyum incelemesi

> **TASLAKTIR, AVUKAT GÖRÜŞÜ DEĞİLDİR.** Bu bir tasarım uyum incelemesidir. Ölçüt `yasal-ekran-gereksinimleri.md` (2026-10-28, §0–§10) ve brif "Kurucu kararları — 2. tur". Mevzuat atıfları o belgedekiyle aynıdır, yeniden doğrulanmadı.

- **Tur 1 · Tarih:** 2026-10-28 · **İnceleyen:** hukuk-uyum
- **İncelenen:** `docs/tasarim.md` §6, §7, §8.1, §12; `docs/tasarim/prototip/panel-ek.js`, `panel.js`, `prototip.js`, `veri.js` (statik okuma; ekranlar `panel.html?sekme=saglik#musteri/m4`, `panel.html?tur=estetik#musteri/m1` ve ayarlar).
- **Kapsam (tasarımcının isteği):** rıza kapısı ve müşteri modu, fotoğraf onayları (F1/F2), ticari ileti izinleri, müşteri silme ve veri indirme, Ayarlar › Gizlilik ve KVKK, abonelik sonu, klinik hasta kartı ve kayıt kapatma.
- **Sonraki tura kalanlar:** online randevu, kayıt (K1–K3), 2FA girişi, süper yönetici, tanıtım sitesi.

## Özet

Salon tarafında temel yapı doğru kurulmuş. Rıza kapısının dört durumu var (yok, var, reddetti, bekliyor). Müşteri modu tam ekran ve kapatılamıyor; Onaylıyorum ve Onaylamıyorum eşit ağırlıkta. Rızayı geri alma iki adımlı. Sağlık verisi takvimde yalnız içeriksiz bir simgeyle görünüyor. Ticari ileti izninde kaynak seçimi var. Silme penceresi önerilen metinle birebir aynı. Yasal metinler yer tutucu.

Asıl açıklar **klinik modunda**:
- Müdür klinik notlarını görüyor.
- Erişim geçmişini sağlık yetkisi olan herkes görüyor.
- Hatırlatma SMS'i, kampanya izni, mesaj asistanı ve abonelik sonu ekranları salon sürümünde kalmış.
- Hasta kaydını kapatırken dışa aktarma zorunlu tutulmuş. Bu, hasta verisinin denetimsiz kopyalarını üretir.

Bir de kurucu kararıyla çelişen bir ayar var: Resepsiyonun sağlık bilgisi erişimi açılabilir durumda (R9).

**Sonuç:** 3 yüksek, 8 orta, 6 düşük bulgu. Yüksekler kapanmadan klinik prototipi kurucuya "hazır" diye sunulmamalı.

## Bulgular

| # | Önem | Ekran | Bulgu | Neden | İstenen değişiklik |
|---|---|---|---|---|---|
| T1 | **Yüksek** | Klinik · rol yetkileri (`prototip.js:36` `saglik: 'SYP'`) | Klinik modunda Müdür (yönetici) klinik notunu, onamları ve sağlık bilgilerini görüyor. Sahip de koşulsuz görüyor | Hekim olmayan kişinin klinik notuna erişimi sır saklama yükümlülüğü ve "ihtiyaç kadar erişim" ilkesiyle çelişir (KVKK m.6, Kurul 2018/10). Gereksinim §10.6 | Klinikte Müdür için `saglik`, `onam`, `knot` ve `erisim` kapalı olsun. Sahip için Ayarlar › Gizlilik ve KVKK'ya **"Sahip klinik notlarını görür"** anahtarı eklensin (varsayılan kapalı; sahip hekimse kurulumda açılabilir). Kullanıcılar tablosu (`ayarlar/kullanicilar`) klinikte bu farkı göstersin |
| T2 | **Yüksek** | Klinik · Bildirimler ayarı (`panel-ek.js:427-428`) | Hatırlatma şablonu ve önizlemesi klinik modunda da hizmet adını içeriyor ("… Kadın saç kesimi randevunuz var") | Kilit ekranında görünen işlem adı sağlık verisini ifşa eder. Gereksinim §10.7 | Klinik modunda şablon ve önizleme: `[Klinik Adı]: Yarın 14:30'da randevunuz var. Değişiklik için [telefon].` Hizmet adı değişkeni klinikte sunulmasın. Salonda mevcut hâl kalabilir |
| T3 | **Yüksek** | Klinik · Hasta kaydını kapat (`panel-ek.js:161-174`) | (a) Kaydı kapatmak için dışa aktarma zorunlu tutulmuş. (b) İletişim bilgileri ve kampanya izinleri silinmiyor, yalnız gizleniyor. (c) "Hastanın talebi" seçilince başvuru notu çıkmıyor. (d) Saklama süresi ve süre sonunda silme yazmıyor | (a) Tek hasta için zorunlu indirme, sağlık verisinin personel cihazlarında denetimsiz kopyalarını üretir (m.12 güvenlik, m.4 ölçülülük). Zorunlu dışa aktarma yalnız **hesabı kapatma / abonelik sonu** için istenmişti (§10.5). (b–d) Gereksinim §10.5 | Dışa aktarma adımını ve "kopyasını aldım" kutusunu kaldırın; bunlar yalnız klinik hesap kapatmada olsun. Pencere metni: `Hastanın iletişim bilgileri ve tedavi dışı kayıtları (kampanya izinleri, notlar) silinir. Klinik notları, onamlar ve sağlık bilgileri yasal saklama süresi ([SÜRE]) boyunca kilitli tutulur; bu sürede yalnız sorumlu hekim görüntüleyebilir. Süre sonunda kalıcı olarak silinir.` Neden "Hastanın talebi (KVKK başvurusu)" olunca: `Tıbbi kayıtların saklama zorunluluğu nedeniyle silme talebi bu kayıtlar için reddedilebilir; başvuruya 30 gün içinde gerekçeli yanıt verin.` Onay kutusu: `Kapatılan kaydın değiştirilemeyeceğini anladım.` |
| T4 | **Orta** | Klinik · Erişim geçmişi sekmesi (`panel-ek.js:74`) | Sekme, sağlık yetkisi olan herkese (hekim, sağlık personeli) açık | Erişim kaydını izlenen kişinin kendisinin görmesi denetim amacını zayıflatır. Gereksinim §10.6: yalnız sahip ve sorumlu hekim | Sekme yalnız sahip (anahtar açıksa) ve sorumlu hekim rolüne görünsün. Gizlilik ayarındaki "Erişim kaydını görüntüle" bağlantısı da aynı kurala uysun |
| T5 | **Orta** | Ayarlar › Gizlilik ve KVKK › Sağlık bilgisi erişimi (`panel-ek.js:434`) | Resepsiyon için açılabilir bir anahtar var | Kurucu kararı R9: resepsiyon anamnezi ve fotoğrafı görmez. Ayar bu kararı delmeye izin veriyor | Resepsiyon satırı kilitli ve kapalı olsun, yanında `Resepsiyon sağlık bilgisi göremez.` yazsın; ya da satır tümden kaldırılsın. Klinikte satırlar: Müdür (kapalı, kilitli ya da uyarılı), Hekim (yalnız kendi hastası), Sağlık personeli, Sahip klinik notları (T1) |
| T6 | **Orta** | Klinik · Müşteri/hasta formu ve kartı (`panel-ek.js:43-46, 85`); Ayarlar › Online randevu (`:425`); Ayarlar › Mesaj asistanı (`:431`) | Klinik modunda kampanya izinleri formda ve kartta görünüyor. "Randevu formunda kampanya izni sor" anahtarı uyarısız. Online randevuda fiyat anahtarı yok. Asistan için klinik uyarısı yok | Sağlık hizmetlerinde reklam ve kampanya kısıtlı; bot serbest metni yurt dışına gidiyor. Gereksinim §10.4, §10.7 | Klinikte kampanya izinleri bölümü gizli olsun (sahip açarsa görünsün). Anahtarlar varsayılan kapalı olsun ve açılırken uyarı penceresi çıksın: `Sağlık hizmetlerinde kampanya ve tanıtım iletileri mevzuat ve meslek kurallarınızla sınırlı olabilir. Açmadan önce hukuk danışmanınıza danışın.` Online randevu ayarına `Fiyatları göster` anahtarı eklensin (klinikte varsayılan kapalı). Asistan klinikte varsayılan kapalı; sabit satıra `Lütfen sağlık bilginizi buraya yazmayın.` eklensin |
| T7 | **Orta** | Klinik · Abonelik ve hesabı kapat (`panel-ek.js:439-440, 446, 461`) | Klinik modunda salon metni kullanılıyor. Hesap kapatmada dışa aktarma atlanabiliyor, saklama sorumluluğu kutusu yok | Kurucu kararı V1 (30 gün) klinikte tıbbi kayıt saklama yükümlülüğüyle çatışır; risk kliniğe açıkça bildirilmeli. Gereksinim §10.5 | Klinikte "Verileriniz" kartı ve `abonelik-bitti` ekranı: `Aboneliğiniz sona erdikten 30 gün sonra tüm veriler, klinik notları ve onamlar dahil, BeautyOS'tan kalıcı olarak silinir. Tıbbi kayıtları yasal süre boyunca saklama yükümlülüğü kliniğinize aittir. Verilerinizi bu süre içinde mutlaka indirin ya da talep edin.` Hesap kapatma: önce dışa aktarma/talep adımı (atlanamaz), sonra zorunlu kutu `Verilerimi indirdim / talep ettim ve saklama sorumluluğunun bende olduğunu biliyorum.`, sonra salon adını yazma |
| T8 | **Orta** | Fotoğraflar (`panel-ek.js:176-201`) | (a) Müşteri modunda F1 ve F2 iki kutu, altında ise genel "Onaylıyorum / Onaylamıyorum" düğmeleri var. F1 işaretlenmeden "Onaylıyorum"a basılırsa ne kaydedildiği belirsiz. (b) "Yüzüm görünmeyecek şekilde" seçeneği F2 işaretli değilken de etkin. (c) Fotoğraf kartında F1/F2 için "Geri al" eylemi yok | Rıza belirli ve açık olmalı; her amaç için karar tek başına kaydedilmeli (m.3, m.5). Geri alma, vermek kadar kolay olmalı (§0 kural 6) | Fotoğraf müşteri modunda kutular yerine iki ayrı soru: her biri için eşit ağırlıkta `Evet` / `Hayır`. F2 ancak F1 = Evet ise sorulsun. Yüz seçeneği F2 = Evet olunca açılsın. Kart şeridine `Saklama onayını geri al` (iki adımlı: `Bu müşterinin tüm fotoğrafları silinecek.`) ve `Tanıtım onayını geri al` (tek adım) eklensin |
| T9 | **Orta** | Klinik · Onamlar (`panel-ek.js:88-90, 160`) | (a) Onam satırında "Kaydeden: Selin Ö." yazıyor (veri.js'e göre resepsiyon). (b) "Yasal temsilci" seçilince ad ve yakınlık alanı açılmıyor. (c) "Form yükle" düğmesinde indirme ikonu var | Bilgilendirilmiş onamı hastayı bilgilendiren hekim alır (Hasta Hakları Yönetmeliği; teyit). Temsilcinin kim olduğu kaydedilmezse onam ispatlanamaz. Gereksinim §10.4 | Onam satırı: `… · Bilgilendiren: Dr. … · Onayı veren: Hasta`. Onam al penceresine `Bilgilendiren hekim` alanı (varsayılan: oturumdaki hekim) eklensin. "Yasal temsilci" seçilince `Ad soyad` ve `Yakınlık` alanları zorunlu olsun. Yükleme ikonu düzeltilsin |
| T10 | **Orta** | Müşteri verisini indir ve Abonelik › dışa aktar (`panel-ek.js:129-132, 439, 461`) | Ekranlarda araç varmış gibi "Dışa aktar · PDF/CSV" görünüyor | Kurucu kararı V4: araç gelene kadar veri elle iletilir. Tasarım §8.1'de "planlandı" deniyor, prototipte henüz yok | Araç yokken eylem adı `Verilerinizi talep edin` olsun. Pencere: `Talebiniz BeautyOS ekibine iletilir; veriler size [DESTEK_E-POSTASI] üzerinden güvenli biçimde gönderilir. Talep tarihi kaydedilir.` PDF/CSV seçimli hâl "Yeni (yasal) · araç geldiğinde" varyantı olarak kalsın |
| T11 | **Orta** | Klinik · Müşteri verisini indir | Klinikte de "Müşteri verisini indir" Sahip ve Müdür'e açık; çıktıda klinik notları ve onamlar da var | T1 ile aynı gerekçe; klinik notu içeren çıktıyı hekim olmayan kişi almamalı | Klinikte yalnız sorumlu hekim ve (anahtar açıksa) sahip. Pencerede `Bu dosya sağlık bilgisi içerir. Yalnız hastaya ya da yetkili mercie verin.` uyarısı. İşlem erişim geçmişine yazılsın |
| T12 | Düşük | Klinik · Sağlık bilgileri bilgi satırı (`panel-ek.js:155`) | "ayrı rıza istenmez" ifadesi personele kesin bir hukuki hüküm gibi gösteriliyor. "Aydınlatma yapılmadı" durumu çizilmemiş | Dayanak (m.6/3) avukat teyidi bekliyor; aydınlatma kaydı yoksa uyarı gerekir (§10.4) | Metin: `Bu bilgiler teşhis ve tedavi amacıyla, hekim sır saklama yükümlülüğü kapsamında işlenir.` İkinci durum: uyarı şeridi `Bu hastaya aydınlatma metni gösterildiği kaydedilmemiş.` + `Aydınlatma yapıldı olarak kaydet` (kanal seçimiyle) |
| T13 | Düşük | Ticari ileti izni (`panel-ek.js:45-46, 134`) | (a) Kaynak seçimi yalnız SMS kutusunda var, e-posta kutusunda yok. (b) Elle eklemede "Online randevu formu" kaynak seçeneği var | (a) Her izin kaynağıyla kaydedilmeli. (b) Bu kaynağı yalnız sistem otomatik yazar; personelin seçmesi kayıtları güvenilmez yapar | E-posta kutusuna da kaynak seçimi. Elle eklemede seçenekler yalnız `Islak imzalı form` ve `Müşterinin SMS ile onayı` olsun |
| T14 | Düşük | İzin kaldırma (`panel-ek.js:135`) | Kaldırdıktan sonra "Geri al" bildirimi izni geri yüklüyor | Müşteri izni geri çektiyse yanlışlıkla geri yükleme izinsiz ileti riski doğurur. Kayıtta kaldırma tarihi tutulmalı | "Geri al" yalnız birkaç saniyelik yanlış dokunma için kalabilir. Kaldırılan izin `İzin yok · Kaldırıldı 28.10.2026` olarak görünsün |
| T15 | Düşük | Rıza kaydı örnek verisi (salon, `panel-ek.js:146`) | "Kaydeden: Selin Ö." resepsiyon; ama R9 gereği resepsiyon sağlık sekmesini göremiyor | Akış tutarsız: resepsiyon rıza başlatabiliyor mu? | Karar: resepsiyon **içeriği görmeden** rıza akışını başlatabilsin (öneri; müşteri kabulde onay verir) ve bunun için müşteri kartında sağlık içeriği göstermeyen bir `Rıza al` düğmesi olsun. Ya da örnek veri bir uzman adıyla değiştirilsin. `urun-analisti` ile netleştirin |
| T15-karar | — | — | **urun-analisti kararı (2026-10-28, `roller-ve-akislar.md` §5.2):** Resepsiyon, içeriği görmeden "Rıza al" akışını başlatabilir. Yalnız içeriksiz durumu görür (Alındı / Bekliyor / Reddetti / Geri alındı). Müşteri modunda form gönderilince ekran formdan çıkar, resepsiyon cevapları görmez. T1 matrise işlendi | Uygun bulundu | Tasarımcı, resepsiyon görünümünde müşteri kartına içeriksiz durum satırını ve "Rıza al" düğmesini eklemeli. Müşteri modundan panele dönüşte sağlık sekmesi açılmamalı |
| T16 | Düşük | Gizlilik › Veri sorumlusu bilgileri (`panel-ek.js:433`) | "Defne Aksoy" yazıyor; sahip "Derya Aksoy", e-posta derya@… | Örnek veri tutarsızlığı (brif: kendi içinde tutarlı) | "Derya Aksoy" olarak düzeltin |
| T17 | Düşük | Ayarlar › Kullanıcılar tablosu (`panel-ek.js:429`) | Müdür (Yönetici) için "Ayarlar: Abonelik hariç" yazıyor; tasarim.md §6'da gizlilik, kullanıcılar ve terimler de hariç. Ayrıca rol adı "Yönetici", "Personel" kullanılmış | Gizlilik ve KVKK ayarı yalnız sahipte olmalı (§2.7). Terim tutarlılığı | `Abonelik, gizlilik, kullanıcılar ve terimler hariç`. Rol adları brifteki gibi (Müdür, Uzman/Hekim) |

## Uygun bulunanlar

- Rıza kapısının dört durumu ve metinleri (S1, S4, S5) gereksinimle birebir. "Reddetti" durumunda "randevu almasına engel değildir" notu doğru.
- Müşteri modu tam ekran, kapatılamıyor; panel gizli; panele dönmek için personel şifresi isteniyor. Onaylıyorum ve Onaylamıyorum eşit ağırlıkta. Rıza metni yer tutucu ve sürümlü.
- Alerji bilgisi sağlık bölümünde. Notlar ve randevu notunda "Sağlık bilgisi yazmayın" uyarısı var. Takvimde ve randevu ayrıntısında yalnız içeriksiz "Sağlık notu var" simgesi var, yetkiye bağlı.
- Ticari ileti: varsayılan izin yok, kaynak seçimi, "sözlü onay kabul edilmez" notu, İYS "Yakında", hatırlatmalardan bağımsızlık notu.
- Müşteri silme (D1, D2) metni, silme nedeni ve "Yeni (yasal)" işareti doğru. Geri al yok.
- Bildirim şablonunda "tanıtım içeriği eklemeyin" uyarısı (M1). Bot karşılama mesajındaki sabit satır (B1).
- Gizlilik ve KVKK ayar bölümü kapsamlı: rıza metin sürümleri, kabul edilen sözleşmeler, VERBİS notu.
- Abonelik (salon): 30 gün metni (V1), fiyat yer tutucusu, hesabı kapatırken salon adını yazma.
- Yeniden kabul ekranı (G1 ve K1 metni, hata metni, "Hesap ayarlarına git").
- Klinik: rıza kapısı yerine bilgi satırı ve aydınlatma kaydı; Onamlar KVKK rızasından ayrı ve "Hasta / Yasal temsilci" seçimi var; klinik notu düzenlenemez, düzeltme geçmişi görünür; erişim geçmişinde değer tutulmuyor; klinikte fotoğraf sekmesi gizli (temkinli ve kabul edilebilir); "HBYS değildir" notu; kasada TC kimlik ve sigorta alanı yok.

## Notlar (bulgu değil)

- Klinikte tedavi takibi için fotoğraf ihtiyacı ileride doğabilir. O zaman fotoğraflar F1 rızasıyla değil, klinik kayıt dayanağıyla, yalnız hekime açık ve tanıtım seçeneği olmadan eklenmeli (§10.4).
- Müşteri kartındaki "WhatsApp" düğmesi, numarayı personelin kendi WhatsApp'ına taşır. Bu salonun tercihidir. Aydınlatma şablonunda WhatsApp ile iletişim (Meta, yurt dışı) yer almalı; bunu yasal metin taslağına not ettim.

---

# Tur 2 — 2026-10-28

- **İncelenen:** `docs/tasarim/bulgu-yanitlari.md` (T1–T17 yanıtları); `randevu-al.html`, `giris.html`, `yonetici.html`, `tanitim.html` ve tur 1 düzeltmeleri (`panel-ek.js`, yer yer). Kodu okuyarak, statik inceleme.

## Tur 1 yanıtlarının kontrolü

T1–T17'nin hepsi "Uygulandı" olarak işaretli. Örnek olarak kontrol ettiklerim:
- **T3 (`panel-ek.js:167-171`):** Doğru uygulanmış. Zorunlu dışa aktarma kalkmış. Silinen ve kilitlenen veri yazılı. KVKK notu ve kabul kutusu var.
- **T10/T11:** "Verileri talep et" diliyle uygulanmış.

**T14 kısmi kalmış:** "Kaldırıldı [tarih]" gösterimi yalnız belgede var. Prototipte çizilmesi gerekmiyor, ama kodlamada uygulanmalı. **Kabul.**

**B5 (klinik görüntüleri):** Klinikte F1 rızasıyla yükleme yapılması, gerekenden fazla koruyucu ama zararsız. F2'nin varsayılan kapalı olması ve yalnız hekime açık olması uygun. **Kabul**; kurucu kararı bekleniyor.

**Tur 1 kapandı**, kalan küçük not U12'de.

## Tur 2 bulguları

| # | Önem | Ekran | Bulgu | Neden | İstenen değişiklik |
|---|---|---|---|---|---|
| U1 | **Orta** | Klinik kurulum › Güvenlik (`giris.html:70`) | "Kurduktan sonra devam et" bağlantısıyla iki adımlı doğrulama (2FA) kurulmadan geçilebiliyor | Klinikte 2FA zorunlu (Kurul 2018/10; gereksinim §10.6). Atlanabilirse zorunluluk kâğıt üstünde kalır | Atlama kalsın, ama: (a) bağlantı metni `Sonra kur`. (b) 2FA kurulana kadar o kullanıcının sağlık bilgisi, onam, klinik notu ve görüntülere erişimi kapalı. Panelde kalıcı şerit: `İki adımlı doğrulama kurulmadan sağlık bilgilerine erişemezsiniz. Şimdi kurun.` (c) Davetle gelen hekim ve sağlık personeli de ilk girişte aynı adımı görür |
| U2 | Düşük | 2FA girişi (`giris.html:47`) | "Bu cihazı 30 gün hatırla" klinikte de var | Ortak resepsiyon tableti ya da klinik bilgisayarında 30 günlük muafiyet, iki adımlı doğrulamanın amacını boşa çıkarır | Klinikte bu seçenek ya kaldırılsın ya da süresi kısaltılsın (öneri: 12 saat, mimar karar verir). Seçeneğin altında: `Ortak kullanılan cihazlarda işaretlemeyin.` |
| U3 | **Orta** | Süper yönetici › Yasal belgeler › Yeni sürüm yayınla (`yonetici.html:39, 52`) | (a) "Yeniden kabul iste" anahtarı dört belgede de varsayılan açık; aydınlatma metni ve gizlilik politikası buna dahil. (b) Değişiklik özeti alanı yok. (c) Hangi dosyanın yayınlandığı ve avukat onayı kaydı yok | (a) Aydınlatma bir **bilgilendirme**dir, kabul edilmez (§0 kural 1). Kabul istenirse rızaymış gibi görünür. (b) Yeniden kabul ekranı (G1) değişiklik özetini gösteriyor; kaynağı burası olmalı. (c) Hangi metnin yürürlükte olduğu ispatlanabilmeli | (a) Aydınlatma ve gizlilik için anahtar yerine `Kullanıcılara bildir (e-posta + panel şeridi)` seçeneği. Yeniden kabul yalnız Kullanım Şartları ve DPA'da, o da varsayılan açık. (b) `Değişiklik özeti` alanı (2–4 madde, zorunlu). (c) `Belge dosyası` ve `Avukat onayı: tarih / ad` alanları. Yayınla düğmesi bunlar dolmadan pasif |
| U4 | **Orta** | Süper yönetici › Salon › Pasif yap (`yonetici.html:51`) | Metin "30 gün sonra silme süreci başlar" diyor. Sahibe bildirim ve klinik farkı yok | Silme sürecini BeautyOS başlatıyor. Veri sorumlusu (salon/klinik) önceden ve kanıtlanabilir biçimde bilgilendirilmeli; klinikte tıbbi kayıt riski var (§10.5, V1, V4) | Pencereye ekleyin: `Salon sahibine e-postayla bildirilir; 30 gün içinde verilerini talep edebilir.` Klinik hesaplarda ek satır: `Bu bir klinik hesabıdır. Silmeden önce sahibin veri talebi yanıtlanmış olmalı.` Salon ayrıntısında `Silinmeye kalan gün` ve `Veri talebi: Yok / Alındı [tarih] / İletildi [tarih]` gösterilsin |
| U5 | **Orta** | Online randevu › Değiştir/iptal (`randevu-al.html:84, 87-88`) | `#degistir` sayfasına nasıl ve kimin girebildiği çizilmemiş. Geçersiz ya da süresi dolmuş bağlantı durumu yok | Bağlantıyı ele geçiren herkes randevuyu görür ve iptal eder. Klinikte işlem adı da görünür, bu sağlık verisi demek (m.12) | Sayfa yalnız tahmin edilemeyen, süreli bir bağlantıyla (SMS ya da onay ekranı) ya da telefon kodu doğrulamasıyla açılır (backend notu, mimar). Çizilecek durumlar: `Bu bağlantı geçersiz ya da süresi dolmuş. Randevunuz için [Salon] ile iletişime geçin.` ve `Randevunuzu görmek için telefonunuza gelen kodu girin.` Klinikte bu sayfada işlem adı yerine `Randevu` yazılabilir (öneri) |
| U6 | **Orta** | Tanıtım › SSS "Mevcut müşteri listemi aktarabilir miyim?" (`tanitim.html:165`) | "Bize gönderin" deniyor ama nasıl gönderileceği yazmıyor | Müşteri listesi kişisel veri; sağlık verisi de içerebilir. E-posta ekiyle gelirse kontrolsüz kopya oluşur. BeautyOS bu işte veri işleyendir (DPA) | Cevap: `Evet. Listenizi e-postayla göndermeyin; size güvenli bir yükleme bağlantısı iletelim, aktarıma ücretsiz yardım edelim. Listede sağlık bilgisi varsa önceden belirtin.` Aynı kural `musteri-destek` sürecine de yazılmalı (müdüre not) |
| U7 | **Orta (üretim)** | Tüm sayfalar (`giris.html:10` ve diğerleri) | Yazı tipleri `fonts.googleapis.com` üzerinden yükleniyor | Her ziyaretçinin IP adresi Google'a (yurt dışı) gider. Bu, aydınlatma metninde ve çerez politikasında yer almayan bir aktarım olur | Prototipte sorun değil. Üretimde yazı tipleri sunucudan servis edilmeli (ör. `next/font` ile yerel). `frontend-gelistirici` için kabul ölçütü: üçüncü taraf yazı tipi, CDN ya da analitik isteği yok. **İstisna (2026-10-28 kararı):** Online randevu sayfasındaki Cloudflare Turnstile kalır. Kötüye kullanımı önleyen zorunlu bir güvenlik hizmetidir (m.12; hukuki sebep m.5/2-f, teyit). Cloudflare zaten alt işleyendir. Şartlar: Turnstile çerez politikasında "zorunlu" kategoride, alt işleyen listesinde ve salon aydınlatma şablonunda yer alır; yalnız gereken sayfalarda yüklenir. Ayrıca rıza bannerı gerekmez |
| U8 | Düşük | Tanıtım › SSS "Verilerim nerede tutuluyor?" (`tanitim.html:159`) | Hizmet sağlayıcı cümlesi eksik | Yalnız Almanya denince tüm verinin orada olduğu izlenimi doğar (`pazarlama`'ya verilen 1. madde) | Sona ekleyin: `E-posta gönderimi ve hata izleme gibi işler için çalıştığımız hizmet sağlayıcıların listesi Veri İşleme Sözleşmesi'nde yer alır.` (bağlantılı) |
| U9 | Düşük | Tanıtım › İletişim formu (`tanitim.html:143`) | Telefon zorunlu görünüyor, e-posta isteğe bağlı | Veri en aza indirme: ikisinden biri yeterli (`pazarlama`'ya verilen 5. madde) | `Telefon ya da e-postadan birini yazın.` Biri dolunca öteki isteğe bağlı |
| U10 | Düşük | Tanıtım › Künye ve yasal şablon (`tanitim.html:141, 154`) | Künyede telefon ve "varsa" alanları (MERSİS, sicil, KEP) yok. DPA sayfası şablonunda alt işleyen tablosu yok | §5.3, §5.4 | Künyeye `[TELEFON]` ve `[MERSİS / Sicil no / KEP — varsa]` ekleyin. DPA şablonunun sonuna `Alt işleyenler` tablosu yer tutucusu: Sağlayıcı · Amaç · Ülke · Aktarım dayanağı |
| U11 | Düşük | Kayıt adım 2 (`giris.html:53`) | Telefon alanı zorunlu görünüyor; eski formda isteğe bağlıydı | Veri en aza indirme; bu alana gerçekten ihtiyaç var mı? | Gerekmiyorsa `(isteğe bağlı)` yazın. Gerekiyorsa (ör. SMS ile hesap kurtarma) amacını yardım metninde söyleyin |
| U12 | Düşük | Klinik › Kaydını kapat (`panel-ek.js:168`) | Saklama süresi yer tutucusu ve "yalnız sorumlu hekim görüntüler" ifadesi yok | §10.5 | İkinci maddeye: `… yasal saklama süresi ([SÜRE]) boyunca kilitli tutulur; bu sürede yalnız sorumlu hekim görüntüleyebilir.` |

## Tur 2 — uygun bulunanlar

- **Online randevu:** R1 aydınlatma satırı kod gönderilmeden önce gösteriliyor ve alttan açılan bir sayfada yer tutucu metin var. R2 yalnız `?kampanya=1` ile görünüyor, isteğe bağlı ve işaretsiz; klinikte hiç çıkmıyor. R3 ve kod metinleri doğru. "Geliştirme modu" kutusu yok. Şikâyet ve sağlık alanı yok. Klinikte fiyat gizli. Alt bilgide ruhsat no ve sorumlu hekim var. R5 ve 2 saat kuralı (M1) doğru. "BeautyOS altyapısıyla" bağlantısı BeautyOS gizlilik politikasına gidiyor.
- **Kayıt:** K1 tek kutu ve iki ayrı belge bağlantısı. K3 isteğe bağlı. K2 kutusuz. K1 hata metni alanın altında. Belgeler alttan açılan sayfada, içinde "Kabul ediyorum" düğmesi yok.
- **Diğer giriş ekranları:**
  - Şifre sıfırlama P1 metni, hesabın var olup olmadığını belli etmiyor.
  - Davet ekranında Kullanım Şartları ve Gizlilik bağlantıları var, kabul kutusu yok (doğru).
  - Kurtarma kodları ekranı doğru; kilit ekranında hasta adı yok.
  - Klinik kurulumda HBYS bilgi ekranı ve sağlık kuruluşu bilgileri adımı var.
- **Süper yönetici:** Destek erişimi neden yazılmadan açılmıyor. Kırmızı şerit ("Bu oturum kayıt altına alınıyor") ve "Erişimi kapat" var. Sağlık sekmeleri bu modda kapalı. Müşteri verisi gösterilmediği ve cironun yalnız toplam göründüğü yazılı. Yasal kayıtlarda kabul sürümleri görünüyor.
- **Tanıtım sitesi:**
  - Yasak ifadelerin hiçbiri yok: AWS, uçtan uca, KVKK uyumlu, #1, 500+, PCI, ömür boyu.
  - e-Fatura sınır cümlesi var. Klinik sınır cümlesi e-Nabız ve kayıt yükümlülüğünü içeriyor.
  - Klinik örnek verisi nötr ("İlk görüşme", "Kontrol", "Bakım seansı", "Dr. Elif Ş."); "Örnek klinik, kurgusal veri" etiketi var.
  - Footer'da DPA bağlantısı ve künye yer tutucuları var, © satırında [TİCARİ UNVAN] yazıyor.
  - Yasal sayfa şablonunda sürüm, yürürlük, içindekiler, Y1 yer tutucusu ve "Önceki sürümler" var.
  - Demo formunda kampanya kutusu yok, aydınlatma satırı var. Çerez banner'ı çizilmemiş (doğru).
  - Deneme cevabı V1 ve V4 ile uyumlu.

## Sonuç (tur 2)

Yüksek bulgu yok. Orta bulgular (U1, U3–U7) prototipte kolay düzeltilir; U5 ve U7 kodlama aşamasında kabul ölçütü olarak da taşınmalı. Bunlar kapanınca yasal ekranlar açısından prototip **kurucuya sunulabilir**. Yasal metinlerin gövdeleri ise avukat onayına kadar yer tutucu kalır.
