import { Resend } from 'resend'
import { logger } from './logger'

type EmailKind = 'password_reset' | 'welcome'

interface OutgoingEmail {
  to: string
  subject: string
  html: string
}

/**
 * Gönderimi dener ve sonucu bildirir. Çağıranlar yanıtı beklemez (fire-and-forget) ama hata görünür kalır:
 * Resend API hatalarını `throw` etmeden `{ error }` olarak döner, bu yüzden her ikisi de ele alınır.
 * Log'a adres, bağlantı ve hata mesajı yazılmaz (mesaj adres içerebilir); yalnız e-posta türü, hata adı/kodu ve durum.
 */
async function deliver(kind: EmailKind, email: OutgoingEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Üretimde sıfırlama/karşılama e-postasının hiç gitmemesi bir yapılandırma hatasıdır.
    const log = process.env.NODE_ENV === 'production' ? logger.error : logger.warn
    log.call(logger, { kind }, 'E-posta gönderilmedi: RESEND_API_KEY tanımlı değil')
    return false
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({ from: 'BeautyOS <noreply@beautyossapp.com>', ...email })
    if (error) {
      logger.error({ kind, code: error.name, status: error.statusCode }, 'E-posta gönderilemedi (Resend hata döndü)')
      return false
    }
    return true
  } catch (err) {
    const code = err instanceof Error ? err.name : 'UnknownError'
    logger.error({ kind, code }, 'E-posta gönderilemedi (istek hatası)')
    return false
  }
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
  return deliver('password_reset', {
    to: email,
    subject: 'BeautyOS — Şifre Sıfırlama',
    html: `<p>Merhaba,</p><p>BeautyOS şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p><p><a href="${resetLink}">Şifremi Sıfırla</a></p><p>Bu bağlantı <strong>1 saat</strong> süreyle geçerlidir.</p><p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`,
  })
}

export async function sendWelcomeEmail(email: string, salonName: string, trialEndsAt: Date): Promise<boolean> {
  const trialEndStr = trialEndsAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  return deliver('welcome', {
    to: email,
    subject: `BeautyOS'a hoş geldin, ${salonName}!`,
    html: `<p>Merhaba,</p><p><strong>${salonName}</strong> adına BeautyOS'a hoş geldiniz! 30 günlük ücretsiz deneme süreniz başladı.</p><p>Deneme süreniz <strong>${trialEndStr}</strong> tarihinde sona erecek.</p>`,
  })
}
