import { Resend } from 'resend'

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'BeautyOS <onboarding@resend.dev>',
      to: email,
      subject: 'BeautyOS — Şifre Sıfırlama',
      html: `<p>Merhaba,</p><p>BeautyOS şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p><p><a href="${resetLink}">Şifremi Sıfırla</a></p><p>Bu bağlantı <strong>1 saat</strong> süreyle geçerlidir.</p><p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>`,
    })
  } catch {
    // fire-and-forget
  }
}

export async function sendWelcomeEmail(email: string, salonName: string, trialEndsAt: Date): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    const trialEndStr = trialEndsAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    await resend.emails.send({
      from: 'BeautyOS <onboarding@resend.dev>',
      to: email,
      subject: `BeautyOS'a hoş geldin, ${salonName}!`,
      html: `<p>Merhaba,</p><p><strong>${salonName}</strong> adına BeautyOS'a hoş geldiniz! 30 günlük ücretsiz deneme süreniz başladı.</p><p>Deneme süreniz <strong>${trialEndStr}</strong> tarihinde sona erecek.</p>`,
    })
  } catch {
    // fire-and-forget, errors are silently swallowed
  }
}
