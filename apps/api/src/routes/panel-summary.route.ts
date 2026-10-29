import { Router } from 'express'

export function createPanelSummaryRouter(): Router {
  const router = Router({ mergeParams: true })
  router.get('/', (_req, res) => res.status(501).json({}))
  return router
}
