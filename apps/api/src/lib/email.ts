import { Resend } from 'resend'

export async function sendWelcomeEmail(email: string, salonName: string, trialEndsAt: Date): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  try {
    const resend = new Resend(apiKey)
    const trialEndStr = trialEndsAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    await resend.emails.send({
      from: 'BeautyOS <noreply@beautyos.app>',
      to: email,
      subject: `BeautyOS'a hoş geldin, ${salonName}!`,
      html: `<p>Merhaba,</p><p><strong>${salonName}</strong> adına BeautyOS'a hoş geldiniz! 30 günlük ücretsiz deneme süreniz başladı.</p><p>Deneme süreniz <strong>${trialEndStr}</strong> tarihinde sona erecek.</p>`,
    })
  } catch {
    // fire-and-forget, errors are silently swallowed
  }
}
