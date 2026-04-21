import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { db } from './db'
import { logger } from './logger'
import { TelegramChannel } from '../channels/telegram.channel'

export type ReminderJobData =
  | { type: 'reminder_24h'; appointmentId: string }
  | { type: 'reminder_2h'; appointmentId: string }

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

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Hatırlatma job tamamlandı')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, type: job?.data?.type, err }, 'Hatırlatma job başarısız')
  })

  return worker
}
