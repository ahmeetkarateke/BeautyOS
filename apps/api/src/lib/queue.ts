import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { db } from './db'
import { logger } from './logger'
import { TelegramChannel } from '../channels/telegram.channel'

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
        customer: { select: { fullName: true, phone: true } },
        service: { select: { name: true } },
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

  const saat = appointment.startAt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })

  const { fullName, phone } = appointment.customer
  const serviceName = appointment.service.name

  const text =
    type === 'reminder_24h'
      ? `Merhaba ${fullName}! Yarın saat ${saat}'de ${serviceName} randevunuz var. İptal için 'İptal' yazın.`
      : `Merhaba ${fullName}! ${saat}'deki ${serviceName} randevunuzu hatırlatmak istedik. Görüşürüz!`

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    logger.warn({ appointmentId }, 'TELEGRAM_BOT_TOKEN eksik, hatırlatma gönderilemedi')
    return
  }

  const channel = new TelegramChannel(botToken)
  await channel.sendText(phone, text)
  logger.info({ appointmentId, type }, 'Hatırlatma gönderildi')
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
      customer: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      tenant: { select: { telegramBotToken: true } },
    },
  })

  logger.info({ count: staleAppointments.length }, 'No-show işlenecek randevu sayısı')

  for (const appt of staleAppointments) {
    try {
      await db.appointment.update({
        where: { id: appt.id },
        data: { status: 'no_show' },
      })

      const botToken = appt.tenant.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        logger.warn({ appointmentId: appt.id }, 'Bot token yok, no-show mesajı atlandı')
        continue
      }

      const saat = appt.startAt.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
      })

      const text = `Merhaba ${appt.customer.fullName}! Bugün saat ${saat}'deki ${appt.service.name} randevunuza gelemediniz. Yeniden randevu almak ister misiniz? Hemen yazabilirsiniz.`

      const channel = new TelegramChannel(botToken)
      await channel.sendText(appt.customer.phone, text)

      logger.info({ appointmentId: appt.id }, 'No-show işlendi, mesaj gönderildi')
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
