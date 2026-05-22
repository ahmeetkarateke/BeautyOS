import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createAuthRouter } from './routes/auth.route'
import { createTenantRouter } from './routes/tenant.route'
import { createPublicRouter } from './routes/public.route'
import { createAdminRouter } from './routes/admin.route'

export function createApp(options?: { rateLimitMax?: number }) {
  const app = express()

  app.set('trust proxy', 1)

  // CORS origin kontrolü:
  // - Env'de CORS_ORIGIN tanımlıysa virgülle ayrılmış liste KULLANILIR (tam eşleşme)
  // - Ek olarak beautyossapp.com apex + tüm subdomain'leri (app, test, www) otomatik kabul
  // - Localhost (dev) her zaman serbest
  const envAllowed = process.env.CORS_ORIGIN
    ? new Set(process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean))
    : null

  function isOriginAllowed(origin: string): boolean {
    if (envAllowed && envAllowed.has(origin)) return true
    try {
      const url = new URL(origin)
      const host = url.hostname
      if (host === 'localhost' || host === '127.0.0.1') return true
      if (host === 'beautyossapp.com') return true
      if (host.endsWith('.beautyossapp.com')) return true
      return false
    } catch {
      return false
    }
  }

  app.use(
    cors({
      origin: (origin, cb) => {
        // origin yoksa (server-to-server / curl) izin ver
        if (!origin) return cb(null, true)
        return cb(null, isOriginAllowed(origin))
      },
      credentials: true,
    }),
  )
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString()
      },
    }),
  )

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: options?.rateLimitMax ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 15 dakika sonra tekrar deneyin.' } },
  })

  app.use('/api/v1/auth', authLimiter, createAuthRouter({ registerLimitMax: options?.rateLimitMax }))
  app.use('/api/v1/admin', createAdminRouter())
  app.use('/api/v1/tenants/:slug/public', createPublicRouter())
  app.use('/api/v1/tenants/:slug', createTenantRouter())

  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
  })

  return app
}