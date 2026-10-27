import * as Sentry from '@sentry/node'
import { scrubEvent } from './lib/sentry-scrub'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    // Hata ve izleme olaylarından istek gövdesi, sorgu, çerez, başlık ve kullanıcı alanları silinir (KVKK).
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  })
}
