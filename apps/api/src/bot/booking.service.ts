import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { getSlots } from '../lib/slots'
import { SlotTakenError, isSlotOverlapError } from '../lib/slot-conflict'
import type { BookingChannel } from '@prisma/client'

/** Hizmet adı bu kiracıdaki aktif hizmetlerle eşleşmedi: akış netleştirme sorusu sorar, sahte yanıt üretmez (S5 K2). */
export class ServiceNotFoundError extends Error {
  readonly code = 'SERVICE_NOT_FOUND'
  constructor(readonly serviceName: string) {
    super('Hizmet bulunamadı.')
  }
}

// ─── Saat dilimleri (Türkiye: UTC+3) ─────────────────────────────────────────

const TZ_OFFSET_HOURS = 3
const TR_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000

// ─── Türkçe karakter normalizasyonu (hizmet adı eşleştirme) ──────────────────

function normalizeTR(str: string): string {
  return str
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
}

function nowTR(): Date {
  return new Date(Date.now() + TR_OFFSET_MS)
}

// ─── Tercih → Tarih çözücü ────────────────────────────────────────────────────

export function resolveDate(datePreference: string | undefined): Date {
  const today = nowTR()
  today.setHours(0, 0, 0, 0)

  if (!datePreference) return today

  const pref = datePreference.replace('date:', '').toLowerCase().trim()

  if (!pref || pref === 'bugun' || pref === 'bugün') return today

  if (pref.includes('yarin') || pref.includes('yarın')) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d
  }

  const dayNames: Record<string, number> = {
    pazartesi: 1, sali: 2, 'salı': 2, carsamba: 3, 'çarşamba': 3,
    persembe: 4, 'perşembe': 4, cuma: 5, cumartesi: 6, pazar: 0,
  }
  for (const [name, dow] of Object.entries(dayNames)) {
    if (pref.includes(name)) {
      const d = new Date(today)
      let diff = dow - d.getDay()
      if (diff <= 0) diff += 7
      d.setDate(d.getDate() + diff)
      return d
    }
  }

  if (pref.includes('bu hafta') || pref.includes('bu_hafta')) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d
  }

  // "22 Nisan", "3 Mayıs" gibi gün+ay formatları
  // "X değil Y" kalıbında Y'yi kullan
  const monthNames: Record<string, number> = {
    ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4,
    haziran: 5, temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
    ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
  }
  const negationMatch = pref.match(/değil\s+(\d{1,2})\s+([a-zışğüöç]+)/)
  const dateMatch = negationMatch ?? pref.match(/(\d{1,2})\s+([a-zışğüöç]+)/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    const monthNum = monthNames[dateMatch[2]]
    if (monthNum !== undefined) {
      const d = new Date(today)
      d.setMonth(monthNum, day)
      if (d < today) d.setFullYear(d.getFullYear() + 1)
      return d
    }
  }

  return today
}

/** Hizmeti ada göre bulur: önce içerir-eşleşme, sonra Türkçe karakterleri sadeleştirilmiş eşleşme (slot ve kayıt aynı kuralı kullanır). */
async function findActiveService(tenantId: string, serviceName: string) {
  const name = serviceName.trim()
  if (!name) return null
  const direct = await db.service.findFirst({ where: { tenantId, name: { contains: name, mode: 'insensitive' }, isActive: true } })
  if (direct) return direct
  const normalizedInput = normalizeTR(name)
  const all = await db.service.findMany({ where: { tenantId, isActive: true } })
  return all.find((s) => normalizeTR(s.name).includes(normalizedInput) || normalizedInput.includes(normalizeTR(s.name))) ?? null
}

// ─── Müsait slotları getir ────────────────────────────────────────────────────

export interface AvailableSlot {
  id: string        // "YYYY-MM-DDTHH:MM:SS__staffId" — slot seçim ID'si olarak kullanılır
  label: string     // "10:00"
  staffId: string
  staffName: string
}

export async function getAvailableSlots(
  tenantId: string,
  serviceName: string,
  datePreference: string | undefined,
  _timePreference: string | undefined,
): Promise<AvailableSlot[]> {
  const date = resolveDate(datePreference)
  const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

  // Tenant slug
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
  if (!tenant) return []

  const service = await findActiveService(tenantId, serviceName)
  if (!service) throw new ServiceNotFoundError(serviceName)

  // Bu hizmeti yapabilen personel listesi
  const staffList = await db.staffProfile.findMany({
    where: {
      tenantId,
      acceptsOnlineBooking: true,
      serviceAssignments: { some: { serviceId: service.id, isActive: true } },
    },
    include: { user: { select: { fullName: true } } },
  })
  if (staffList.length === 0) {
    logger.warn({ tenantId, serviceId: service.id }, 'Bu hizmeti yapabilen personel bulunamadı')
    return []
  }

  const results = await Promise.all(
    staffList.map(async (sp) => {
      const raw = await getSlots({ tenantId, serviceId: service.id, staffId: sp.id, date: dateStr })
      return raw
        .filter((s) => s.available)
        .map((s): AvailableSlot => ({
          id: `${s.id}__${sp.id}`,
          label: s.label,
          staffId: sp.id,
          staffName: sp.user.fullName,
        }))
    }),
  )

  const slots = results.flat().sort((a, b) => a.id.localeCompare(b.id))
  return slots.slice(0, 9)
}

// ─── Randevu oluştur ──────────────────────────────────────────────────────────

export interface CreateAppointmentInput {
  tenantId: string
  customerPhone: string
  customerName: string
  serviceName: string
  slotId: string   // "YYYY-MM-DDTHH:MM:SS__staffId"
  channel: BookingChannel
}

export async function createAppointment(input: CreateAppointmentInput): Promise<string> {
  const { tenantId, customerPhone, customerName, serviceName, slotId, channel } = input

  // slotId'den başlangıç zamanı ve personeli ayır
  const [isoTime, staffId] = slotId.split('__')
  const startAt = new Date(isoTime)

  const service = await findActiveService(tenantId, serviceName)
  if (!service) throw new ServiceNotFoundError(serviceName)

  const endAt = new Date(startAt.getTime() + (service.durationMinutes + service.bufferMinutes) * 60 * 1000)

  // Müşteriyi bul ya da oluştur (upsert by phone)
  const customer = await db.customer.upsert({
    where: { tenantId_phone: { tenantId, phone: customerPhone } },
    create: { tenantId, phone: customerPhone, fullName: customerName },
    update: {},
  })

  const referenceCode = `RDV-${Date.now().toString(36).toUpperCase()}`

  try {
    await db.appointment.create({
      data: {
        tenantId,
        customerId: customer.id,
        staffId,
        serviceId: service.id,
        referenceCode,
        status: 'confirmed',
        bookingChannel: channel,
        startAt,
        endAt,
        priceCharged: service.price,
      },
    })
  } catch (err) {
    // Bot yolunda ön kontrol yok: saat dolduysa veritabanı kısıtı (S3) reddeder.
    if (isSlotOverlapError(err)) throw new SlotTakenError()
    throw err
  }

  // Müşteri ziyaret sayısını artır
  await db.customer.update({
    where: { id: customer.id },
    data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
  })

  return referenceCode
}

// ─── Referans kodu ile randevu iptal et ───────────────────────────────────────

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'too_soon' }

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

/** İptal sahiplik ister: randevunun müşteri kimliği (kanal telefonu/sohbet no) isteği yapanla aynı olmalı; başkasının kodu "bulunamadı" döner (S5 K4). */
export async function cancelAppointmentByRef(
  tenantId: string,
  referenceCode: string,
  customerPhone: string,
): Promise<CancelResult> {
  if (!customerPhone.trim()) return { ok: false, reason: 'not_found' }

  const appointment = await db.appointment.findFirst({
    where: { tenantId, referenceCode, status: { in: ['pending', 'confirmed'] }, customer: { phone: customerPhone } },
  })

  if (!appointment) return { ok: false, reason: 'not_found' }

  if (appointment.startAt.getTime() - Date.now() < TWO_HOURS_MS) {
    return { ok: false, reason: 'too_soon' }
  }

  await db.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled', cancellationReason: 'Müşteri talebiyle iptal' },
  })

  return { ok: true }
}
