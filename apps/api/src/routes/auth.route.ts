import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { db } from '../lib/db'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export function createAuthRouter(): Router {
  const router = Router()

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz e-posta veya şifre formatı.' } })
      }

      const { email, password } = parsed.data

      const user = await db.user.findFirst({
        where: { email, isActive: true },
        include: { tenant: { select: { slug: true } } },
      })

      if (!user) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatch) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const payload = {
        userId: user.id,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        role: user.role,
      }

      const token = jwt.sign(payload, process.env.JWT_SECRET ?? 'dev-secret', { expiresIn: '7d' })

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          tenantSlug: user.tenant.slug,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
