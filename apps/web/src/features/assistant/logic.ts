// Mesaj asistanı saf mantığı (W28). Bayrak derleme anında yerleşir; kapalıyken ekran dürüstçe bilgi verir.
export const botFeaturesEnabled = () => process.env.NEXT_PUBLIC_BOT_FEATURES_ENABLED === 'true'

const CHANNELS: Record<string, string> = { telegram: 'Telegram', whatsapp: 'WhatsApp', web: 'Web' }
const OUTCOMES: Record<string, string> = {
  booked: 'Randevu alındı',
  cancelled: 'Randevu iptal edildi',
  rescheduled: 'Randevu değiştirildi',
  info: 'Bilgi verildi',
  abandoned: 'Yarıda bırakıldı',
  handoff: 'Salona yönlendirildi',
}
export const channelLabel = (channel: string) => CHANNELS[channel] ?? 'Diğer kanal'
export const outcomeLabel = (outcome: string | null | undefined) => (outcome ? (OUTCOMES[outcome] ?? 'Diğer') : 'Sonuçlanmadı')
