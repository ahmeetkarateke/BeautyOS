import 'dotenv/config'
import './instrument'
import * as Sentry from '@sentry/node'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { initChannels, getChannel } from './channels/channel.factory'
import { SessionService } from './session/session.service'
import { IntentService } from './ai/intent.service'
import { FlowHandler } from './bot/flow.handler'
import { createWebhookRouter } from './routes/webhook.route'
import { createAuthRouter } from './routes/auth.route'
import { createTenantRouter } from './routes/tenant.route'
import { createPublicRouter } from './routes/public.route'
import { createAdminRouter } from './routes/admin.route'
import { TenantRegistry } from './lib/tenant.registry'
import { startReminderWorker } from './lib/queue'
import { db } from './lib/db'
import { logger } from './lib/logger'
export { createApp } from './app'


const startedAt = Date.now()

async function bootstrap(): Promise<void> {
  // ─── Bağımlılıkları başlat ─────────────────────────────────────────────────

  // ─── DB bağlantı testi ────────────────────────────────────────────────────
  try {
    await db.$queryRaw`SELECT 1`
    logger.info('Veritabanı bağlantısı OK')
  } catch (error) {
    logger.error({ error }, 'Veritabanı bağlantısı BAŞARISIZ — DATABASE_URL kontrol edin')
    process.exit(1)
  }

  const sessionService = new SessionService(process.env.REDIS_URL ?? 'redis://localhost:6379')
  try {
    await sessionService.connect()
  } catch (error) {
    logger.error({ error }, 'Redis bağlantısı kurulamadı — uygulama yine de başlatılıyor')
  }

  const tenantRegistry = new TenantRegistry(sessionService.getRedis())

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const intentService = new IntentService(genAI)
  const flowHandler = new FlowHandler(sessionService, intentService)

  initChannels()

  // ─── Express app ──────────────────────────────────────────────────────────

  const app = express()

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000', /\.vercel\.app$/],
    credentials: true,
  }))

  // rawBody middleware — webhook imza doğrulaması için gerekli
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString()
      },
    }),
  )

  Sentry.setupExpressErrorHandler(app)

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 15 dakika sonra tekrar deneyin.' } },
  })

  app.set('trust proxy', 1)

  app.use('/webhook', createWebhookRouter(flowHandler, tenantRegistry))
  app.use('/api/v1/auth', authLimiter, createAuthRouter())
  app.use('/api/v1/admin', createAdminRouter())
  app.use('/api/v1/tenants/:slug/public', createPublicRouter())
  app.use('/api/v1/tenants/:slug', createTenantRouter())

  // ─── Global error handler ─────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error')
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
  })

  // ─── Root health check ────────────────────────────────────────────────────

  app.get('/', (_req, res) => {
    res.json({ service: 'BeautyOS API', version: '1.0.0', status: 'ok', env: process.env.NODE_ENV })
  })

  // ─── Deep health check (UptimeRobot / BetterUptime için) ─────────────────

  app.get('/health', async (_req, res) => {
    let dbOk = false
    let redisOk = false

    try {
      await db.$queryRaw`SELECT 1`
      dbOk = true
    } catch {
      logger.error('Health check: DB ping failed')
    }

    try {
      redisOk = await sessionService.ping()
    } catch {
      logger.error('Health check: Redis ping failed')
    }

    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)
    const status = dbOk && redisOk ? 'ok' : 'degraded'

    res.status(dbOk && redisOk ? 200 : 503).json({
      status,
      db: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      uptime: `${uptimeSeconds}s`,
    })
  })

  // ─── Geçici debug endpoint (AI + Redis bağlantı testi) ───────────────────

  app.get('/debug', async (_req, res) => {
    const results: Record<string, unknown> = {}

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const r = await model.generateContent('Say "ok"')
      results.gemini = { ok: true, reply: r.response.text().slice(0, 50) }
    } catch (e: unknown) {
      results.gemini = { ok: false, error: (e as Error).message?.slice(0, 200) }
    }

    try {
      const alive = await sessionService.ping()
      results.redis = { ok: alive }
    } catch (e: unknown) {
      results.redis = { ok: false, error: (e as Error).message?.slice(0, 100) }
    }

    results.env = {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasRedisUrl: !!process.env.REDIS_URL,
      publicUrl: process.env.PUBLIC_URL,
      hasWhatsapp360ApiKey: !!process.env.WHATSAPP_360DIALOG_API_KEY,
      whatsappSandbox: process.env.WHATSAPP_SANDBOX === 'true',
      hasWhatsappVerifyToken: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      hasTenantId: !!process.env.TELEGRAM_TENANT_ID,
    }

    res.json(results)
  })

  // ─── Telegram webhook kaydet ──────────────────────────────────────────────

  startReminderWorker()
  logger.info('BullMQ hatırlatma worker başlatıldı')

  const port = Number(process.env.PORT ?? 3001)
  app.listen(port, async () => {
    logger.info({ port }, 'BeautyOS API sunucusu başlatıldı')

    if (process.env.WHATSAPP_360DIALOG_API_KEY && process.env.PUBLIC_URL) {
      try {
        const wa = getChannel('whatsapp') as import('./channels/whatsapp.channel').WhatsAppChannel
        await wa.registerWebhook(`${process.env.PUBLIC_URL}/webhook/whatsapp`)
      } catch (error) {
        logger.error({ error }, '360dialog webhook kaydı başarısız')
      }
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.PUBLIC_URL) {
      try {
        const telegram = getChannel('telegram') as import('./channels/telegram.channel').TelegramChannel
        const webhookUrl = `${process.env.PUBLIC_URL}/webhook/telegram`
        await telegram.setWebhook(webhookUrl)

        const me = await telegram.getMe()
        logger.info({ username: me.username, webhookUrl }, 'Telegram bot hazır')
      } catch (error) {
        logger.error({ error }, 'Telegram webhook kaydı başarısız')
      }
    } else {
      logger.warn('PUBLIC_URL veya TELEGRAM_BOT_TOKEN eksik — webhook kaydedilmedi')
    }
  })
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Başlatma hatası')
  process.exit(1)
})
