import { db } from './db'
import { logger } from './logger'
import { remindersQueue } from './queue'
import { Prisma } from '@prisma/client'
import { normalizePhoneTR } from './sms/types'

const HOUR_MS = 60 * 60 * 1000

/** ADR-0034: SMS dogrulamasi yokken online talebi sinirlayan tavanlar ve sure dolumu. */
export const ONLINE_LIMITS = {
  ipPerHour: 3,
  pendingPerTenantPerDay: 20,
  expiryHours: 24,
  expiryLeadHours: 2,
} as const

export type DecisionResult = 'ok' | 'not_found' | 'not_pending'

export interface CustomerCandidate {
  id: string
  fullName: string
}

export type ApproveResult =
  | DecisionResult
  | { result: 'match_required'; candidates: CustomerCandidate[] }
  | { result: 'customer_not_found' }
  | { result: 'customer_phone_mismatch' }

export interface ApproveInput {
  customerAction?: 'create' | 'link'
  customerId?: string
}

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

/** Reddedilen/süresi dolan doğrulanmamış talebin ad ve telefonu bu süre sonra anonimleştirilir (hukuk-uyum: en geç 30 gün). */
export const REQUEST_RETENTION_DAYS = 30
export const ANONYMIZED = '-'

/** Gece taraması: iptal olmuş musterisiz taleplerde requestedName/requestedPhone silinir (CHECK için '-' ile doldurulur). */
export async function anonymizeStaleRequests(now: Date = new Date()): Promise<number> {
  const result = await db.appointment.updateMany({
    where: {
      customerId: null,
      status: 'cancelled',
      updatedAt: { lte: new Date(now.getTime() - REQUEST_RETENTION_DAYS * 24 * HOUR_MS) },
      NOT: { requestedPhone: ANONYMIZED },
    },
    data: { requestedName: ANONYMIZED, requestedPhone: ANONYMIZED },
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

const CANDIDATE_LIMIT = 5

/** Talepteki normalize telefonla kayıtlı müşteriler (tüm biçimler); salon bilinçli seçsin diye en çok 5. */
export async function findCustomerCandidates(tenantId: string, requestedPhone: string): Promise<CustomerCandidate[]> {
  return db.customer.findMany({
    where: { tenantId, phone: { in: phoneVariants(requestedPhone) } },
    orderBy: { createdAt: 'asc' },
    take: CANDIDATE_LIMIT,
    select: { id: true, fullName: true },
  })
}

/** Müşterisi bağlı (doğrulanmış) talep: yalnız durum değişir. */
async function confirmLinkedRequest(tenantId: string, appointmentId: string): Promise<DecisionResult> {
  const result = await db.appointment.updateMany({
    where: { id: appointmentId, tenantId, status: 'pending', isDeleted: false },
    data: { status: 'confirmed' },
  })
  if (result.count === 0) return explainNoChange(tenantId, appointmentId)
  await removeExpiryJob(appointmentId)
  return 'ok'
}

/**
 * Doğrulanmamış talep: müşteri otomatik eşleştirilmez (KVKK). Salon ya yeni müşteri oluşturur ya da
 * telefonu talepteki telefonla eşleşen bir müşteriyi seçer. customerId yazımı koşulludur (customerId IS NULL, pending).
 */
async function confirmUnverifiedRequest(
  tenantId: string,
  appointmentId: string,
  requested: { name: string; phone: string },
  input: ApproveInput,
): Promise<ApproveResult> {
  if (input.customerAction === 'link') {
    const customer = input.customerId
      ? await db.customer.findFirst({ where: { id: input.customerId, tenantId }, select: { id: true, phone: true } })
      : null
    if (!customer) return { result: 'customer_not_found' }
    if (normalizePhoneTR(customer.phone) !== requested.phone) return { result: 'customer_phone_mismatch' }
    const linked = await db.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: 'pending', customerId: null, isDeleted: false },
      data: { customerId: customer.id, status: 'confirmed' },
    })
    if (linked.count !== 1) return explainNoChange(tenantId, appointmentId)
    await removeExpiryJob(appointmentId)
    return 'ok'
  }

  const candidates = await findCustomerCandidates(tenantId, requested.phone)
  if (candidates.length > 0) return { result: 'match_required', candidates }
  try {
    const outcome = await db.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: { tenantId, phone: requested.phone, fullName: requested.name },
        select: { id: true },
      })
      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId, status: 'pending', customerId: null, isDeleted: false },
        data: { customerId: created.id, status: 'confirmed' },
      })
      if (updated.count !== 1) throw new RequestNotPendingError()
      return 'ok' as const
    })
    await removeExpiryJob(appointmentId)
    return outcome
  } catch (err) {
    if (err instanceof RequestNotPendingError) return explainNoChange(tenantId, appointmentId)
    // Eş zamanlı bir kayıt aynı telefonla müşteri oluşturdu (unique tenantId+phone): salon yeniden seçsin.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { result: 'match_required', candidates: await findCustomerCandidates(tenantId, requested.phone) }
    }
    throw err
  }
}

class RequestNotPendingError extends Error {}

export async function approveOnlineRequest(tenantId: string, appointmentId: string, input: ApproveInput = {}): Promise<ApproveResult> {
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId, isDeleted: false },
    select: { status: true, customerId: true, requestedName: true, requestedPhone: true },
  })
  if (!appointment) return 'not_found'
  if (appointment.status !== 'pending') return 'not_pending'
  if (appointment.customerId) return confirmLinkedRequest(tenantId, appointmentId)
  if (!appointment.requestedName || !appointment.requestedPhone) return 'not_found'
  return confirmUnverifiedRequest(tenantId, appointmentId, { name: appointment.requestedName, phone: appointment.requestedPhone }, input)
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
