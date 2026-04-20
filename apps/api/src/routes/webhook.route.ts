import { Router, type Request, type Response } from 'express'
import { getChannel } from '../channels/channel.factory'
import { FlowHandler } from '../bot/flow.handler'
import { logger } from '../lib/logger'
import type { ChannelType } from '../channels/types'

export function createWebhookRouter(flowHandler: FlowHandler): Router {
  const router = Router()

  // ─── Telegram Webhook ─────────────────────────────────────────────────────
  // POST /webhook/telegram — Telegram her güncellemeyi buraya gönderir

  router.post('/telegram', async (req: Request, res: Response) => {
    // Telegram imzayı doğrula
    const channel = getChannel('telegram')
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    if (!channel.verifyWebhook(rawBody, req.headers as Record<string, string>)) {
      logger.warn('Telegram webhook imza doğrulaması başarısız')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Telegram'a hemen 200 döndür — işlemi async yap
    // (Telegram 5 saniye içinde 200 almazsa retry gönderir)
    res.status(200).json({ ok: true })

    const msg = channel.parseWebhook(req.body, req.headers as Record<string, string>)
    if (!msg) return

    // Callback query acknowledge (buton tıklaması animasyonunu durdurur)
    const update = req.body as Record<string, unknown>
    if (update.callback_query) {
      const cq = update.callback_query as Record<string, string>
      const telegramChannel = channel as import('../channels/telegram.channel').TelegramChannel
      await telegramChannel.answerCallbackQuery(cq.id).catch(() => {})
    }

    const { getSalon } = await import('../lib/salon.context')
    const salon = await getSalon('test-tenant')

    await flowHandler.handle(channel, msg, salon)
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
    res.status(200).json({ ok: true }) // Meta hızlı 200 bekler

    try {
      const channel = getChannel('whatsapp')
      const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

      if (!channel.verifyWebhook(rawBody, req.headers as Record<string, string>)) {
        logger.warn('WhatsApp webhook imza doğrulaması başarısız')
        return
      }

      const msg = channel.parseWebhook(req.body, req.headers as Record<string, string>)
      if (!msg) return

      // TODO: telefon numarasından tenant'ı çöz
      const { getSalon } = await import('../lib/salon.context')
      const salon = await getSalon('test-tenant')

      await flowHandler.handle(channel, msg, salon)
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
