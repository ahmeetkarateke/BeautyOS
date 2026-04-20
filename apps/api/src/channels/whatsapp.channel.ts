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
// Şu an STUB — Meta WhatsApp Business API onayı gelince implement edilecek.
// Interface tamamen aynı olduğu için bot mantığı (flow, AI, session) hiç
// değişmeyecek. Sadece bu dosya doldurulacak.

export class WhatsAppChannel implements MessagingChannel {
  readonly type = 'whatsapp' as const

  constructor(
    private readonly apiToken: string,
    private readonly phoneNumberId: string,
    private readonly appSecret: string,
  ) {}

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
    // WhatsApp max 3 buton destekler
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
            reply: { id: b.id, title: b.label.slice(0, 20) }, // WhatsApp max 20 karakter
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
      const entry = (body.entry as unknown[])?.[0] as Record<string, unknown>
      const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
      const value = change?.value as Record<string, unknown>
      const messages = value?.messages as unknown[]

      if (!messages?.length) return null

      const msg = messages[0] as Record<string, unknown>
      const from = msg.from as string

      // Düz metin mesajı
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

      // Buton yanıtı (interactive)
      if (msg.type === 'interactive') {
        const interactive = msg.interactive as Record<string, unknown>
        const buttonReply = (
          interactive.button_reply ?? interactive.list_reply
        ) as Record<string, string>

        return {
          channelType: 'whatsapp',
          from,
          text: buttonReply.id, // button id'sini metin gibi işle
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
    const signature = headers['x-hub-signature-256']
    if (!signature) return false

    const expected = `sha256=${crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex')}`

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  // ─── WhatsApp Cloud API çağrısı ───────────────────────────────────────────

  private async call(body: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      )
    } catch (error) {
      logger.error({ error }, 'WhatsApp API çağrısı başarısız')
      throw error
    }
  }
}
