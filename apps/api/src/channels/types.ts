// ─── Core Messaging Abstraction ──────────────────────────────────────────────
// Bu katman sayesinde Telegram ve WhatsApp aynı interface'i kullanır.
// Bot mantığı (flow, AI, session) hiçbir zaman Telegram'a veya WhatsApp'a
// doğrudan bağlı değildir — sadece bu tipleri bilir.

export type ChannelType = 'telegram' | 'whatsapp'

// Gelen mesaj — kanaldan bağımsız normalize edilmiş format
export interface IncomingMessage {
  channelType: ChannelType
  from: string        // Telegram: chat_id (string), WhatsApp: telefon (+905xx)
  text: string
  messageId: string
  timestamp: Date
  rawPayload: unknown // Debug ve loglama için orijinal payload
}

// Buton — Telegram inline keyboard, WhatsApp quick reply karşılığı
export interface Button {
  id: string    // callback_data (Telegram) veya button_id (WhatsApp)
  label: string // Kullanıcıya gösterilen metin
}

// Liste öğesi — WhatsApp list message, Telegram inline keyboard row karşılığı
export interface ListSection {
  title: string
  items: Array<{ id: string; label: string; description?: string }>
}

// Her kanalın implement etmesi gereken sözleşme
export interface MessagingChannel {
  readonly type: ChannelType

  // Düz metin gönder
  sendText(to: string, text: string): Promise<void>

  // Butonlu mesaj gönder (Telegram: inline keyboard, WhatsApp: interactive buttons)
  sendButtons(to: string, text: string, buttons: Button[]): Promise<void>

  // Liste mesajı gönder (Telegram: buton satırları, WhatsApp: list message)
  sendList(to: string, text: string, sections: ListSection[]): Promise<void>

  // Ham webhook payload'ını IncomingMessage'a çevir; geçersizse null döner
  parseWebhook(payload: unknown, headers: Record<string, string>): IncomingMessage | null

  // Webhook imza doğrulaması (WhatsApp HMAC, Telegram secret token)
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean
}

// ─── Kanal fabrikası için tip ─────────────────────────────────────────────────
export type ChannelRegistry = Record<ChannelType, MessagingChannel>
