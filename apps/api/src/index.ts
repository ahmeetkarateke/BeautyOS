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
import { createMeRouter } from './routes/me.route'
import { createTenantRouter } from './routes/tenant.route'
import { createPublicRouter } from './routes/public.route'
import { createAdminRouter } from './routes/admin.route'
import { createPackagesRouter } from './routes/packages.route'
import { createTipsRouter } from './routes/tips.route'
import { createCustomerEnrichmentRouter } from './routes/customer-enrichment.route'
import { createCurrentAccountsRouter } from './routes/current-accounts.route'
import { createPurchaseInvoicesRouter } from './routes/purchase-invoices.route'
import { createFinancialAccountsRouter } from './routes/financial-accounts.route'
import { createStaffPayoutsRouter } from './routes/staff-payouts.route'
import { createStockRouter } from './routes/stock.route'
import { createWaitlistRouter } from './routes/waitlist.route'
import { apiErrorHandler } from './lib/error-handler'
import { createAppointmentApprovalRouter } from './routes/appointment-approval.route'
import { TenantRegistry } from './lib/tenant.registry'
import { startReminderWorker } from './lib/queue'
import { resolveBookingMode } from './lib/booking-mode'
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

  const sessionService = new SessionService()
  const tenantRegistry = new TenantRegistry()

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const intentService = new IntentService(genAI)
  const flowHandler = new FlowHandler(sessionService, intentService)

  initChannels()

  // ─── Express app ──────────────────────────────────────────────────────────

  const app = express()

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean)
  if (!allowedOriginsEnv && process.env.NODE_ENV === 'production') {
    logger.error('ALLOWED_ORIGINS env var not set in production — refusing to start')
    process.exit(1)
  }
  app.use(cors({
    origin: allowedOriginsEnv ?? ['http://localhost:3000', /^https:\/\/beauty-os.*\.vercel\.app$/],
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
  // /auth/me hiz siniri disinda: arayuz her acilista cagirir (A1)
  app.use('/api/v1/auth/me', createMeRouter())
  app.use('/api/v1/auth', authLimiter, createAuthRouter())
  app.use('/api/v1/admin', createAdminRouter())
  app.use('/api/v1/tenants/:slug/public', createPublicRouter())
  app.use('/api/v1/tenants/:slug/staff-payouts', createStaffPayoutsRouter())
  app.use('/api/v1/tenants/:slug/waitlist', createWaitlistRouter())
  app.use('/api/v1/tenants/:slug', createPackagesRouter())
  app.use('/api/v1/tenants/:slug', createTipsRouter())
  app.use('/api/v1/tenants/:slug', createCustomerEnrichmentRouter())
  app.use('/api/v1/tenants/:slug', createCurrentAccountsRouter())
  app.use('/api/v1/tenants/:slug', createPurchaseInvoicesRouter())
  app.use('/api/v1/tenants/:slug', createFinancialAccountsRouter())
  app.use('/api/v1/tenants/:slug', createStockRouter())
  app.use('/api/v1/tenants/:slug', createAppointmentApprovalRouter())
  app.use('/api/v1/tenants/:slug', createTenantRouter())

  // ─── Global error handler ─────────────────────────────────────────────────
  app.use(apiErrorHandler((err) => logger.error({ err }, 'Beklenmeyen hata')))

  // ─── Root health check ────────────────────────────────────────────────────

  app.get('/', (_req, res) => {
    res.json({ service: 'BeautyOS API', version: '1.0.0', status: 'ok', env: process.env.NODE_ENV })
  })

  // ─── Deep health check (UptimeRobot / BetterUptime için) ─────────────────

  app.get('/health', async (_req, res) => {
    let dbOk = false

    try {
      await db.$queryRaw`SELECT 1`
      dbOk = true
    } catch {
      logger.error('Health check: DB ping failed')
    }

    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)

    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'error',
      uptime: `${uptimeSeconds}s`,
    })
  })

  // ─── Telegram webhook kaydet ──────────────────────────────────────────────

  logger.info({ phoneVerification: resolveBookingMode().phoneVerification }, 'Online randevu telefon doğrulama modu')
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
