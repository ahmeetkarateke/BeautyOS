/** Veritabanindaki UserRole degerleri (Prisma enum ile ayni olmali). */
export const ROLES = ['owner', 'manager', 'staff', 'superadmin'] as const

export type Role = (typeof ROLES)[number]

/** Disaridan gelen (JWT, govde) bir degerin bilinen rol olup olmadigini dogrular. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
