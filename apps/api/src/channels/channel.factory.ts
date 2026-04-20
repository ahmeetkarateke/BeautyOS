import { TelegramChannel } from './telegram.channel'
import { WhatsAppChannel } from './whatsapp.channel'
import type { MessagingChannel, ChannelType } from './types'

// ─── Kanal Fabrikası ──────────────────────────────────────────────────────────
// Ortam değişkenlerine göre hangi kanalların aktif olduğuna karar verir.
// Bot mantığı sadece MessagingChannel interface'ini kullanır — fabrikayı bilmez.

const channels = new Map<ChannelType, MessagingChannel>()

export function initChannels(): void {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    channels.set(
      'telegram',
      new TelegramChannel(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.TELEGRAM_SECRET_TOKEN,
      ),
    )
  }

  if (
    process.env.WHATSAPP_API_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_APP_SECRET
  ) {
    channels.set(
      'whatsapp',
      new WhatsAppChannel(
        process.env.WHATSAPP_API_TOKEN,
        process.env.WHATSAPP_PHONE_NUMBER_ID,
        process.env.WHATSAPP_APP_SECRET,
      ),
    )
  }
}

export function getChannel(type: ChannelType): MessagingChannel {
  const channel = channels.get(type)
  if (!channel) throw new Error(`'${type}' kanalı başlatılmamış`)
  return channel
}

export function getActiveChannels(): MessagingChannel[] {
  return Array.from(channels.values())
}
