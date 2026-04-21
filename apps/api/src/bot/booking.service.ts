import { db } from '../lib/db'
import { logger } from '../lib/logger'
import type { BookingChannel } from '@prisma/client'

// ─── Saat dilimleri (Türkiye: UTC+3) ─────────────────────────────────────────

const TZ_OFFSET_HOURS = 3
const TR_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000

function nowTR(): Date {
  return new Date(Date.now() + TR_OFFSET_MS)
}

// ─── Tercih → Tarih çözücü ────────────────────────────────────────────────────

export function resolveDate(datePreference: string | undefined): Date {
  const today = nowTR()
  today.setHours(0, 0, 0, 0)

  const pref = (datePreference ?? 'date:bugun').replace('date:', '')

  switch (pref) {
    case 'bugun':
      return today
    case 'yarin': {
      const d = new Date(today)
      d.setDate(d.getDate() + 1)
      return d
    }
    case 'bu_hafta': {
      // Bu haftanın ilk müsait günü (yarından itibaren)
      const d = new Date(today)
      d.setDate(d.getDate() + 1)
      return d
    }
    default:
      return today
  }
}

function resolveTimeRange(timePreference: string | undefined): { start: number; end: number } {
  const pref = (timePreference ?? 'time:sabah').replace('time:', '')
  switch (pref) {
    case 'sabah':  return { start: 9,  end: 12 }
    case 'oglen':  return { start: 12, end: 15 }
    case 'aksam':  return { start: 15, end: 19 }
    default:       return { start: 9,  end: 19 }
  }
}

// ─── Mevcut randevulardan boş slotları hesapla ────────────────────────────────

export interface AvailableSlot {
  id: string        // "YYYY-MM-DDTHH:MM:SS" — slot seçim ID'si olarak kullanılır
  label: string     // "10:00"
  staffId: string
  staffName: string
}

export async function getAvailableSlots(
  tenantId: string,
  serviceName: string,
  datePreference: string | undefined,
  timePreference: string | undefined,
): Promise<AvailableSlot[]> {
  const date = resolveDate(datePreference)
  const { start, end } = resolveTimeRange(timePreference)

  // Hizmet bul
  const service = await db.service.findFirst({
    where: { tenantId, name: { contains: serviceName, mode: 'insensitive' }, isActive: true },
  })

  if (!service) {
    logger.warn({ tenantId, serviceName }, 'Hizmet bulunamadı, mock slot dönüyor')
    return mockSlots(date, start, end)
  }

  // Online randevu kabul eden personeli bul
  const staffList = await db.staffProfile.findMany({
    where: { tenantId, acceptsOnlineBooking: true },
    take: 3,
    include: { user: { select: { fullName: true } } },
  })

  if (staffList.length === 0) {
    return mockSlots(date, start, end)
  }

  // date = midnight UTC of TR calendar date; convert TR hour to UTC by subtracting 3h offset
  const dayStart = new Date(date.getTime() + (start - TZ_OFFSET_HOURS) * 60 * 60 * 1000)
  const dayEnd   = new Date(date.getTime() + (end   - TZ_OFFSET_HOURS) * 60 * 60 * 1000)

  // Gün içindeki mevcut randevuları çek
  const existingAppointments = await db.appointment.findMany({
    where: {
      tenantId,
      startAt: { gte: dayStart, lt: dayEnd },
      status: { in: ['pending', 'confirmed', 'in_progress'] },
    },
    select: { staffId: true, startAt: true, endAt: true },
  })

  const slots: AvailableSlot[] = []
  const slotDuration = service.durationMinutes + service.bufferMinutes

  for (const sp of staffList) {
    let cursor = new Date(dayStart)

    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + slotDuration * 60 * 1000)
      if (slotEnd > dayEnd) break

      const hasConflict = existingAppointments.some(
        (a: { staffId: string; startAt: Date; endAt: Date }) =>
          a.staffId === sp.id &&
          a.startAt < slotEnd &&
          a.endAt > cursor,
      )

      if (!hasConflict) {
        // cursor is UTC; add offset to get TR display time
        const trCursor = new Date(cursor.getTime() + TR_OFFSET_MS)
        const hh = trCursor.getUTCHours().toString().padStart(2, '0')
        const mm = trCursor.getUTCMinutes().toString().padStart(2, '0')
        // id stores UTC ISO so createAppointment parses it correctly
        const isoSlot = cursor.toISOString().slice(0, 19)

        slots.push({
          id: `${isoSlot}__${sp.id}`,
          label: `${hh}:${mm}`,
          staffId: sp.id,
          staffName: sp.user.fullName,
        })
      }

      cursor = new Date(cursor.getTime() + 30 * 60 * 1000) // 30 dk adım
    }
  }

  // Her 30 dk'da bir max 6 slot göster (UI'da yönetilebilir)
  return slots.slice(0, 6)
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

  // Hizmet bul
  const service = await db.service.findFirst({
    where: { tenantId, name: { contains: serviceName, mode: 'insensitive' }, isActive: true },
  })

  if (!service) throw new Error(`Hizmet bulunamadı: ${serviceName}`)

  const endAt = new Date(startAt.getTime() + (service.durationMinutes + service.bufferMinutes) * 60 * 1000)

  // Müşteriyi bul ya da oluştur (upsert by phone)
  const customer = await db.customer.upsert({
    where: { tenantId_phone: { tenantId, phone: customerPhone } },
    create: { tenantId, phone: customerPhone, fullName: customerName },
    update: {},
  })

  const referenceCode = `RDV-${Date.now().toString(36).toUpperCase()}`

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

  // Müşteri ziyaret sayısını artır
  await db.customer.update({
    where: { id: customer.id },
    data: { totalVisits: { increment: 1 }, lastVisitAt: new Date() },
  })

  return referenceCode
}

// ─── Referans kodu ile randevu iptal et ───────────────────────────────────────

export async function cancelAppointmentByRef(
  tenantId: string,
  referenceCode: string,
): Promise<boolean> {
  const appointment = await db.appointment.findFirst({
    where: { tenantId, referenceCode, status: { in: ['pending', 'confirmed'] } },
  })

  if (!appointment) return false

  await db.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled', cancellationReason: 'Müşteri talebiyle iptal' },
  })

  return true
}

// ─── Mock slot (DB'de henüz tenant/personel yoksa) ────────────────────────────

function mockSlots(date: Date, startH: number, endH: number): AvailableSlot[] {
  const slots: AvailableSlot[] = []
  const dateStr = date.toISOString().slice(0, 10)
  const mockStaffId = 'mock-staff'

  for (let h = startH; h < endH; h += 2) {
    const hh = h.toString().padStart(2, '0')
    slots.push({
      id: `${dateStr}T${hh}:00:00__${mockStaffId}`,
      label: `${hh}:00`,
      staffId: mockStaffId,
      staffName: 'Uygun Uzman',
    })
  }
  return slots.slice(0, 3)
}
