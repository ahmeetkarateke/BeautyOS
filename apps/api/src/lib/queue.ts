import { Queue, Worker, UnrecoverableError, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { DeliveryPurpose } from '@prisma/client'
import { db } from './db'
import { logger } from './logger'
import { sendSms, normalizePhoneTR, getSmsProvider } from './sms'
import { sendReminderEmail, isEmailConfigured } from './email'
import { anonymizeStaleRequests, expireOnlineRequest, sweepExpiredOnlineRequests } from './online-booking'
import { purgeExpiredSessions } from './sessions'
import { isHealthRegulated } from '@beautyos/shared'
import { istanbulDayBounds } from './time'

// tenantId yeni işlerde bulunur; kuyrukta bekleyen eski işlerde yoktur (okuma filtresi o zaman yalnız id'dir).
export type ReminderJobData =
  | { type: 'reminder_24h'; appointmentId: string; tenantId?: string }
  | { type: 'reminder_2h'; appointmentId: string; tenantId?: string }
  | { type: 'nightly_noshow' }
  | { type: 'online_expire'; appointmentId: string }

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connections: IORedis[] = []

function createConnection() {
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  connections.push(connection)
  return connection
}

/** SIGTERM kapanışı: bu modülün açtığı tüm Redis bağlantılarını kapatır (kuyruk ve işçi kapandıktan sonra çağrılır). */
export async function closeRedisConnections(): Promise<void> {
  await Promise.all(connections.map((c) => c.quit().catch(() => c.disconnect())))
}

// ADR-0044: 5 deneme, bekleme 60 sn'den başlayıp katlanır (yaklaşık 1, 2, 4, 8, 16 dk).
export const remindersQueue = new Queue<ReminderJobData>('reminders', {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

const HOUR_MS = 60 * 60 * 1000
const RECONCILE_WINDOW_MS = 48 * HOUR_MS
const DUPLICATE_WINDOW_MS = 6 * HOUR_MS
// Netgsm'in yeniden denemeyle düzelmeyecek kodları: metin, başlık, IYS onayı, parametre. Diğerleri (ağ, 85, 99, bilinmeyen) geçici sayılır.
const PERMANENT_SMS_CODES: ReadonlySet<string> = new Set(['20', '40', '50', '51', '70'])

const reminderJobId = (kind: '24h' | '2h', appointmentId: string) => `reminder-${kind}-${appointmentId}`

/** Hatırlatma işlerini belirlenimci kimlikle kurar; geçmişe düşen zamanlar eklenmez, var olan iş tekrarlanmaz. */
export async function scheduleReminders(input: { appointmentId: string; tenantId: string; startAt: Date; now?: Date }): Promise<void> {
  const nowMs = (input.now ?? new Date()).getTime()
  const startMs = input.startAt.getTime()
  const plan: Array<{ kind: '24h' | '2h'; type: 'reminder_24h' | 'reminder_2h'; delay: number }> = [
    { kind: '24h', type: 'reminder_24h', delay: startMs - 24 * HOUR_MS - nowMs },
    { kind: '2h', type: 'reminder_2h', delay: startMs - 2 * HOUR_MS - nowMs },
  ]
  for (const item of plan) {
    if (item.delay <= 0) continue
    await remindersQueue.add(
      `reminder-${item.kind}`,
      { type: item.type, appointmentId: input.appointmentId, tenantId: input.tenantId },
      { delay: item.delay, jobId: reminderJobId(item.kind, input.appointmentId) },
    )
  }
}

/** Randevunun bekleyen hatırlatma işlerini kaldırır (iptal, taşıma, ret). Hata yutulur: hatırlatma ikincil iştir. */
export async function cancelReminders(appointmentId: string): Promise<void> {
  for (const kind of ['24h', '2h'] as const) {
    try {
      await remindersQueue.remove(reminderJobId(kind, appointmentId))
    } catch (err) {
      logger.warn({ err, appointmentId }, 'Hatırlatma işi kaldırılamadı')
    }
  }
}

function reminderText(
  type: 'reminder_24h' | 'reminder_2h',
  parts: { salonName: string; fullName: string; time: string; serviceName: string | null },
): string {
  // Klinik türlerinde hizmet adı mesajda geçmez (hukuk-uyum §10.7): serviceName null gelir.
  const service = parts.serviceName ? ` ${parts.serviceName}` : ''
  return type === 'reminder_24h'
    ? `${parts.salonName}: Sayın ${parts.fullName}, yarın saat ${parts.time}'de${service} randevunuz bulunmaktadır. Bilginize.`
    : `${parts.salonName}: Sayın ${parts.fullName}, bugün saat ${parts.time}'de${service} randevunuz vardır. Sizi bekliyoruz.`
}

export async function processReminderJob(data: ReminderJobData): Promise<void> {
  if (data.type === 'nightly_noshow') {
    await sweepExpiredOnlineRequests()
    await anonymizeStaleRequests()
    await purgeExpiredSessions()
    await processNightlyNoShow()
    await reconcileReminders()
    return
  }
  if (data.type === 'online_expire') {
    if (await expireOnlineRequest(data.appointmentId)) {
      logger.info({ appointmentId: data.appointmentId }, 'Online talep süresi doldu, iptal edildi')
    }
    return
  }

  const { appointmentId, type } = data

  // Sorgu hatası yutulmaz: iş başarısız olur ve BullMQ yeniden dener.
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, ...(data.tenantId ? { tenantId: data.tenantId } : {}), isDeleted: false },
    include: {
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      service: { select: { name: true } },
      tenant: { select: { id: true, name: true, businessType: true } },
    },
  })

  if (!appointment) {
    logger.info({ appointmentId, reason: 'not_found_or_deleted' }, 'Hatırlatma atlandı')
    return
  }

  // Yalnız onaylı randevuya hatırlatma gider (bekleyen, iptal, tamamlanmış, gelinmemiş, sürmekte olan değil).
  if (appointment.status !== 'confirmed') {
    logger.info({ appointmentId, status: appointment.status }, 'Randevu onaylı değil, hatırlatma atlandı')
    return
  }

  // Doğrulanmamış online talepte müşteri henüz yoktur (onayda bağlanır); hatırlatma gönderilecek kişi yok.
  if (!appointment.customer) {
    logger.info({ appointmentId }, 'Randevuya bağlı müşteri yok, hatırlatma atlandı')
    return
  }
  const { id: customerId, fullName, phone, email } = appointment.customer

  const time = appointment.startAt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
  const salonName = appointment.tenant.name
  const serviceName = isHealthRegulated(appointment.tenant.businessType) ? null : appointment.service.name
  const text = reminderText(type, { salonName, fullName, time, serviceName })

  const purpose = type === 'reminder_24h' ? DeliveryPurpose.reminder_24h : DeliveryPurpose.reminder_2h

  // Çift gönderim önlemi (ADR-0044 riski): aynı randevu ve tür için yakın zamanda gönderilmiş kayıt varsa tekrar gönderilmez
  // (yeniden deneme, uzlaştırma ya da çift iş). Pencere kısa tutulur ki saati değişen randevunun yeni hatırlatması engellenmesin.
  const alreadySent = await db.messageDelivery.findFirst({
    where: {
      appointmentId,
      purpose,
      status: { in: ['sent', 'delivered'] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
  })
  if (alreadySent) {
    logger.info({ appointmentId, type }, 'Hatırlatma zaten gönderilmiş, atlandı')
    return
  }

  // Kanal: SMS (sağlayıcı gerçek ve telefon geçerli) → e-posta yedeği → atla.
  const normalized = normalizePhoneTR(phone)
  if (getSmsProvider().name !== 'mock' && normalized) {
    const { result } = await sendSms({
      tenantId: appointment.tenantId,
      customerId,
      appointmentId,
      to: normalized,
      body: text,
      purpose,
    })
    if (result.success) {
      logger.info({ appointmentId, type, provider: result.providerName }, 'Hatırlatma SMS gönderildi')
      return
    }
    logger.error({ appointmentId, type, code: result.errorCode }, 'Hatırlatma SMS başarısız')
    if (result.errorCode && PERMANENT_SMS_CODES.has(result.errorCode)) {
      throw new UnrecoverableError('Hatırlatma SMS kalıcı hata')
    }
    // Geçici hata: BullMQ yeniden denesin; son denemede iş "failed" kalır.
    throw new Error('Hatırlatma SMS gönderilemedi')
  }

  if (email && isEmailConfigured()) {
    const sent = await sendReminderEmail({ to: email, salonName, text })
    if (!sent) throw new Error('Hatırlatma e-postası gönderilemedi')
    // E-posta teslim kaydı: sonraki deneme ya da uzlaştırma aynı hatırlatmayı tekrar göndermesin.
    await db.messageDelivery
      .create({
        data: { tenantId: appointment.tenantId, customerId, appointmentId, channel: 'email', purpose, email, body: text, status: 'sent', providerName: 'resend', sentAt: new Date() },
      })
      .catch((err) => logger.warn({ err, appointmentId }, 'E-posta teslim kaydı yazılamadı'))
    logger.info({ appointmentId, type, channel: 'email' }, 'Hatırlatma e-postası gönderildi')
    return
  }

  logger.info({ appointmentId, type }, 'Uygun kanal yok (SMS ve e-posta), hatırlatma atlandı')
}

/**
 * Gece uzlaştırma: önümüzdeki 48 saatteki onaylı randevuların hatırlatma işlerini belirlenimci kimlikle yeniden kurar.
 * Redis yedeklenmediği için kayıp işler böylece geri gelir; var olan iş tekrarlanmaz (aynı jobId).
 */
async function reconcileReminders(): Promise<void> {
  const now = new Date()
  const upcoming = await db.appointment.findMany({
    where: {
      status: 'confirmed',
      isDeleted: false,
      startAt: { gt: now, lte: new Date(now.getTime() + RECONCILE_WINDOW_MS) },
    },
    select: { id: true, tenantId: true, startAt: true },
  })
  for (const appt of upcoming) {
    try {
      await scheduleReminders({ appointmentId: appt.id, tenantId: appt.tenantId, startAt: appt.startAt, now })
    } catch (err) {
      logger.error({ err, appointmentId: appt.id }, 'Hatırlatma uzlaştırılamadı')
    }
  }
  logger.info({ count: upcoming.length }, 'Hatırlatma uzlaştırması tamamlandı')
}

/**
 * Gece no-show: biten ama kapanmamış randevuları "gelmedi" yapar. Güncelleme koşulludur (araya giren tamamlama ezilmez);
 * müşteriye mesaj gönderilmez (ayrı ürün kararı, ADR-0044).
 */
async function processNightlyNoShow(): Promise<void> {
  const now = new Date()
  // Konteyner TZ=UTC; "bugün" İstanbul gününe göre hesaplanır.
  const { start: todayStart, end: todayEnd } = istanbulDayBounds(now)

  const stale = await db.appointment.findMany({
    where: {
      status: { in: ['pending', 'confirmed'] },
      isDeleted: false,
      endAt: { lt: now },
      startAt: { gte: todayStart, lte: todayEnd },
    },
    select: { id: true, tenantId: true },
  })

  logger.info({ count: stale.length }, 'No-show işlenecek randevu sayısı')

  for (const appt of stale) {
    try {
      await db.appointment.updateMany({
        where: { id: appt.id, tenantId: appt.tenantId, status: { in: ['pending', 'confirmed'] } },
        data: { status: 'no_show' },
      })
    } catch (err) {
      logger.error({ err, appointmentId: appt.id }, 'No-show işlenirken hata')
    }
  }
}

export function startReminderWorker(): Worker<ReminderJobData> {
  const worker = new Worker<ReminderJobData>(
    'reminders',
    async (job: Job<ReminderJobData>) => {
      await processReminderJob(job.data)
    },
    {
      connection: createConnection(),
      concurrency: 5,
    },
  )

  // Her gece 23:30 TR (UTC 20:30)
  remindersQueue.add(
    'nightly-noshow',
    { type: 'nightly_noshow' },
    {
      repeat: { pattern: '30 20 * * *' },
      jobId: 'nightly-noshow-recurring',
      removeOnComplete: true,
      removeOnFail: false,
    },
  ).catch((err) => logger.error({ err }, 'Nightly no-show job eklenemedi'))

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Hatırlatma job tamamlandı')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, type: job?.data?.type, err }, 'Hatırlatma job başarısız')
  })

  return worker
}
