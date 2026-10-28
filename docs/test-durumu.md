# BeautyOS — Kırmızı testlerin sınıflandırması (denetim-9, ilk önemli madde)

- **Tarih:** 2026-10-28 · **Hazırlayan:** gelistirici · **Taban:** `tasima/docker` @ `71ee311` (kod `master` ile aynı davranışta; yalnız K2-H1 düzeltmesi ve +8 test fark)
- **Ortam:** izole PostgreSQL 17.11 + Redis 7.4 (19 migration), node 20.20.2, `TZ=UTC`, `GEMINI_API_KEY` yok. `tsc --noEmit` temiz.
- **Sonuç:** 161 testten **140 geçti, 21 kaldı**. Kalan 21'in **hiçbiri (c) gerçek hata değil**; hepsi (a) ortam ya da (b) eskimiş test. Kullanıcıyı ya da veriyi etkileyen bir hata çıkmadı.
- Düzeltme yapılmadı, yalnız sınıflandırıldı. Doğrulama: aşağıdaki (b) maddelerinin test tarafı düzeltmeleri geçici bir kopyada denendi (depoya girmedi); bu denemeyle 21 testten 10'u yeşile döndü (admin 1, public-slots 6, reminders 3); kalan 11 aşağıda gerekçeli.

Sınıflar: **(a)** ortam/test altyapısı, **(b)** eskimiş test (kod değişmiş, test güncellenmemiş), **(c)** gerçek hata.

| # | Dosya | Test | Sınıf | Neden / kanıt | Önerilen düzeltme (test tarafı) |
|---|---|---|---|---|---|
| 1 | admin | admin-login normal user ile → 401 | **(b)** | Test `adm-…` slug'lı kiracı kaydediyor; `cleanupTenant` yalnız `tst-`/`test-` önekli kiracıyı silebiliyor ve reddediyor (`afterAll`). Test geçiyor ama kiracı veritabanında **artık olarak kalıyor**. Slug öneki `tst-` yapılınca yeşil (denendi). | Slug'ı `tst-adm-…` yap |
| 2 | auth | Devre dışı kullanıcı → 401 | **(b)** | Beklenen 401, gelen **429**: `loginLimiter` 15 dakikada IP başına **5** istek (sabit, `routes/auth.route.ts`; güvenlik commit'i `cce7091`, 2026-05-11). Dosyada aynı IP'den 5'ten fazla `login` var; `createApp({ rateLimitMax })` yalnız kayıt/genel limiti ayarlıyor, giriş limitini değil. Ürün davranışı doğru. | Giriş limitini de `createApp` seçeneğine bağla ya da testleri ayrı `createApp` örneklerine böl |
| 3 | finance | POST /finance/close-day — returns correct totals for today | **(b)** | Test gider kaydını `expenseDate: new Date('<bugün>T00:00:00+03:00')` ile atıyor; sütun `@db.Date` (UTC günü) → kayıt **önceki gün**e düşüyor (`2026-10-27`). Üretimdeki `POST /expenses` ise `T00:00:00.000Z` kaydeder ve rapor bunu İstanbul gününe doğru eşler. Üretim yolu tutarlı, test verisi yanlış. | Gider tarihini `T00:00:00.000Z` ile oluştur |
| 4 | finance | …returns yesterday summary with explicit date param | **(b)** | Aynı kök neden (gider dünün tarihine düşüyor: beklenen 0, gelen 50). | Aynı |
| 5 | finance | GET /reports/daily with date range — groupBy=day | **(b)** | Aynı kök neden (net 200, beklenen 150). | Aynı |
| 6 | intent | 20 Türkçe mesajda %85+ doğruluk (GERÇEK Gemini API) | **(a)** | Gerçek Gemini çağrısı yapıyor; `GEMINI_API_KEY` olmadan 0/20. Testi kapalı bırakılması gereken bir **dış servis testi**; anahtar/ücret/ağ gerektirir. | Anahtar yoksa `describe.skipIf`; CI'da ayrı, elle tetiklenen iş |
| 7–15 | public-slots (9 test) | /public/services, /public/slots (geçerli, label/available, izinli personel, çakışma, pazar), var olmayan serviceId/staffId | **(b)** (6) + **(b)** (3) | 9'unun hepsi 403 `BOOKING_DISABLED`: online rezervasyon kiracı başına varsayılan **kapalı** (`settings.publicBookingEnabled`, commit `13f53ad`, 2026-05-11); testin kiracısı açmıyor. Açınca 6'sı yeşil (denendi). Kalan 3: (i) `/public/services` yanıtında `price` bekliyor, oysa fiyat bilerek kaldırıldı (`45e7d2e` "booking sayfasında fiyat gösterimini kaldır"); (ii–iii) var olmayan `serviceId`/`staffId` için **404 bekliyor, kod tenant kapsamlı boş liste (200) dönüyor** (`getSlots` bulamazsa `[]`; refactor `445bde6`, 2026-05-04). Boş liste başka kiracı verisi sızdırmaz. | Kiracıyı `publicBookingEnabled: true` ile oluştur; `price` beklentisini kaldır; 404 yerine 200 + boş liste beklentisi (ya da kodu 404'e çevirme kararı mimarın) |
| 16 | reminders | reminder_24h — "Yarın saat" formatında Telegram gönderir | **(b)** | Hatırlatma işi artık **SMS** gönderiyor (`lib/queue.ts` → `sendSms`, commit `bbd71c6`, 2026-05-25); test hâlâ Telegram `sendText` mock'unu bekliyor (0 çağrı). **SMS yolu için test yok** (kapsam boşluğu). | Testi `sendSms` mock'una çevir; mesaj biçimini yeni metinle doğrula |
| 17 | reminders | reminder_2h — "hatırlatmak istedik" formatında Telegram gönderir | **(b)** | Aynı (SMS'e geçiş). | Aynı |
| 18 | reminders | mesaj müşteri telefona gönderilir | **(b)** | Aynı (`mockSendText.mock.calls[0]` boş). | Aynı |
| 19 | reminders | geçmiş tarihli randevu için hiç job eklenmez | **(b)** | Randevu oluşturma **422 `STAFF_NOT_SKILLED`** dönüyor: personel-hizmet ataması zorunlu hale geldi (commit `014f1b6`, 2026-04-21); testte atama yok. Atama eklenince yeşil (denendi). | Test kurulumuna `staffServiceAssignment` ekle |
| 20 | reminders | 72 saat sonrası randevu için 2 job (24h+2h) | **(b)** | Aynı 422 nedeni. | Aynı |
| 21 | reminders | 3 saat sonrası randevu için sadece 2h job | **(b)** | Aynı 422 nedeni. | Aynı |

## Özet

| Sınıf | Adet | Testler |
|---|---|---|
| (a) ortam/altyapı | 1 | intent (gerçek Gemini) |
| (b) eskimiş test | 20 | public-slots 9, reminders 6, finance 3, admin 1, auth 1 |
| (c) gerçek hata | 0 | — |

## Notlar ve riskler

1. **Gizlenen regresyon riski:** 21 kırmızı test, yeni kırmızıyı fark etmeyi zorlaştırıyor. Öncelik: public-slots (9) ve reminders (6) önce yeşile döndürülsün; SMS hatırlatma için yeni test yazılsın (şu an hiç test yok).
2. **Test kalıntısı:** admin testi `adm-…` kiracısını silemediği için her koşuda test veritabanında kiracı artığı bırakır. Gerçek veritabanına karşı çalıştırılmaz (korumalar var) ama CI/yerel veritabanını kirletir.
3. **Giriş hız sınırı:** gerçek davranış 15 dakikada IP başına 5 giriş; salon personeli aynı IP'den (ortak ağ) giriş yaparsa tavan düşük kalabilir. Bu bir test sorunu değil ürün kararı; Cloudflare arkasında gerçek IP (R11/ADR-0010) doğru çalışmazsa tüm kullanıcılar tek IP sayılır.
4. **Slot uç noktası:** bilinmeyen `serviceId`/`staffId` için 404 yerine boş liste dönmesi tutarlılık açısından mimar kararı; güvenlik etkisi yok.
5. **Çalıştırma biçimi:** `npm test` (vitest) boş bir PG17'ye `prisma migrate deploy` yapılmış veritabanı ister (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`); `intent.test.ts` için gerçek `GEMINI_API_KEY`.
