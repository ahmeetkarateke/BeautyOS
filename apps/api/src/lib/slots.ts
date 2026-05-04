import { db } from './db'

const TZ_OFFSET_HOURS = 3
const TR_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function parseHours(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m ?? 0) / 60
}

export interface SlotResult {
  id: string
  label: string
  available: boolean
}

export interface GetSlotsInput {
  tenantId: string
  serviceId: string
  staffId: string
  date: string // YYYY-MM-DD
}

export async function getSlots(input: GetSlotsInput): Promise<SlotResult[]> {
  const { tenantId, serviceId, staffId, date } = input

  const service = await db.service.findFirst({
    where: { id: serviceId, tenantId, isActive: true, isOnlineBookable: true },
    select: { durationMinutes: true, bufferMinutes: true },
  })
  if (!service) return []

  const staffProfile = await db.staffProfile.findFirst({
    where: {
      id: staffId,
      tenantId,
      serviceAssignments: { some: { serviceId, isActive: true } },
    },
    select: { id: true, workingHours: true },
  })
  if (!staffProfile) return []

  const dateObj = new Date(`${date}T00:00:00Z`)

  const leaveEnd = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000)
  const onLeave = await db.staffLeave.findFirst({
    where: { staffId, tenantId, leaveDate: { gte: dateObj, lt: leaveEnd } },
  })
  if (onLeave) return []

  const wh = staffProfile.workingHours as Record<string, { start: string; end: string } | null>
  const dayKey = DAY_KEYS[dateObj.getUTCDay()]
  const daySchedule = wh[dayKey]
  if (!daySchedule?.start || !daySchedule?.end) return []

  const workStart = parseHours(daySchedule.start)
  const workEnd = parseHours(daySchedule.end)

  const fullDayStart = new Date(dateObj.getTime() + (0 - TZ_OFFSET_HOURS) * 60 * 60 * 1000)
  const fullDayEnd = new Date(dateObj.getTime() + (24 - TZ_OFFSET_HOURS) * 60 * 60 * 1000)

  const existingAppointments = await db.appointment.findMany({
    where: {
      tenantId,
      staffId,
      isDeleted: false,
      startAt: { gte: fullDayStart, lt: fullDayEnd },
      status: { in: ['pending', 'confirmed', 'in_progress'] },
    },
    select: { startAt: true, endAt: true },
  })

  const slotDuration = service.durationMinutes + service.bufferMinutes
  const cursorStart = new Date(dateObj.getTime() + (workStart - TZ_OFFSET_HOURS) * 60 * 60 * 1000)
  const cursorEnd = new Date(dateObj.getTime() + (workEnd - TZ_OFFSET_HOURS) * 60 * 60 * 1000)

  const slots: SlotResult[] = []
  let cursor = new Date(cursorStart)

  while (cursor < cursorEnd) {
    const slotEnd = new Date(cursor.getTime() + slotDuration * 60 * 1000)
    if (slotEnd > cursorEnd) break

    const hasConflict = existingAppointments.some(
      (a) => a.startAt < slotEnd && a.endAt > cursor,
    )

    const trCursor = new Date(cursor.getTime() + TR_OFFSET_MS)
    const hh = trCursor.getUTCHours().toString().padStart(2, '0')
    const mm = trCursor.getUTCMinutes().toString().padStart(2, '0')

    slots.push({
      id: cursor.toISOString().slice(0, 19),
      label: `${hh}:${mm}`,
      available: !hasConflict,
    })

    cursor = new Date(cursor.getTime() + slotDuration * 60 * 1000)
  }

  return slots
}
