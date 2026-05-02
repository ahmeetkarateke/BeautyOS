import crypto from 'crypto'
import axios from 'axios'
import { logger } from '../lib/logger'
import type {
  MessagingChannel,
  IncomingMessage,
  Button,
  ListSection,
} from './types'

// ─── WhatsApp Channel ─────────────────────────────────────────────────────────
// 360dialog Sandbox/Production API kullanır.
// Sandbox: waba-sandbox.360dialog.io | Production: waba.360dialog.io

export class WhatsAppChannel implements MessagingChannel {
  readonly type = 'whatsapp' as const

  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    private readonly appSecret: string,
    sandbox = false,
  ) {
    this.baseUrl = sandbox
      ? 'https://waba-sandbox.360dialog.io/v1'
      : 'https://waba.360dialog.io/v1'
  }

  // ─── Gönderme metodları ────────────────────────────────────────────────────

  async sendText(to: string, text: string): Promise<void> {
    await this.call({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    })
  }

  async sendButtons(to: string, text: string, buttons: Button[]): Promise<void> {
    if (buttons.length > 3) {
      logger.warn('WhatsApp max 3 buton destekler, liste olarak gönderiliyor')
      return this.sendList(to, text, [
        { title: 'Seçenekler', items: buttons.map((b) => ({ id: b.id, label: b.label })) },
      ])
    }

    await this.call({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.label.slice(0, 20) },
          })),
        },
      },
    })
  }

  async sendList(to: string, text: string, sections: ListSection[]): Promise<void> {
    await this.call({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text },
        action: {
          button: 'Seçenekleri Gör',
          sections: sections.map((s) => ({
            title: s.title,
            rows: s.items.map((item) => ({
              id: item.id,
              title: item.label.slice(0, 24),
              description: item.description?.slice(0, 72) ?? '',
            })),
          })),
        },
      },
    })
  }

  // ─── Webhook işleme ────────────────────────────────────────────────────────

  parseWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): IncomingMessage | null {
    try {
      const body = payload as Record<string, unknown>
      const messages = body.messages as unknown[] | undefined

      // 360dialog payload direkt — messages array üst seviyede
      if (!messages?.length) return null

      const msg = messages[0] as Record<string, unknown>
      const from = msg.from as string

      if (msg.type === 'text') {
        const text = (msg.text as Record<string, string>).body
        return {
          channelType: 'whatsapp',
          from,
          text,
          messageId: msg.id as string,
          timestamp: new Date(Number(msg.timestamp) * 1000),
          rawPayload: payload,
        }
      }

      if (msg.type === 'interactive') {
        const interactive = msg.interactive as Record<string, unknown>
        const buttonReply = (
          interactive.button_reply ?? interactive.list_reply
        ) as Record<string, string>

        return {
          channelType: 'whatsapp',
          from,
          text: buttonReply.id,
          messageId: msg.id as string,
          timestamp: new Date(Number(msg.timestamp) * 1000),
          rawPayload: payload,
        }
      }

      return null
    } catch {
      return null
    }
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean {
    // 360dialog sandbox imza doğrulaması kullanmaz — her isteği kabul et
    if (!this.appSecret) return true

    const signature = headers['x-hub-signature-256']
    if (!signature) return true // 360dialog bazen imza göndermez

    try {
      const expected = `sha256=${crypto
        .createHmac('sha256', this.appSecret)
        .update(rawBody)
        .digest('hex')}`
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return true
    }
  }

  // ─── 360dialog API çağrısı ────────────────────────────────────────────────

  private async call(body: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/messages`,
        body,
        {
          headers: {
            'D360-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      )
    } catch (error) {
      logger.error({ error }, 'WhatsApp (360dialog) API çağrısı başarısız')
      throw error
    }
  }

  // ─── Webhook URL kaydet ───────────────────────────────────────────────────

  async registerWebhook(webhookUrl: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/configs/webhook`,
      { url: webhookUrl },
      {
        headers: {
          'D360-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    )
    logger.info({ webhookUrl }, '360dialog webhook kaydedildi')
  }
}
