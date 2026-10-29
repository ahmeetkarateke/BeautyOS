import { db } from './db'
import { logger } from './logger'
import { remindersQueue } from './queue'
import { normalizePhoneTR } from './sms/types'

const HOUR_MS = 60 * 60 * 1000

/** ADR-0034: SMS dogrulamasi yokken online talebi sinirlayan tavanlar ve sure dolumu. */
export const ONLINE_LIMITS = {
  ipPerHour: 3,
  pendingPerPhone: 1,
  pendingPerTenantPerDay: 20,
  expiryHours: 24,
  expiryLeadHours: 2,
} as const

export type DecisionResult = 'ok' | 'not_found' | 'not_pending'

/** Kayitli musteri telefonu farkli bicimde olabilir; ayni numaranin tum bicimlerini dondurur. */
export function phoneVariants(raw: string): string[] {
  const normalized = normalizePhoneTR(raw)
  if (!normalized) return []
  const digits = normalized.replace(/\D/g, '')
  if (!digits.startsWith('90') || digits.length !== 12) return [normalized]
  const national = digits.slice(2)
  return [`+${digits}`, `0${national}`, national, digits]
}

/** Son tarih: talepten 24 saat sonra ya da randevudan 2 saat once; hangisi once ise. */
export function computeExpiryAt(createdAt: Date, startAt: Date): Date {
  const byAge = createdAt.getTime() + ONLINE_LIMITS.expiryHours * HOUR_MS
  const byStart = startAt.getTime() - ONLINE_LIMITS.expiryLeadHours * HOUR_MS
  return new Date(Math.min(byAge, byStart))
}

export function expiryJobId(appointmentId: string): string {
  return `online-expire-${appointmentId}`
}

/** Belirlenimci kimlikle kurulur (iki is olusmaz). Kuyruk hatasi false doner; gece taramasi yedektir. */
export async function scheduleOnlineExpiry(appointmentId: string, expiresAt: Date, now: Date = new Date()): Promise<boolean> {
  try {
    await remindersQueue.add(
      'online-expire',
      { type: 'online_expire', appointmentId },
      { jobId: expiryJobId(appointmentId), delay: Math.max(0, expiresAt.getTime() - now.getTime()) },
    )
    return true
  } catch (err) {
    logger.error({ err, appointmentId }, 'Online talep süre dolumu işi kurulamadı')
    return false
  }
}

/** Yalniz hala bekleyen web talebini iptal eder; atomik, onaylanmis talebe dokunmaz. */
export async function expireOnlineRequest(appointmentId: string): Promise<boolean> {
  const result = await db.appointment.updateMany({
    where: { id: appointmentId, status: 'pending', bookingChannel: 'web' },
    data: { status: 'cancelled', cancelReason: 'expired' },
  })
  return result.count > 0
}

/** Gece taramasi: kuyruk isi kaybolmus suresi dolan bekleyen talepleri iptal eder. */
export async function sweepExpiredOnlineRequests(now: Date = new Date()): Promise<number> {
  const result = await db.appointment.updateMany({
    where: {
      status: 'pending',
      bookingChannel: 'web',
      OR: [
        { createdAt: { lte: new Date(now.getTime() - ONLINE_LIMITS.expiryHours * HOUR_MS) } },
        { startAt: { lte: new Date(now.getTime() + ONLINE_LIMITS.expiryLeadHours * HOUR_MS) } },
      ],
    },
    data: { status: 'cancelled', cancelReason: 'expired' },
  })
  return result.count
}

async function removeExpiryJob(appointmentId: string): Promise<void> {
  try {
    await remindersQueue.remove(expiryJobId(appointmentId))
  } catch (err) {
    logger.warn({ err, appointmentId }, 'Süre dolumu işi kaldırılamadı')
  }
}

async function explainNoChange(tenantId: string, appointmentId: string): Promise<'not_found' | 'not_pending'> {
  const existing = await db.appointment.findFirst({ where: { id: appointmentId, tenantId }, select: { status: true } })
  return existing ? 'not_pending' : 'not_found'
}

export async function approveOnlineRequest(tenantId: string, appointmentId: string): Promise<DecisionResult> {
  const result = await db.appointment.updateMany({
    where: { id: appointmentId, tenantId, status: 'pending', isDeleted: false },
    data: { status: 'confirmed' },
  })
  if (result.count === 0) return explainNoChange(tenantId, appointmentId)
  await removeExpiryJob(appointmentId)
  return 'ok'
}

export async function rejectOnlineRequest(tenantId: string, appointmentId: string, userId: string): Promise<DecisionResult> {
  const result = await db.appointment.updateMany({
    where: { id: appointmentId, tenantId, status: 'pending', isDeleted: false },
    data: { status: 'cancelled', cancelReason: 'rejected', cancelledById: userId },
  })
  if (result.count === 0) return explainNoChange(tenantId, appointmentId)
  await removeExpiryJob(appointmentId)
  return 'ok'
}
