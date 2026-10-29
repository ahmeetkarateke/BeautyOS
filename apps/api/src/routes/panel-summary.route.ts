import { Router, type Request, type Response, type NextFunction } from 'express'
import { can, isRole } from '@beautyos/shared'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { buildSetupSteps, istanbulDayBounds, trialStatus } from '../lib/panel-summary'

/**
 * GET /api/v1/tenants/:slug/panel-summary — panelin menu sayaclari, deneme suresi, bugunku kasa ve ilk kurulum ozeti.
 * Her blok yetkiye gore gelir; yetkisiz blok null'dir (0 degil: arayuz "₺0" gibi sahte deger gostermesin).
 *  - counters: onay bekleyen online talep (appointment.approve), bekleme listesi (waitlist.view)
 *  - cashToday: finance.report.daily (resepsiyon zaten yalniz bugunu gorur)
 *  - trial: yalniz sahip
 *  - setup: yalniz sahip ve mudur (kurulum adimlarini onlar tamamlar)
 */
export function createPanelSummaryRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const role = req.user?.role
      if (!isRole(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
      const now = new Date()

      const [pendingOnlineRequests, waitingList, cashToday, setupAndTrial] = await Promise.all([
        can(role, 'appointment.approve')
          ? db.appointment.count({ where: { tenantId, status: 'pending', isDeleted: false, OR: [{ bookingChannel: 'web' }, { customerId: null }] } })
          : null,
        can(role, 'waitlist.view') ? db.waitlist.count({ where: { tenantId, status: 'waiting' } }) : null,
        can(role, 'finance.report.daily') ? readCashToday(tenantId, now) : null,
        can(role, 'dashboard.revenue') ? readSetupAndTrial(tenantId, role === 'owner', now) : null,
      ])

      return res.json({
        counters: { pendingOnlineRequests, waitingList },
        trial: setupAndTrial?.trial ?? null,
        cashToday,
        setup: setupAndTrial?.setup ?? null,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}

async function readCashToday(tenantId: string, now: Date) {
  const { start, end } = istanbulDayBounds(now)
  const agg = await db.transaction.aggregate({
    where: { tenantId, status: 'completed', completedAt: { gte: start, lte: end } },
    _sum: { grossAmount: true, cashAmount: true, cardAmount: true },
    _count: { _all: true },
  })
  return {
    totalAmount: Number(agg._sum.grossAmount ?? 0),
    cashAmount: Number(agg._sum.cashAmount ?? 0),
    cardAmount: Number(agg._sum.cardAmount ?? 0),
    count: agg._count._all,
  }
}

async function readSetupAndTrial(tenantId: string, includeTrial: boolean, now: Date) {
  const [tenant, serviceCount, staffCount, appointmentCount] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, trialEndsAt: true, settings: true } }),
    db.service.count({ where: { tenantId, isActive: true } }),
    db.staffProfile.count({ where: { tenantId } }),
    db.appointment.count({ where: { tenantId, isDeleted: false } }),
  ])
  if (!tenant) return null
  const settings = (tenant.settings && typeof tenant.settings === 'object' ? tenant.settings : {}) as Record<string, unknown>
  return {
    trial: includeTrial ? trialStatus(tenant.plan, tenant.trialEndsAt, now) : null,
    setup: buildSetupSteps({ settings, serviceCount, staffCount, appointmentCount }),
  }
}
