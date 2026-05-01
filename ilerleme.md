# BeautyOS — Proje İlerleme Takibi

> Bu dosya tüm agent'ların ortak ilerleme kaydıdır.
> Her agent yalnızca kendi bölümünü günceller.

---

## Backend İlerlemesi

**Son güncelleme:** 22.04.2026

### Altyapı

| Bileşen | Durum | Notlar |
|---|---|---|
| Express + TypeScript kurulum | ✅ Tamamlandı | `apps/api/` |
| Prisma 5 + PostgreSQL (Supabase) | ✅ Tamamlandı | `DATABASE_URL` + `DIRECT_URL` Railway env'de |
| JWT kimlik doğrulama middleware | ✅ Tamamlandı | `auth.middleware.ts` — `authenticateJWT` + `requireTenantAccess` |
| Bcryptjs şifre hashing | ✅ Tamamlandı | Native `bcrypt` yerine pure-JS `bcryptjs` (Railway Docker uyumlu) |
| CORS middleware | ✅ Tamamlandı | `ALLOWED_ORIGINS` env var ile kontrol |
| Global error handler | ✅ Tamamlandı | Tüm async route'larda try/catch + next(err) |
| Startup DB health check | ✅ Tamamlandı | `SELECT 1` — başarısızsa process.exit(1) |
| Sentry entegrasyonu | ✅ Tamamlandı | `SENTRY_DSN` env ile aktif |
| Rate limiting | ✅ Tamamlandı | `express-rate-limit` — auth endpoint'leri 10 req/15min |
| Railway deployment | ✅ Canlı | `beautyosapi-production.up.railway.app` |

### API Endpoint'leri

#### Auth
| Endpoint | Durum | Notlar |
|---|---|---|
| `POST /api/v1/auth/login` | ✅ Tamamlandı | JWT 7 gün, bcryptjs verify, rate limited |

#### Tenant — Dashboard & Genel
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/dashboard` | ✅ Tamamlandı | `?period=today\|week\|month` — TR timezone aware; changePercent önceki aynı dönemle |
| `GET /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | Salon adı + settings JSON |
| `PATCH /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | owner/manager yetkisi, settings JSON merge |

#### Randevular
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | ?date + ?limit filtresi |
| `POST /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | endAt otomatik, referenceCode, slot çakışma kontrolü (409) |
| `PATCH /api/v1/tenants/:slug/appointments/:id/status` | ✅ Tamamlandı | 6 durum enum, iptal nedeni opsiyonel |
| `PATCH /api/v1/tenants/:slug/appointments/:id/reschedule` | ✅ Tamamlandı | owner/manager only; endAt yeniden hesaplanır; slot çakışma (409); BullMQ reminder yeniden planlanır |

#### Müşteriler
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/customers` | ✅ Tamamlandı | Sıralı liste |
| `GET /api/v1/tenants/:slug/customers/:id` | ✅ Tamamlandı | Detay + son 20 randevu geçmişi |
| `POST /api/v1/tenants/:slug/customers` | ✅ Tamamlandı | 409 duplicate phone (P2002) |
| `PATCH /api/v1/tenants/:slug/customers/:id` | ✅ Tamamlandı | fullName, phone, email, birthDate, allergyNotes, preferenceNotes |

#### Hizmetler
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/services` | ✅ Tamamlandı | Aktif hizmetler listesi |
| `POST /api/v1/tenants/:slug/services` | ✅ Tamamlandı | owner/manager yetkisi |
| `PATCH /api/v1/tenants/:slug/services/:id` | ✅ Tamamlandı | owner/manager yetkisi |
| `DELETE /api/v1/tenants/:slug/services/:id` | ✅ Tamamlandı | Soft delete (isActive=false) |

#### Personel
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/staff` | ✅ Tamamlandı | id, title, fullName, colorCode |
| `POST /api/v1/tenants/:slug/staff` | ✅ Tamamlandı | User + StaffProfile transaction, duplicate email → 409 |
| `PATCH /api/v1/tenants/:slug/staff/:id` | ✅ Tamamlandı | title, bio, colorCode, workingHours |
| `DELETE /api/v1/tenants/:slug/staff/:id` | ✅ Tamamlandı | Soft delete (user.isActive=false) |

#### Kullanıcı
| Endpoint | Durum | Notlar |
|---|---|---|
| `PATCH /api/v1/tenants/:slug/users/:id/password` | ✅ Tamamlandı | self veya owner yetkisi |

### Test Altyapısı

**Son güncelleme:** 21.04.2026 — Görev 2 tamamlandı (42/42 green)

| Dosya | Test Sayısı | Durum |
|---|---|---|
| `src/__tests__/auth.test.ts` | 7 | ✅ Green |
| `src/__tests__/appointments.test.ts` | 9 | ✅ Green |
| `src/__tests__/customers.test.ts` | 9 | ✅ Green |
| `src/__tests__/services.test.ts` | 9 | ✅ Green |
| `src/__tests__/reminders.test.ts` | 8 | ✅ Green |
| **Toplam** | **42** | **✅ 42/42 passed** |

**Altyapı:**
- `vitest.config.ts` oluşturuldu — `globals: true`, `environment: node`, 30s timeout
- `src/app.ts` — Express app factory (`createApp(options?)`) index.ts'den ayrıştırıldı; testlerde import edilebilir
- `src/__tests__/helpers/dotenv.ts` — dotenv setup file (vitest setupFiles)
- `src/__tests__/helpers/setup.ts` — tenant, user, staff, service, customer oluşturma + `cleanupTenant()` yardımcıları
- Her describe bloğu kendi tenant'ını oluşturur ve `afterAll` ile temizler
- Rate limit testi için ayrı `createApp({ rateLimitMax: 10 })` instance kullanıldı
- Gerçek Supabase DB üzerinde çalışıyor — mock yok

**BullMQ Hatırlatma Sistemi:**
- `src/lib/queue.ts` — `remindersQueue` (BullMQ Queue) + `processReminderJob()` + `startReminderWorker()`
- Queue adı: `reminders`, Redis bağlantısı: `REDIS_URL` env (Upstash TLS destekli)
- Job tipleri: `reminder_24h` → "Yarın saat X'de..." / `reminder_2h` → "X'deki ... hatırlatmak istedik"
- Hata toleransı: attempts:3, exponential backoff 5s; geçersiz appointmentId → log + skip (worker çökmez)
- `POST /appointments` — randevu sonrası 2 job eklenir (delay negatifse atlanır), fire-and-forget
- Job ID: `reminder-24h-{appointmentId}` — tekrar oluşturmada replace destekli
- Worker: `src/index.ts`'de başlatılır, `app.ts`'de değil (testlerde worker açılmaz)
- Telegram kanalı değişse sadece channel katmanı güncellenir, worker kodu değişmez

**`npm run test` → 42 passed, ~25s**

### 22.04.2026 Güncellemeleri

**Finance Modülü ✅**
- `PATCH /appointments/:id/status` → `completed` geçişinde otomatik Transaction oluşturma (gross, commission, cash/card split)
- `GET /reports/daily` → transaction detayı (müşteri, hizmet, kategori, saat, tutar, ödeme), gider listesi (id dahil), netRevenue
- `GET /reports/staff-commissions` → staff bazlı tamamlanan işlem, ciro, komisyon
- `POST /expenses` + `DELETE /expenses/:id` → owner only
- `POST /revenues` → walk-in manuel gelir (appointmentId nullable Transaction)
- Transaction tablosuna `notes String?` eklendi, `appointmentId` + `staffId` nullable yapıldı (migration)

**Follow-up Schedule & Otomatik Kontrol Randevuları ✅ (24.04.2026)**
- Prisma migration: `20260424180753_add_service_follow_up_schedule` — `Service` modeline `followUpSchedule Json?` eklendi
- Format: `[{ day: 15, label: "15. gün kontrol" }, ...]` — max 10 giriş, 1–365 gün
- `POST /services` + `PATCH /services/:id` → Zod schema'ya `followUpSchedule` eklendi; `null` ile temizleme (`Prisma.DbNull`) destekleniyor
- `GET /services` → her hizmette `followUpSchedule` alanı dönüyor
- `PATCH /appointments/:id/status` → `completed` geçişinde `tenant.settings.followUpEnabled === true` ise her `followUpSchedule` entry'si için otomatik `pending` randevu oluşturuluyor (`bookingChannel: manual`, çakışma kontrolü yapılmıyor)
- Her takip randevusu için Telegram bildirimi fire-and-forget gönderiliyor: "{serviceName} işleminiz tamamlandı! {label} kontrolünüz ({tarih}) takvime eklendi."
- Response'a `followUpAppointments: [{id, startAt, label}]` eklendi (yalnızca oluşturulduğunda)

**Sektör & Follow-up Ayarları ✅ (24.04.2026)**
- `PATCH /settings` Zod schema'ya iki yeni opsiyonel alan eklendi:
  - `businessType`: `'barbershop' | 'beauty_center' | 'nail_studio' | 'aesthetic' | 'other'`
  - `followUpEnabled`: `boolean`
- Migration gerekmedi — her ikisi de `Tenant.settings` JSON blob'una yazılıyor
- `GET /settings` response'unda `settings` nesnesi içinden otomatik dönüyor

**Onboarding Flag ✅ (23.04.2026)**
- Prisma migration: `20260423030854_add_onboarding_completed` — `Tenant` tablosuna `onboardingCompleted Boolean @default(false)` eklendi
- `GET /settings` → response'a `onboardingCompleted` dahil edildi
- `PATCH /settings` → `{ onboardingCompleted: true }` kabul ediyor; doğrudan Tenant kolonuna yazıyor (JSON settings blob'una değil)

**Finance Modülü Genişletmeleri ✅ (22.04.2026)**
- `GET /tenants/:slug/dashboard?period=today|week|month` → period parametresi eklendi; week=Pazartesi–Pazar, month=1–son gün; changePercent önceki eşdeğer dönemle; tüm hesaplar Europe/Istanbul (UTC+3) timezone'da
- `POST /tenants/:slug/finance/close-day?date=YYYY-MM-DD` → kasa kapatma endpoint'i: date opsiyonel (default bugün TR tz); totalRevenue, cashRevenue, cardRevenue, totalExpenses, netProfit, transactionCount + transactions[], expenses[], staffCommissions[] döner
- `GET /tenants/:slug/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD[&groupBy=day]` → tarih aralığı desteği; legacy ?date hâlâ çalışır; groupBy=day eklenince günlük breakdown array'i döner (grafik için); from > to → 400
- Tüm tarih sınırları `T00:00:00+03:00` / `T23:59:59.999+03:00` formatıyla Istanbul timezone'a göre hesaplanıyor
- 16 yeni vitest case eklendi → `src/__tests__/finance.test.ts`

**Personel Skill & İzin Sistemi ✅**
- `StaffServiceAssignment` modeli eklendi: staff-service many-to-many, commissionType (percentage/fixed), commissionValue, priceOverride
- `StaffLeave` modeli eklendi: tarih bazlı izin takibi (day_off/sick_leave/vacation/other)
- Migration: `20260421203219_staff_skills_and_leaves`
- `GET /staff/:staffId/services` + `POST` + `DELETE` — skill CRUD (owner only)
- `GET /staff/:staffId/leaves` + `POST` + `DELETE` — izin CRUD (owner only)
- `GET /staff` → `skills[]` array eklendi (email, workingHours da dahil)
- `POST /appointments` → skill kontrolü eklendi (STAFF_NOT_SKILLED 422), priceOverride desteği

**Randevu Status Koruması ✅**
- `PATCH /appointments/:id/status` → terminal status (completed/cancelled/no_show) geçişi engellendi (STATUS_LOCKED 409)

**Nightly No-Show Job ✅**
- BullMQ repeatable job: her gece UTC 20:30 (TR 23:30) çalışır
- Bugünün `pending/confirmed/in_progress` + `endAt < now` randevuları → `no_show`
- Müşteriye Telegram mesajı: "Randevunuza gelemediniz, yeniden randevu almak ister misiniz?"
- tenant.telegramBotToken öncelikli, yoksa global env fallback
- Hata toleransı: her randevu isolated try/catch

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| Randevu formunda hizmet → personel filtreleme (Agent 01) | Yüksek |
| ✅ Bot: skill + mesai + izin farkındalığı (Agent 03) | Tamamlandı |
| ✅ `DELETE /appointments/:id` + `PATCH notes` (01.05.2026) | Tamamlandı |
| ✅ Müşteri + randevu arama/filtreleme + cursor pagination (01.05.2026) | Tamamlandı |
| ✅ Public Slots API — `/public/slots` + `/public/services` (01.05.2026) | Tamamlandı |
| ✅ Tenant self-serve kayıt + trial sistemi — `POST /auth/register`, `checkTenantActive` middleware, Resend e-posta, 9/9 test (01.05.2026) | Tamamlandı |
| ✅ Signup sayfası + trial banner + 402 erişim engeli — 7 dosya (01.05.2026) | Tamamlandı |

---

## Frontend İlerlemesi

**Son güncelleme:** 22.04.2026 — Dashboard period filtresi, Kasa Kapatma modalı, tarih aralığı filtresi (Görev 1-3)

### Deployment

| Platform | URL | Durum |
|---|---|---|
| Vercel (Next.js 14, App Router) | production Vercel URL | ✅ Canlı |

Root Directory: `apps/web` | Framework: Next.js | Build: `npm run build`

### Altyapı

| Bileşen | Durum | Notlar |
|---|---|---|
| Next.js 14 App Router + TypeScript | ✅ Tamamlandı | `apps/web/` |
| Tailwind CSS v4 | ✅ Tamamlandı | `@tailwindcss/postcss`, CSS `@theme` token'ları |
| BeautyOS design token | ✅ Tamamlandı | Primary `#6B48FF`, salon-border, salon-muted, salon-bg, Inter font |
| TanStack Query v5 | ✅ Tamamlandı | staleTime 60s, retry 1 |
| Zustand + persist | ✅ Tamamlandı | `useAuthStore` — setAuth / logout, localStorage |
| React Hook Form + Zod | ✅ Tamamlandı | Tüm formlarda validasyon |
| `apiFetch<T>()` | ✅ Tamamlandı | Bearer token, Türkçe hata mesajları |
| AuthGuard | ✅ Tamamlandı | Token yoksa `/login`'e yönlendirme |
| Toast sistemi | ✅ Tamamlandı | Radix Toast üzerine global `toast()` helper |

### Sayfalar

| Sayfa | Rota | Durum |
|---|---|---|
| Login | `/login` | ✅ Tamamlandı |
| Dashboard | `/tenant/:slug/dashboard` | ✅ Tamamlandı |
| Randevular | `/tenant/:slug/appointments` | ✅ Tamamlandı |
| Müşteriler | `/tenant/:slug/customers` | ✅ Tamamlandı |
| Müşteri Detay | `/tenant/:slug/customers/:id` | ✅ Tamamlandı |
| Ayarlar | `/tenant/:slug/settings` | ✅ Tamamlandı |
| Hizmetler | `/tenant/:slug/services` | ✅ Tamamlandı |
| Personel | `/tenant/:slug/staff` | ✅ Tamamlandı |
| Kasa | `/tenant/:slug/finance` | ✅ Tamamlandı |
| Onboarding Sihirbazı | `/onboarding` | ✅ Tamamlandı |

### Bileşenler

**Layout**
- `Sidebar` — desktop navigasyon, kullanıcı bilgisi, çıkış butonu
- `MobileNav` — sabit alt navigasyon (mobile)
- `AuthGuard` — kimlik doğrulama koruyucusu

**UI Primitives** (`src/components/ui/`)
- Button, Input, Label, Card, Skeleton, Select, Textarea, Dialog, Toaster

**Dashboard**
- `KpiCard` — değer, ikon, trend, skeleton loading
- `TodaysAppointments` — bugünün randevu listesi, durum badge'leri

**Randevular**
- `AppointmentCalendar` — FullCalendar (`ssr:false`), Türkçe locale, personel renk kodlaması
- `NewAppointmentModal` — müşteri / hizmet / personel dropdown, datetime picker
- `AppointmentStatusModal` — 6 durum seçeneği

**Müşteriler**
- `NewCustomerModal` — ad-soyad, telefon, e-posta, doğum tarihi
- `EditCustomerModal` — fullName, phone, email, birthDate, allergyNotes, preferenceNotes

**Hizmetler**
- `ServiceModal` — ekle/düzenle (isim, kategori, süre, fiyat, isActive)
- Kategori bazlı gruplandırılmış liste, soft delete

**Personel**
- `StaffModal` — ekle (fullName, email, şifre, title, renk) / düzenle (title, bio, renk)
- `ColorPicker` — 8 renk swatchi, integer index olarak saklanır
- Kart grid görünümü

**UI Primitives (yeni)**
- `ConfirmDialog` — yeniden kullanılabilir onay dialogu

**Finance (yeni/güncellendi)**
- `FinancePage` — tarih aralığı preset toggle (5 seçenek), Özel Aralık date picker çifti, Günlük Dağılım tablosu
- Kasa Kapatma Dialog — özet kartlar (büyük font), işlem tablosu, personel komisyonları, Yazdır butonu
- `@media print` CSS — visibility trick ile sadece rapor alanı yazdırılıyor

**Onboarding**
- `OnboardingProgress` — animasyonlu progress bar (%20→%100)
- `Step1Salon` — salon bilgileri formu, PATCH /settings
- `Step2Services` — dinamik hizmet listesi (max 5), POST /services
- `Step3Staff` — dinamik personel listesi (max 3), renk swatchi, POST /staff
- `Step4WhatsApp` — bilgi ekranı, mock e-posta toast, atla butonu
- `Step5Done` — CSS animasyonlu tik, `onboardingCompleted=true` set
- `store/auth.ts` — `onboardingCompleted` + `completeOnboarding()` persist'e eklendi
- Login sonrası yönlendirme: `onboardingCompleted` false ise `/onboarding`, değilse dashboard

### Düzeltilen Bug'lar

| Bug | Çözüm |
|---|---|
| FullCalendar SSR crash | `dynamic(() => import(...), { ssr: false })` |
| `next.config.ts` Vercel crash | `.ts` → `.mjs`, eski dosya git'ten silindi |
| Tailwind v4 PostCSS hatası | `@tailwindcss/postcss` + CSS `@theme` |
| `staff.user.fullName` interface hatası | Backend flat `fullName` döndürüyor, interface güncellendi |
| `apt.startAt` → `apt.startTime` | Customer detail sayfasında field adı düzeltildi |
| `['appointments-today']` query key uyumsuzluğu | `['appointments']` olarak düzeltildi — randevu sonrası dashboard güncellenmiyordu |

### 22.04.2026 Güncellemeleri

**Dashboard Period Filtresi ✅**
- `useSearchParams` ile period URL'de tutuluyor (`?period=today|week|month`)
- `DashboardContent` bileşeni `<Suspense>` ile sarıldı (Next.js 14 App Router uyumluluğu)
- TanStack Query key: `['dashboard', slug, period]` — period değişiminde cache'siz dönemler skeleton gösteriyor
- `router.replace` ile URL güncelleniyor, sayfa yenilenmeden persist ediliyor

**Kasa Kapatma Modalı ✅**
- "Kasa Kapatma" butonuna tıklanınca `POST /finance/close-day?date=<bugün>` çağrılıyor
- Loading state: buton "Hesaplanıyor…" olarak değişiyor, disabled
- Response `Dialog` içinde gösteriliyor: 5 özet kart (büyük font), işlem tablosu, personel komisyonları
- "Yazdır" butonu: `window.print()` + `@media print` CSS (visibility trick ile sidebar/header gizleniyor)
- `#close-day-print-area` id'si ile sadece rapor içeriği yazdırılıyor
- "Kapat" butonu: `DialogClose` ile dialog kapanıyor

**Kasa Tarih Aralığı Filtresi ✅**
- Tek gün picker kaldırıldı → 5 hızlı seçim butonu: Bugün / Bu Hafta / Bu Ay / Bu Yıl / Özel Aralık
- "Özel Aralık" seçilince from + to date picker ikilisi gösteriliyor
- `getDateRange()` helper: ISO haftası Pazartesi–Pazar hesabı (TR standardı)
- Tek gün: `from=to=<tarih>`, çok gün: `groupBy=day` parametresi ekleniyor
- `from > to` durumunda: query devre dışı + toast "Başlangıç tarihi bitiş tarihinden büyük olamaz"
- Çok günlük görünümde "Günlük Dağılım" tablosu: tarih, randevu, ciro, nakit, kart, net kolonları
- 4 özet kart seçilen aralığın toplamını gösteriyor
- TanStack Query key: `['finance', slug, from, to]`
- Gider/gelir ekleme formları `from` tarihini kullanıyor

**Finance / Kasa Sayfası ✅**
- `/tenant/:slug/finance` — yeni sayfa
- Tarih seçici (default bugün, max bugün)
- 4 özet kart: Toplam Ciro, Nakit, Kart, Net Kâr
- Gelirler tablosu: saat, müşteri, hizmet, tutar, ödeme + kategori filtre butonları
- Giderler bölümü: kategori filtresi, "Gider Ekle" inline form (özel kategori desteği), satır sil
- Manuel Gelir formu: walk-in müşteri için açıklama + tutar + ödeme yöntemi
- Personel Komisyonları tablosu
- Kasa Kapatma butonu (owner only)

**Randevu Kapatma Modalı ✅**
- "Tamamlandı" seçilince fiyat + nakit/kart seçim ekranı açılıyor
- Aynı Dialog içinde koşullu render (z-index sorunu çözüldü)
- Backend: priceCharged ve paymentMethod PATCH body'sine eklendi

**Takvim Görsel İyileştirme ✅**
- Status bazlı renk (pending=sarı, confirmed=mavi, in_progress=mor, completed=yeşil, cancelled/no_show=gri/kırmızı)
- Sol renkli şerit (personel rengi), koyu metin okunabilirliği
- Takvim üstü legend çubuğu
- CSS override: border-radius, padding, box-shadow

**Randevu UX İyileştirmeleri ✅**
- Takvimden slot seçince saat otomatik forma yansıyor (useEffect + reset)
- Geçmiş günlere randevu engeli (min attribute + validate)
- Bugünün geçmiş saatine ekleme için amber uyarı
- Randevu detay paneli: müşteri telefonu, hizmet, personel, saat, fiyat, not, ref kodu
- Tıklama akışı: detay → "Durum Değiştir" → status modal
- Terminal status (completed/cancelled/no_show): "Durum Değiştir" butonu gizlenir

**Personel Yönetim Sayfası ✅**
- `/tenant/:slug/staff/:staffId` — yeni detay sayfası
- Profil tab: ad, unvan, email, renk, çalışma saatleri, yetenek badge'leri
- Yetenekler tab (owner): skill atama/kaldırma, komisyon tipi/değeri, fiyat override
- İzinler tab (owner): izin ekleme/silme (tarih, tip, not)

**Randevu Formu — Hizmet → Personel Filtreleme ✅**
- `Staff` interface'ine `skills: { serviceId, serviceName }[]` eklendi
- `selectedServiceId = watch('serviceId')` ile hizmet seçimi reaktif izleniyor
- `filteredStaff`: hizmet seçilmişse `skills` array'inde o `serviceId`'yi barındıran personel, seçilmemişse tüm personel
- Hizmet değiştirilince `setValue('staffId', '')` ile seçili personel sıfırlanıyor
- Uygun personel yoksa dropdown'da "Bu hizmet için uygun personel yok" placeholder gösteriliyor
- Filtreleme tamamen client-side — ek API çağrısı yok

**Personel Detay — Haftalık Çalışma Saati Editörü ✅**
- Profil tab'ındaki ham JSON `<pre>` gösterimi kaldırıldı
- 7 satırlık editör eklendi: Pazartesi–Pazar, her satırda toggle (Açık/Kapalı) + `type="time"` input çifti
- Kapalı gün → JSON'da `null`; açık iken default `09:00–18:00` atanır
- owner/manager: toggle ve saat inputları aktif; diğer roller: disabled (salt okunur)
- "Kaydet" butonu → `PATCH /staff/:staffId { workingHours }` — diğer alanları etkilemez
- `useEffect` ile `staff` yüklenince local state senkronize ediliyor; `null` gelirse tüm günler kapalı başlar
- Kaydet sonrası `['staff', slug]` invalidate, toast gösteriliyor

**Rol Bazlı Erişim Kontrolü (RBAC) ✅**
- Sidebar + MobileNav: staff rolünde Personel, Kasa, Ayarlar linkleri gizleniyor
- Yönlendirme koruması: `/finance`, `/settings`, `/staff` sayfalarına staff girerse dashboard'a yönleniyor (`useEffect + router.replace`)
- Staff detay sayfası: staff rolü sadece kendi profiline erişebilir (email eşleştirme); başkasına gitmeye çalışırsa dashboard'a yönleniyor
- Hizmetler sayfası: staff rolünde "Yeni Hizmet", "Düzenle", "Pasif Yap" butonları gizleniyor
- NewAppointmentModal: staff rolünde personel dropdown'ı sadece kendisini gösteriyor (email eşleştirme + mevcut skill filtresiyle uyumlu)
- Dashboard: staff rolünde Bugünün Geliri ve Doluluk KPI kartları gizleniyor; Randevular + Müşteriler görünür kalıyor
- Yeni store alanı yok — tüm kontroller `useAuthStore((s) => s.user?.role)` ile yapılıyor

**Hızlı İşlem Modalı ✅**
- `QuickTransactionModal` — yeni bileşen (`src/components/appointments/quick-transaction-modal.tsx`)
- Sıralı API akışı: `POST /appointments {startAt: now}` → `PATCH /appointments/:id/status {completed, priceCharged, paymentMethod}`
- Staff rolü: hizmetler yalnızca kendi skill'leriyle filtreleniyor; personel dropdown'ı gizleniyor, staffId otomatik atanıyor
- Owner/manager: tüm hizmetler + tam personel dropdown görünür
- Hizmet seçilince fiyat otomatik dolduruluyor (`useEffect` + `setValue('priceCharged')`)
- Ödeme yöntemi: Nakit / Kart toggle butonları
- Randevular sayfasına "Hızlı İşlem" butonu eklendi (Zap ikonu, `variant="outline"`, "Yeni Randevu" yanına)
- Başarı sonrası `['appointments']`, `['appointments-calendar', slug]`, `['finance', slug]` invalidate ediliyor

**Drag & Drop Randevu Taşıma ✅**
- `AppointmentCalendar`: `useQueryClient`, `useAuthStore`, `toast` import edildi
- `isEditable = role === 'owner' || role === 'manager'` — `editable={isEditable}` ile staff için D&D devre dışı
- `eventDrop` handler: `PATCH /appointments/:id/reschedule { startAt }` çağrısı; başarıda `['appointments-calendar']` + `['appointments']` invalidate + toast; hata durumunda `revert()` + hata toast'u
- Backend: `PATCH /appointments/:appointmentId/reschedule` endpoint'i eklendi — terminal status koruması, çakışma kontrolü, `endAt` servis süresinden hesaplanıyor, eski reminder job'ları silinip yeni zamana göre yeniden planlanıyor

**Sektör Seçimi + Follow-up Toggle + Hizmet Formu ✅**
- Onboarding Step1Salon: `businessType` optional radio butonu eklendi — 5 seçenek, görsel kart stili (`border-primary` + `bg-primary-50`), PATCH body'sine dahil
- Ayarlar Sayfası: `TenantSettings` interface'e `businessType?` + `followUpEnabled?` eklendi; yeni `AdvancedSettingsPanel` bileşeni — işletme türü dropdown + follow-up toggle; `onChange`'de anlık `PATCH /settings` kaydı (ayrı buton yok); `['tenant-settings', slug]` query invalidate
- Ayarlar sayfası layout güncellendi: salon tab artık iki Card — "Salon Bilgileri" + "Gelişmiş Özellikler"
- `ServiceModal`: `['tenant-settings', slug]` query ile `followUpEnabled` okunuyor; `true` ise form altında "Takip Günleri" editörü gösteriliyor (dinamik satır ekle/sil, gün + açıklama); veri henüz API'ye gönderilmiyor (backend agent ayrı brief alacak)

**Login → Onboarding Yönlendirmesi DB Bazlı ✅**
- Login `onSuccess`: `setAuth` sonrası `GET /settings` çağrılıyor (token localStorage'a yazıldıktan hemen sonra, `apiFetch` onu otomatik okur)
- `settings.onboardingCompleted === true` ise `completeOnboarding()` + dashboard yönlendirmesi; değilse `/onboarding`
- Settings fetch hata verirse güvenli fallback: `/onboarding`'e yönlendir
- `onboardingCompleted` artık localStorage'dan okunmuyor — her login'de DB'den taze değer alınıyor
- Step5Done: "Dashboard'a Git" tıklanınca önce `PATCH /settings { onboardingCompleted: true }` çağrılıyor, ardından `completeOnboarding()` + yönlendirme
- PATCH hata verirse sessizce geçiliyor (non-critical) — kullanıcı deneyimi kesilmiyor
- Button `saving` state ile disabled yapıldı (çift tıklama koruması)

**AuthGuard Onboarding Kontrolü ✅**
- `AuthGuard`: `onboardingCompleted` false ve yol `/onboarding`'te değilse `/onboarding`'e yönlendirme eklendi
- Redirect loop koruması: `usePathname()` ile `/onboarding` rotası kontrol edilip guard devre dışı bırakılıyor
- Hem `useEffect` hem render dönüşüne `null` kontrolü eklendi

**Sektörel Kategori & Öneri Sistemi ✅**
- `src/lib/sector-data.ts` oluşturuldu: `SECTOR_DATA` (barbershop/beauty_center/nail_studio/aesthetic/other) + `DEFAULT_SECTOR` — `categories` ve `suggestions` alanları
- `Step2Services` yeniden yazıldı: `GET /settings`'ten `businessType` okunuyor, sektöre göre kategori dropdown + öneri chip'leri gösteriliyor; chip tıklanınca ilgili satırın hizmet adı dolduruluyor; kategori `z.string().min(1)` olarak gevşetildi
- `ServiceModal`: Kategori alanı serbest `Input`'tan `Select`'e dönüştürüldü; `GET /settings`'ten `businessType` okunuyor, sektöre göre `SECTOR_DATA[businessType].categories` listeleniyor; ayarlar değişince query invalidate ile otomatik güncelleniyor

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| ✅ Bot: skill + mesai + izin farkındalığı (Agent 03) | Tamamlandı |
| ✅ Randevu detay — not ekleme/düzenleme + silme (01.05.2026) | Tamamlandı |
| ✅ Müşteri arama + randevu filtre paneli + cursor pagination (01.05.2026) | Tamamlandı |
| ✅ Randevu formu — public/slots slot dropdown + SlotSelect bileşeni (01.05.2026) | Tamamlandı |
| ServiceModal follow-up days: `followUpSchedule` mutation body'ye dahil edilecek | Orta |
| WhatsApp bot — salon.context.ts → public/slots endpoint'ine geçiş | Orta |
| PWA manifest + service worker | Düşük |
| Dark mode | Düşük |

---

## DevOps İlerlemesi

**Son güncelleme:** 01.05.2026

### Monitoring & Alert Sistemi ✅

| Bileşen | Durum | Notlar |
|---|---|---|
| `/health` endpoint genişletmesi | ✅ Tamamlandı | DB (Prisma SELECT 1) + Redis ping; `{ status, db, redis, uptime }`; herhangi biri fail → HTTP 503 |
| Uptime hesaplama | ✅ Tamamlandı | `startedAt` timestamp ile gerçek uptime saniye cinsinden |
| Sentry entegrasyonu | ✅ Tamamlandı | `instrument.ts` ayrı dosyaya alındı — Express init sırası düzeltildi; `SENTRY_DSN` Railway env'de |
| UptimeRobot | ✅ Tamamlandı | `/health` her 3 dakikada ping; servis down → Telegram + e-posta alert |

> ⚠️ Bekleyen: Sentry `instrument.ts` fix'i staging branch'te bekliyor — bir sonraki deploy öncesi master'a merge edilmeli.

### Staging Ortamı ✅

| Bileşen | Durum | Notlar |
|---|---|---|
| `staging` branch | ✅ Tamamlandı | GitHub'da mevcut; feature → staging → master akışı |
| CI pipeline | ✅ Tamamlandı | `.github/workflows/ci.yml` — staging + master push/PR'da type-check, lint, Vitest |
| Railway staging servisi | ✅ Tamamlandı | `beautyos-api-staging` — staging branch'ten deploy, ayrı Supabase DB |
| Redis key izolasyonu | ✅ Tamamlandı | `REDIS_KEY_PREFIX=staging:` env — production key'leriyle çakışmaz |
| Vercel Preview | ✅ Tamamlandı | `NEXT_PUBLIC_API_URL` → staging API URL'si; her staging push'ta preview URL |

### Servis URL'leri

| Ortam | API | Frontend |
|---|---|---|
| Production | `https://beautyosapi-production.up.railway.app` | Vercel production |
| Staging | `https://beautyos-api-staging-production.up.railway.app` | Vercel preview (staging branch) |

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| ✅ Sentry `instrument.ts` fix staging → master merge (01.05.2026) | Tamamlandı |
| ✅ Security Agent (07) tamamlandı (01.05.2026) | Tamamlandı |
| Railway'e `CORS_ORIGIN=https://beautyos.vercel.app` env ekle (pilot öncesi) | Yüksek |

---

## Güvenlik İlerlemesi

**Son güncelleme:** 01.05.2026

### Güvenlik Denetimi ✅

| Alan | Durum | Notlar |
|---|---|---|
| Rate limiting genişletmesi | ✅ Tamamlandı | `GET /customers?search` → 60 req/dk tenant bazlı; `POST /appointments` → 20 req/dk; `Retry-After` header |
| JWT refresh token | ✅ Tamamlandı | Access token 15 dk; refresh token 30 gün HttpOnly cookie; `POST /auth/refresh` (rotate) + `POST /auth/logout` |
| Tenant izolasyon testleri | ✅ Tamamlandı | 14 test — `tenant-isolation.test.ts`; cross-slug (403) + cross-resource ID (404); appointments/customers/services/staff/dashboard/reports/finance |
| Input sanitization | ✅ Tamamlandı | Tüm `z.string()` alanlarına `.trim()`; notes/allergyNotes/preferenceNotes XSS pattern check |
| CORS güncelleme | ✅ Tamamlandı | `origin: true` — cookie + credentials desteği; production'da `CORS_ORIGIN` env ile kısıtlanacak |
| Frontend 401 interceptor | ✅ Tamamlandı | `apiFetch()` → 401'de `/auth/refresh`, yeni token localStorage'a; refresh başarısızsa `logout()` + `/login` |

> ⚠️ Pilot öncesi yapılması gereken: Railway'e `CORS_ORIGIN=https://beautyos.vercel.app` env ekle

---

## Veritabanı İlerlemesi

<!-- Database agent bu bölümü dolduracak -->

---

## WhatsApp AI İlerlemesi

### Tamamlanan Bugfix'ler (2026-04-21)

**Bug 1 — Saat Kayması (KRİTİK) ✅**
- `getAvailableSlots` içinde `setHours()` yerine UTC ofset tabanlı hesaplama kullanıldı.
- `dayStart/dayEnd` artık `date.getTime() + (hour - 3) * 3600 * 1000` formülüyle doğru UTC timestamp üretiyor.
- Slot `label` TR saatini gösteriyor (`trCursor.getUTCHours()`); `id` ise UTC ISO string saklıyor (createAppointment parse'da doğru çalışıyor).

**Bug 2 — Personel Adı Unvan Çıkıyor ✅**
- `staffProfile.findMany` sorgusuna `include: { user: { select: { fullName: true } } }` eklendi.
- `staffName: sp.title` → `staffName: sp.user.fullName` ile gerçek isim gösteriliyor.

**Bug 8 — "Merhaba" → unknown (chat API history sorunu) ✅**
- `chat.startChat + sendMessage` → `model.generateContent()` ile değiştirildi. Chat API'de `systemInstruction` + boş history kombinasyonu sessiz hata üretiyordu.
- `buildDetectionPrompt()` fully self-contained hale getirildi: system instruction, salon context, session state ve örnekler tek prompt içinde.
- `generateReply()` da aynı şekilde `generateContent()` kullanacak şekilde güncellendi.
- `toGeminiHistory` ve `Content` import'u kaldırıldı (artık kullanılmıyor).
- `logger.info({ raw })` ile Railway'de Gemini ham yanıtı görülebilir.

**Bug 7 — Gemini "anlayamadım" döngüsü ✅**
- Model isimleri `gemini-2.5-flash/pro` → `gemini-2.0-flash` (GA, JSON mode tam destekli).
- `responseMimeType: 'application/json'` kaldırıldı; JSON prompt içinde isteniyor (bazı versiyonlarda uyumsuzluk vardı).
- JSON parse öncesi markdown code block temizleniyor (`cleaned`).
- `catch` bloğu ve parse hataları tam bağlamla loglanıyor (`model`, `message`, `zodError`).
- `buildDetectionPrompt()`: Türkçe örnekler + "sadece geçerli JSON döndür" kuralı eklendi.
- `buildSystemPrompt()`: KURALLAR bölümü daha doğal konuşma için güncellendi.

**Bug 4 — Sonsuz Döngü (unknown intent) ✅**
- `flow.handler.ts`: `unknown` intent gelince artık `clarifyCount` artırılıyor ve "Tam anlayamadım" mesajı dönülüyor. Katman 2/3 eşiklerine göre yönlendirme yapılıyor; döngü kırıldı.

**Bug 5 — Keyword Fallback Kaldırıldı (refactor) ✅**
- `detectByKeyword()` tamamen silindi — tüm intent tespiti Gemini üzerinden.
- Önceki keyword fallback "randevu" kelimesini yakalarken entities boş dönüyordu (service çıkarılmıyordu), bu da servis listesi menüsünün gereksiz açılmasına yol açıyordu.

**Bug 6 — Sistem Promptu Doğal Konuşmayı Desteklemiyor ✅**
- `buildSystemPrompt()`: Niyet tespit örnekleri eklendi ("Tırnak" → book, "Merhaba" → general).
- `buildDetectionPrompt()`: `unknown` vs `general` kuralı eklendi — selamlama/belirsiz mesajlar artık `general` sayılıyor.

**İyileştirme — /start sonrası yönlendirme ✅**
- `REPLIES.welcome` ilk 3 hizmet adını mesajda gösteriyor. `buildWelcome` salon context alacak şekilde güncellendi.

**Bug 3 — Online Rezervasyona Kapalı Hizmetler ✅**
- `prisma/schema.prisma` — `Service` modeline `isOnlineBookable Boolean @default(true)` eklendi.
- Migration çalıştırıldı: `20260421040337_add_service_online_bookable` (mevcut hizmetler `true` değeriyle güncellendi).
- `salon.context.ts` — `services` sorgusu `isOnlineBookable: true` filtresiyle güncellendi.
- `GET /services?onlineOnly=true` query param desteği eklendi.
- `PATCH /services/:id` — `updateServiceSchema`'ya `isOnlineBookable` alanı eklendi; response'a da dahil edildi.

---

### Tamamlanan İyileştirmeler — 2026-04-21 (Oturum 2)

**Gemini Model Güncelleme ✅**
- `gemini-2.0-flash` yeni API key'lerde HTTP 404 döndürdüğü keşfedildi (deprecated for new users).
- `gemini-2.5-flash` olarak güncellendi.
- `thinkingBudget: 0` eklendi — thinking token'lar output budget'ını tüketip JSON'u kesiyor.
- Local test scriptiyle doğrulandı: "Merhaba" → `general`, "Saç kestirmek istiyorum" → `book`, "Yarın müsait misiniz?" → `query_availability`.

**Tamamen Doğal Dil Akışı (Büyük Refactor) ✅**
- Tüm `sendList` / `sendButtons` çağrıları kaldırıldı — saf metin tabanlı konuşma.
- `detectByKeyword()` silindi — sadece Gemini kullanılıyor.
- `awaiting_confirm` adımı eklendi (session step): randevu oluşturmadan önce kullanıcıdan "evet/hayır" onayı alınıyor.
- Yeni akış: servis tespiti → tarih sorusu → numaralı slot listesi → özet onay → rezervasyon.

**Tarih Çözücü İyileştirmeleri ✅**
- `resolveDate()` artık Türkçe ay adlarını tanıyor: "22 Nisan", "3 Mayıs" gibi formatlar.
- `resolveTimeRange()` doğal metin kabul ediyor: "öğleden sonra", "akşam", "saat 14" vb.
- Slot listesi başlığına tarih eklendi (kullanıcı hangi gün için baktığını biliyor).

**Akış Ortasında Tarih Değiştirme ✅**
- `awaiting_slot_confirm` adımında kullanıcı yeni bir tarih söylerse (örn: "hayır cumartesi istiyorum") → slot listesi yeni tarih için yeniden yükleniyor.
- `awaiting_confirm` adımında "Hayır ben 22 nisanda gelecem" → iptal değil, tarih değişikliği olarak algılanıyor.

---

### WhatsApp AI — Oturum 3 (2026-04-21)

**İŞ 1 — Randevu İptal Akışı Geliştirildi ✅**

- `cancelAppointmentByRef()` → `CancelResult` döndürüyor: `{ok:true}` | `{ok:false,reason:'not_found'}` | `{ok:false,reason:'too_soon'}`
- 2 saat kuralı: `appointment.startAt - Date.now() < 7_200_000` ms ise `too_soon`
- Geçersiz kodda retry takibi: `_cancelAttempts` session entities'de saklanıyor
- 2 başarısız denemede `step='handed_off'` + salon adresine yönlendirme
- `SalonContext`'e opsiyonel `phone?: string` alanı eklendi — `too_soon` durumunda iletişim bilgisi gösteriliyor
- `startCancel()` mesajı güncellendi: referans kodu formatı açıklaması eklendi

**İŞ 2 — Intent Test Veri Seti ✅**

- `apps/api/src/__tests__/intent.test.ts` — 20 Türkçe konuşma
- GERÇEK Gemini API çağrısı (mock yok)
- Kategoriler: book (7), cancel (3), query_price (3), query_availability (3), general (4)
- Yazım hatası test'leri: "rndy almak istiyorum", "pzrtsi için rnvu almk istyrm"
- Hedef: 17/20 (%85) — `expect(passed).toBeGreaterThanOrEqual(17)` — 2 dk timeout
- Başarısız testler konsola detaylı yazdırılıyor

**İŞ 3 — Prompt Token Optimizasyonu ✅**

| Prompt | Öncesi (kelime) | Sonrası (kelime) | Azalma |
|---|---|---|---|
| `buildDetectionPrompt` (sabit kısım) | ~134 | ~73 | **%46** |
| `buildReplySystemPrompt` (sabit kısım) | ~100 | ~53 | **%47** |

Yöntem:
- `buildDetectionPrompt`: 6 örnek → 4 örnek (inline format, satır başı Giriş:/Çıkış: kaldırıldı)
- `buildDetectionPrompt`: KURALLAR 3 madde → 1 satır inline
- `buildDetectionPrompt`: "ZORUNLU JSON FORMATI" + açıklaması kısaltıldı
- `buildReplySystemPrompt`: 8 madde → 3 madde inline KURALLAR
- `buildReplySystemPrompt`: menü format `Name(Xdk,₺Y)` → `Name|Xdk|₺Y`
- `buildReplySystemPrompt`: personel listesinde unvan kaldırıldı
- Her iki fonksiyon başına `logger.info({ tokens: prompt.split(' ').length })` eklendi

### Bilinen Açık Sorunlar

| Sorun | Durum | Not |
|---|---|---|
| Personel adı "Güzellik Uzmanı" çıkıyor | Veri sorunu | Admin panelinden `user.fullName` güncellenmeli |
| Intent test'leri henüz çalıştırılmadı | Bekliyor | `GEMINI_API_KEY` env gerekiyor |
