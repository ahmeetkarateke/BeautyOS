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
| Railway deployment | ✅ Canlı | `beautyosapi-production.up.railway.app` |

### API Endpoint'leri

#### Auth
| Endpoint | Durum | Notlar |
|---|---|---|
| `POST /api/v1/auth/login` | ✅ Tamamlandı | JWT 7 gün, bcryptjs verify |

#### Tenant — Dashboard & Genel
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/dashboard` | ✅ Tamamlandı | KPI: gelir, randevu, müşteri, doluluk, değişim % |
| `GET /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | Salon adı + settings JSON |
| `PATCH /api/v1/tenants/:slug/settings` | ✅ Tamamlandı | owner/manager yetkisi, settings JSON merge |

#### Randevular
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | ?date + ?limit filtresi; `z.preprocess` fix uygulandı |
| `POST /api/v1/tenants/:slug/appointments` | ✅ Tamamlandı | endAt otomatik hesaplama, referenceCode üretimi; datetime-local format fix uygulandı |
| `PATCH /api/v1/tenants/:slug/appointments/:id/status` | ✅ Tamamlandı | 6 durum enum, iptal nedeni opsiyonel |

#### Müşteriler
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/customers` | ✅ Tamamlandı | Sıralı liste |
| `GET /api/v1/tenants/:slug/customers/:id` | ✅ Tamamlandı | Detay + son 20 randevu geçmişi |
| `POST /api/v1/tenants/:slug/customers` | ✅ Tamamlandı | 409 duplicate phone kontrolü (P2002) |

#### Hizmetler & Personel
| Endpoint | Durum | Notlar |
|---|---|---|
| `GET /api/v1/tenants/:slug/services` | ✅ Tamamlandı | Aktif hizmetler: id, name, durationMinutes, price |
| `GET /api/v1/tenants/:slug/staff` | ✅ Tamamlandı | id, title, fullName, colorCode |

#### Kullanıcı
| Endpoint | Durum | Notlar |
|---|---|---|
| `PATCH /api/v1/tenants/:slug/users/:id/password` | ✅ Tamamlandı | self veya owner yetkisi, bcrypt verify + rehash |

### Bekleyen / Sonraki Adımlar

| Görev | Öncelik |
|---|---|
| Slot çakışma kontrolü (randevu oluştururken staff müsaitlik) | Orta |
| Rate limiting (`express-rate-limit`) | Orta |
| `DELETE /appointments/:id` | Düşük |
| Pagination (cursor-based) customers/appointments için | Düşük |
| BullMQ hatırlatma görevleri (T-24h, T-2h) | İleride |

---

## Frontend İlerlemesi

<!-- Frontend agent bu bölümü dolduracak -->

---

## Veritabanı İlerlemesi

<!-- Database agent bu bölümü dolduracak -->

---

## WhatsApp AI İlerlemesi

<!-- WhatsApp AI agent bu bölümü dolduracak -->
