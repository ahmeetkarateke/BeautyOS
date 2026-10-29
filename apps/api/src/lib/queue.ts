import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { DeliveryPurpose } from '@prisma/client'
import { db } from './db'
import { logger } from './logger'
import { sendSms, normalizePhoneTR } from './sms'

export type ReminderJobData =
  | { type: 'reminder_24h'; appointmentId: string }
  | { type: 'reminder_2h'; appointmentId: string }
  | { type: 'nightly_noshow' }

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

function createConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export const remindersQueue = new Queue<ReminderJobData>('reminders', {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

export async function processReminderJob(data: ReminderJobData): Promise<void> {
  if (data.type === 'nightly_noshow') {
    await processNightlyNoShow()
    return
  }

  const { appointmentId, type } = data

  let appointment
  try {
    appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, marketingConsentSms: true } },
        service: { select: { name: true } },
        tenant: { select: { id: true, name: true } },
      },
    })
  } catch (err) {
    logger.warn({ err, appointmentId }, 'Randevu sorgulanırken hata, hatırlatma atlandı')
    return
  }

  if (!appointment) {
    logger.warn({ appointmentId }, 'Randevu bulunamadı, hatırlatma atlandı')
    return
  }

  // Sadece pending/confirmed/in_progress randevular için hatırlatma at
  if (!['pending', 'confirmed', 'in_progress'].includes(appointment.status)) {
    logger.info({ appointmentId, status: appointment.status }, 'Randevu aktif değil, hatırlatma atlandı')
    return
  }

  const saat = appointment.startAt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })

  const { id: customerId, fullName, phone } = appointment.customer
  const serviceName = appointment.service.name
  const salonName = appointment.tenant.name

  const text =
    type === 'reminder_24h'
      ? `${salonName}: Sayın ${fullName}, yarın saat ${saat}'de ${serviceName} randevunuz bulunmaktadır. Bilginize.`
      : `${salonName}: Sayın ${fullName}, bugün saat ${saat}'de ${serviceName} randevunuz vardır. Sizi bekliyoruz.`

  // SMS gönder
  const normalized = normalizePhoneTR(phone)
  if (!normalized) {
    logger.warn({ appointmentId }, 'Telefon normalize edilemedi, hatırlatma atlandı')
    return
  }

  const purpose = type === 'reminder_24h' ? DeliveryPurpose.reminder_24h : DeliveryPurpose.reminder_2h
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
  } else {
    logger.error({ appointmentId, type, error: result.errorMessage }, 'Hatırlatma SMS başarısız')
  }
}

async function processNightlyNoShow(): Promise<void> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const staleAppointments = await db.appointment.findMany({
    where: {
      status: { in: ['pending', 'confirmed', 'in_progress'] },
      endAt: { lt: now },
      startAt: { gte: todayStart, lte: todayEnd },
    },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      service: { select: { name: true } },
      tenant: { select: { id: true, name: true } },
    },
  })

  logger.info({ count: staleAppointments.length }, 'No-show işlenecek randevu sayısı')

  for (const appt of staleAppointments) {
    try {
      await db.appointment.update({
        where: { id: appt.id },
        data: { status: 'no_show' },
      })

      const normalized = normalizePhoneTR(appt.customer.phone)
      if (!normalized) {
        logger.warn({ appointmentId: appt.id }, 'Telefon normalize edilemedi, no-show SMS atlandı')
        continue
      }

      const saat = appt.startAt.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
      })

      const text = `${appt.tenant.name}: Sayın ${appt.customer.fullName}, bugün saat ${saat}'deki ${appt.service.name} randevunuza katılamadınız. Yeni randevu için bizimle iletişime geçebilirsiniz.`

      await sendSms({
        tenantId: appt.tenant.id,
        customerId: appt.customer.id,
        appointmentId: appt.id,
        to: normalized,
        body: text,
        purpose: DeliveryPurpose.cancellation,
      })

      logger.info({ appointmentId: appt.id }, 'No-show işlendi, SMS gönderildi')
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
