import * as Sentry from '@sentry/node'

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-telegram-bot-api-secret-token', 'x-hub-signature-256']

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    beforeSend(event) {
      // Hassas header'ları temizle
      if (event.request?.headers) {
        for (const key of SENSITIVE_HEADERS) {
          if (event.request.headers[key]) {
            event.request.headers[key] = '[redacted]'
          }
        }
      }
      // Request body içinde şifre/token alanlarını maskele
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>
        for (const key of ['password', 'currentPassword', 'newPassword', 'passwordHash', 'token', 'refreshToken', 'captchaToken']) {
          if (key in data) data[key] = '[redacted]'
        }
      }
      return event
    },
  })
}
