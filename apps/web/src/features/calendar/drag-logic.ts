import { availableActions } from '@/features/appointment-detail/actions'
import { clockDative } from '@/features/appointments/until-label'
import { minutesLabel, type DayAppointment, type StripRange } from '@/features/appointments/day-logic'

// Sürükle-bırak saf mantığı (W15). Taşıma yalnız aynı personelin sütununda ve aynı gün içinde yapılır
// (sunucudaki saat değiştirme ucu yalnız başlangıç saatini alır). Karar sunucuda: bu dosya yalnız arayüzü yönlendirir.
export const SNAP_MIN = 15

/** Taşınabilir: ayrıntı katmanındaki "Saati değiştir" kuralı + başlangıcı henüz gelmemiş. */
export function isMovable(a: DayAppointment, ctx: { canReschedule: boolean; now: Date }): boolean {
  if (a.start.getTime() <= ctx.now.getTime()) return false
  return availableActions(a.status, {
    canReschedule: ctx.canReschedule,
    canDelete: false,
    hasService: a.serviceId !== null,
  }).includes('reschedule')
}

export type DropTarget = {
  startMin: number
  endMin: number
  startAt: string
  /** Yalnız geçmişe bırakmak geçersizdir; çakışmayı sunucu (SLOT_TAKEN) karara bağlar. */
  valid: boolean
  reason?: 'past'
  /** Özgün saatten farklı mı (aynı dilime bırakmak istek göndermez). */
  changed: boolean
}

export function dropTarget(input: {
  startMin: number
  durationMin: number
  deltaPx: number
  hourPx: number
  range: StripRange
  date: string
  nowMs: number
}): DropTarget {
  const { startMin, durationMin, deltaPx, hourPx, range, date, nowMs } = input
  const deltaMin = (deltaPx / hourPx) * 60
  // Yarım dilimden az kaydırma "yerinde bırakma"dır; 10:10 gibi dilime oturmayan randevu yanlışlıkla 10:15'e kaymaz.
  const snapped = Math.abs(deltaMin) < SNAP_MIN / 2 ? startMin : Math.round((startMin + deltaMin) / SNAP_MIN) * SNAP_MIN
  const lastStart = Math.max(range.startMin, range.endMin - durationMin)
  const target = Math.min(Math.max(snapped, range.startMin), lastStart)
  // İstanbul sabit UTC+3 (yaz saati uygulaması yok).
  const startAt = new Date(`${date}T${minutesLabel(target)}:00+03:00`).toISOString()
  const past = new Date(startAt).getTime() <= nowMs
  return {
    startMin: target,
    endMin: target + durationMin,
    startAt,
    valid: !past,
    reason: past ? 'past' : undefined,
    changed: target !== startMin,
  }
}

export function moveToast(clock: string): string {
  return `Randevu ${clockDative(clock)} taşındı.`
}
