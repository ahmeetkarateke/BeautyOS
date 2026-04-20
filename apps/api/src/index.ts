import 'dotenv/config'
import * as Sentry from '@sentry/node'
import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { initChannels, getChannel } from './channels/channel.factory'
import { SessionService } from './session/session.service'
import { IntentService } from './ai/intent.service'
import { FlowHandler } from './bot/flow.handler'
import { createWebhookRouter } from './routes/webhook.route'
import { TenantRegistry } from './lib/tenant.registry'
import { logger } from './lib/logger'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  })
}

async function bootstrap(): Promise<void> {
  // ─── Bağımlılıkları başlat ─────────────────────────────────────────────────

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

  // rawBody middleware — webhook imza doğrulaması için gerekli
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString()
      },
    }),
  )

  Sentry.setupExpressErrorHandler(app)

  app.use('/webhook', createWebhookRouter(flowHandler, tenantRegistry))

  // ─── Root health check ────────────────────────────────────────────────────

  app.get('/', (_req, res) => {
    res.json({ service: 'BeautyOS API', version: '1.0.0', status: 'ok' })
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
    }

    res.json(results)
  })

  // ─── Telegram webhook kaydet ──────────────────────────────────────────────

  const port = Number(process.env.PORT ?? 3001)
  app.listen(port, async () => {
    logger.info({ port }, 'BeautyOS API sunucusu başlatıldı')

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
