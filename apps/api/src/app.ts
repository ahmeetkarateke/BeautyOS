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

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : null
  app.use(cors({ origin: corsOrigins ?? true, credentials: true }))
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

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } })
  })

  return app
}