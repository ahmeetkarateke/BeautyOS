import { z } from 'zod'
import { getInitials } from '@/ui/avatar'
import { nameKey, type DayAppointment } from './day-logic'
import { toneForIndex, type Tone } from './tones'

// GET /staff satırı -> görünüm modeli. Hizmet atanmış olanlar "hizmet veren"dir (resepsiyon/yönetici şeritte yer almaz).
const staffRow = z.object({
  id: z.string(),
  title: z.string().nullish(),
  fullName: z.string(),
  colorCode: z.string().nullish(),
  skills: z.array(z.object({ serviceId: z.string() })).optional(),
})

export type StaffMember = { id: string; name: string; short: string; title: string; initials: string; tone: Tone; givesService: boolean; /** Verdiği hizmetler (GET /staff skills). Yoksa bilinmiyor. */ serviceIds?: string[] }

export function parseStaffList(input: unknown): StaffMember[] {
  const rows = z.object({ data: z.array(staffRow) }).parse(input).data
  return rows.map((row, index) => ({
    id: row.id,
    name: row.fullName,
    short: row.fullName.trim().split(/\s+/)[0] ?? row.fullName,
    title: row.title ?? '',
    initials: getInitials(row.fullName),
    tone: toneForIndex(index),
    givesService: (row.skills?.length ?? 0) > 0,
    serviceIds: row.skills?.map((skill) => skill.serviceId),
  }))
}

/** Randevudaki kişi anahtarını personel kimliğine çevirir (A4 öncesi ad ile eşleşir). Bulunamazsa anahtar olduğu gibi kalır. */
export function attachStaff(appointments: readonly DayAppointment[], staff: readonly StaffMember[]): DayAppointment[] {
  const byKey = new Map<string, string>()
  for (const s of staff) {
    byKey.set(s.id, s.id)
    byKey.set(nameKey(s.name), s.id)
  }
  return appointments.map((a) => ({ ...a, staffKey: byKey.get(a.staffKey) ?? a.staffKey }))
}
