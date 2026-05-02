import { Router, type Request, type Response } from 'express'
import { getChannel } from '../channels/channel.factory'
import { FlowHandler } from '../bot/flow.handler'
import { TenantRegistry } from '../lib/tenant.registry'
import { getSalon } from '../lib/salon.context'
import { logger } from '../lib/logger'

// ─── tenantId çözümle — env var → DB lookup → fallback ───────────────────────

async function resolveTenantId(
  registry: TenantRegistry,
  source: 'telegram' | 'whatsapp',
  identifier: string, // botToken veya phoneNumberId
): Promise<string> {
  // 1. Hızlı env var yolu (tek-tenant deployment)
  const fromEnv = TenantRegistry.fromEnv()
  if (fromEnv) return fromEnv

  // 2. DB lookup
  const tenantId = source === 'telegram'
    ? await registry.getByBotToken(identifier)
    : await registry.getByPhoneNumberId(identifier)

  if (tenantId) return tenantId

  // 3. Hiçbiri bulunamazsa geliştirme fallback'i
  logger.warn({ source, identifier: identifier.slice(-6) }, 'Tenant bulunamadı, fallback kullanılıyor')
  return 'test-tenant'
}

export function createWebhookRouter(
  flowHandler: FlowHandler,
  tenantRegistry: TenantRegistry,
): Router {
  const router = Router()

  // ─── Telegram Webhook ─────────────────────────────────────────────────────
  // POST /webhook/telegram — Telegram her güncellemeyi buraya gönderir

  router.post('/telegram', async (req: Request, res: Response) => {
    const channel = getChannel('telegram')
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    if (!channel.verifyWebhook(rawBody, req.headers as Record<string, string>)) {
      logger.warn('Telegram webhook imza doğrulaması başarısız')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    res.status(200).json({ ok: true })

    const msg = channel.parseWebhook(req.body, req.headers as Record<string, string>)
    if (!msg) return

    // Callback query acknowledge
    const update = req.body as Record<string, unknown>
    if (update.callback_query) {
      const cq = update.callback_query as Record<string, string>
      const telegramChannel = channel as import('../channels/telegram.channel').TelegramChannel
      await telegramChannel.answerCallbackQuery(cq.id).catch(() => {})
    }

    const tenantId = await resolveTenantId(
      tenantRegistry,
      'telegram',
      process.env.TELEGRAM_BOT_TOKEN ?? '',
    )

    const salon = await getSalon(tenantId)
    await flowHandler.handle(channel, msg, salon, tenantId)
  })

  // ─── WhatsApp Webhook ─────────────────────────────────────────────────────
  // GET /webhook/whatsapp — Meta doğrulama challenge'ı
  // POST /webhook/whatsapp — Gelen mesajlar

  router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook doğrulandı')
      return res.status(200).send(challenge)
    }

    res.status(403).json({ error: 'Forbidden' })
  })

  router.post('/whatsapp', async (req: Request, res: Response) => {
    res.status(200).json({ ok: true })

    try {
      logger.info({ body: JSON.stringify(req.body).slice(0, 200) }, 'WhatsApp POST alındı')
      const channel = getChannel('whatsapp')
      const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

      const sigOk = channel.verifyWebhook(rawBody, req.headers as Record<string, string>)
      logger.info({ sigOk }, 'WhatsApp imza kontrol sonucu')
      if (!sigOk) {
        logger.warn('WhatsApp webhook imza doğrulaması başarısız')
        return
      }

      const msg = channel.parseWebhook(req.body, req.headers as Record<string, string>)
      if (!msg) return

      // WhatsApp payload'dan phoneNumberId çıkar
      const entry = (req.body as Record<string, unknown>)?.entry as Array<Record<string, unknown>> | undefined
      const changeValue = ((entry?.[0]?.changes as Array<Record<string, unknown>>)?.[0]?.value ?? {}) as Record<string, unknown>
      const phoneNumberId = (changeValue['phone_number_id'] as string | undefined) ?? ''

      const tenantId = await resolveTenantId(tenantRegistry, 'whatsapp', phoneNumberId)
      const salon = await getSalon(tenantId)

      await flowHandler.handle(channel, msg, salon, tenantId)
    } catch (error) {
      logger.error({ error }, 'WhatsApp webhook işleme hatası')
    }
  })

  // ─── Health check ─────────────────────────────────────────────────────────

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  return router
}
