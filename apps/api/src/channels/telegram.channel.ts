import axios from 'axios'
import crypto from 'crypto'
import { logger } from '../lib/logger'
import type {
  MessagingChannel,
  IncomingMessage,
  Button,
  ListSection,
} from './types'

// ─── Telegram API tipleri (kullandığımız alanlar) ────────────────────────────
interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
  callback_query?: {
    id: string
    from: { id: number; first_name: string }
    message?: { chat: { id: number } }
    data?: string
  }
}

export class TelegramChannel implements MessagingChannel {
  readonly type = 'telegram' as const

  private readonly apiBase: string
  private readonly secretToken: string // Webhook doğrulama için

  constructor(
    private readonly botToken: string,
    secretToken?: string,
  ) {
    this.apiBase = `https://api.telegram.org/bot${botToken}`
    // Belirtilmezse token'ın hash'ini kullan
    this.secretToken =
      secretToken ?? crypto.createHash('sha256').update(botToken).digest('hex').slice(0, 32)
  }

  // ─── Mesaj gönderme ────────────────────────────────────────────────────────

  async sendText(to: string, text: string): Promise<void> {
    await this.call('sendMessage', {
      chat_id: to,
      text,
      parse_mode: 'Markdown',
    })
  }

  async sendButtons(to: string, text: string, buttons: Button[]): Promise<void> {
    // Her butonu ayrı bir satıra koy (2'li grid yerine dikey liste — daha okunabilir)
    const inline_keyboard = buttons.map((b) => [
      { text: b.label, callback_data: b.id },
    ])

    await this.call('sendMessage', {
      chat_id: to,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard },
    })
  }

  async sendList(to: string, text: string, sections: ListSection[]): Promise<void> {
    // Telegram'da native liste yok — numaralı mesaj + buton olarak sun
    const lines: string[] = [text, '']
    const allButtons: Button[] = []

    for (const section of sections) {
      if (section.title) lines.push(`*${section.title}*`)
      for (const item of section.items) {
        lines.push(`• ${item.label}${item.description ? ` — _${item.description}_` : ''}`)
        allButtons.push({ id: item.id, label: item.label })
      }
      lines.push('')
    }

    await this.sendButtons(to, lines.join('\n').trim(), allButtons)
  }

  // ─── Webhook işleme ────────────────────────────────────────────────────────

  parseWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): IncomingMessage | null {
    const update = payload as TelegramUpdate

    // Normal metin mesajı
    if (update.message?.text) {
      return {
        channelType: 'telegram',
        from: String(update.message.chat.id),
        text: update.message.text,
        messageId: String(update.message.message_id),
        timestamp: new Date(update.message.date * 1000),
        rawPayload: payload,
      }
    }

    // Buton tıklaması (callback_query) — buton id'sini metin gibi işle
    if (update.callback_query?.data) {
      const cq = update.callback_query
      return {
        channelType: 'telegram',
        from: String(cq.message?.chat.id ?? cq.from.id),
        text: cq.data!,
        messageId: cq.id,
        timestamp: new Date(),
        rawPayload: payload,
      }
    }

    return null // Desteklenmeyen update tipi (sticker, foto vs.)
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean {
    // Telegram webhook'u X-Telegram-Bot-Api-Secret-Token header'ı ile doğrular.
    // Telegram'a webhook kaydederken secret_token parametresi verilmişse kontrol et.
    const incomingToken = headers['x-telegram-bot-api-secret-token']
    if (!incomingToken) return true // Token set edilmemişse geç (geliştirme ortamı)
    return crypto.timingSafeEqual(
      Buffer.from(incomingToken),
      Buffer.from(this.secretToken),
    )
  }

  // ─── Telegram Bot API yardımcı metodları ──────────────────────────────────

  // Callback query'yi acknowledge et (buton animasyonunu durdurur)
  async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: callbackQueryId })
  }

  // Webhook URL'ini Telegram'a kaydet
  async setWebhook(url: string): Promise<void> {
    await this.call('setWebhook', {
      url,
      secret_token: this.secretToken,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    })
    logger.info({ url }, 'Telegram webhook kaydedildi')
  }

  async deleteWebhook(): Promise<void> {
    await this.call('deleteWebhook', { drop_pending_updates: true })
  }

  async getMe(): Promise<{ username: string; first_name: string }> {
    const res = await this.call<{ username: string; first_name: string }>('getMe', {})
    return res
  }

  // ─── Düşük seviye API çağrısı ──────────────────────────────────────────────

  private async call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    try {
      const { data } = await axios.post<{ ok: boolean; result: T }>(
        `${this.apiBase}/${method}`,
        params,
        { timeout: 10_000 },
      )

      if (!data.ok) {
        throw new Error(`Telegram API hatası: ${JSON.stringify(data)}`)
      }

      return data.result
    } catch (error) {
      logger.error({ method, error }, 'Telegram API çağrısı başarısız')
      throw error
    }
  }
}
