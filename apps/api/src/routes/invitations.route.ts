import { Router } from 'express'

// Iskelet (kirmizi adim): gercek uygulama sonraki commit'te.
export function createInvitationsRouter(): Router {
  return Router({ mergeParams: true })
}

export function createPublicInvitationsRouter(): Router {
  return Router({ mergeParams: true })
}
