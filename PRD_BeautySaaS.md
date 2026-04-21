# BeautyOS — Proje İlerleme Takibi

> Bu dosya tüm agent'ların ortak ilerleme kaydıdır.
> Her agent yalnızca kendi bölümünü günceller.

---

## Backend İlerlemesi

**Son güncelleme:** 21.04.2026

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
| `GET /api/v1/tenants/:slug/dashboard` | ✅ Tamamlandı | KPI: gelir, randevu, müşteri, doluluk, değişim % |
| `GET /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | Salon adı + settings JSON |
| `PATCH /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | owner/manager yetkisi, settings JSON merge |

#### Randevular
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | ?date + ?limit filtresi |
| `POST /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | endAt otomatik, referenceCode, slot çakışma kontrolü (409) |
| `PATCH /api/v1/tenants/:slug/appointments/:id/status` | ✅ Tamamlandı | 6 durum enum, iptal nedeni opsiyonel |

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

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| `DELETE /appointments/:id` | Düşük |
| Pagination (cursor-based) customers/appointments için | Düşük |
| BullMQ hatırlatma görevleri (T-24h, T-2h) | İleride |

---

## Frontend İlerlemesi

**Son güncelleme:** 21.04.2026 — Brief 2B tamamlandı

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

### Düzeltilen Bug'lar

| Bug | Çözüm |
|---|---|
| FullCalendar SSR crash | `dynamic(() => import(...), { ssr: false })` |
| `next.config.ts` Vercel crash | `.ts` → `.mjs`, eski dosya git'ten silindi |
| Tailwind v4 PostCSS hatası | `@tailwindcss/postcss` + CSS `@theme` |
| `staff.user.fullName` interface hatası | Backend flat `fullName` döndürüyor, interface güncellendi |
| `apt.startAt` → `apt.startTime` | Customer detail sayfasında field adı düzeltildi |
| `['appointments-today']` query key uyumsuzluğu | `['appointments']` olarak düzeltildi — randevu sonrası dashboard güncellenmiyordu |

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| Dashboard tarih filtresi backend desteği (`?period=week\|month`) | Orta |
| Randevu detay sayfası | Düşük |
| PWA manifest + service worker | Düşük |
| Dark mode | Düşük |

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

**Bug 7 — Gemini "anlayamadım" döngüsü ✅**
- Model isimleri `gemini-2.5-flash/pro` → `gemini-2.0-flash` (GA, JSON mode tam destekli).
- `responseMimeType: 'application/json'` kaldırıldı; JSON prompt içinde isteniyor (bazı versiyonlarda uyumsuzluk vardı).
- JSON parse öncesi markdown code block temizleniyor (`cleaned`).
- `catch` bloğu ve parse hataları tam bağlamla loglanıyor (`model`, `message`, `zodError`).
- `buildDetectionPrompt()`: Türkçe örnekler + "sadece geçerli JSON döndür" kuralı eklendi.
- `buildSystemPrompt()`: KURALLAR bölümü daha doğal konuşma için güncellendi.

**Bug 4 — Sonsuz Döngü (unknown intent) ✅**
- `flow.handler.ts`: `unknown` intent gelince artık `clarifyCount` artırılıyor ve "Tam anlayamadım" mesajı dönülüyor. Katman 2/3 eşiklerine göre yönlendirme yapılıyor; döngü kırıldı.

**Bug 5 — Keyword Fallback Eksikti ✅**
- `intent.service.ts`: `detectByKeyword()` private metodu eklendi. "randevu", "manikür", "iptal", "fiyat" gibi anahtar kelimeler Gemini'ye gitmeden doğrudan `book/cancel/query_price` olarak algılanıyor. Salon hizmet adları da eşleştiriliyor.

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
