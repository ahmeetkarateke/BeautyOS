import type { AppointmentStatus } from '@/features/appointments/day-logic'

// Randevu ayrıntısında hangi eylemlerin görüneceğini durum + yetki belirler (sunucu yine her isteği doğrular).
export type DetailAction = 'start' | 'complete' | 'reschedule' | 'noShow' | 'cancel' | 'delete'

export type ActionContext = { canReschedule: boolean; canDelete: boolean; hasService: boolean }

const LOCKED: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no_show']

export function isLocked(status: AppointmentStatus): boolean {
  return LOCKED.includes(status)
}

export function availableActions(status: AppointmentStatus, ctx: ActionContext): DetailAction[] {
  if (isLocked(status)) return []
  if (status === 'in_progress') return ['complete']
  const list: DetailAction[] = []
  if (status === 'confirmed') list.push('start')
  if (ctx.canReschedule && ctx.hasService) list.push('reschedule')
  if (status === 'confirmed') list.push('noShow')
  list.push('cancel')
  if (ctx.canDelete) list.push('delete')
  return list
}

/** tel: ve WhatsApp bağlantıları için rakamlar; 0 ile başlayan ulusal numara 90'a çevrilir. */
export function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const intl = digits.startsWith('90') && digits.length === 12 ? digits : digits.startsWith('0') && digits.length === 11 ? `9${digits}` : digits.length === 10 ? `90${digits}` : null
  return intl ? `https://wa.me/${intl}` : null
}
