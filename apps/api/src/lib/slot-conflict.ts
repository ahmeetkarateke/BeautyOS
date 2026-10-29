/**
 * S3: appointments tablosundaki `appointments_staff_no_overlap` EXCLUDE kisiti ayni personele cakisan randevuyu
 * veritabaninda engeller. On kontrol (findFirst) yarisa acik oldugundan asil koruma budur; kisit ihlali (SQLSTATE 23P01)
 * her yazma yolunda ayni 409 SLOT_TAKEN yanitina cevrilir.
 */
export const SLOT_OVERLAP_CONSTRAINT = 'appointments_staff_no_overlap'
const EXCLUSION_VIOLATION = '23P01'

export const SLOT_TAKEN_BODY = {
  error: { code: 'SLOT_TAKEN', message: 'Bu saat dolu, lütfen başka bir saat seçin.' },
} as const

export class SlotTakenError extends Error {
  readonly code = 'SLOT_TAKEN'
  constructor() {
    super('Bu saat dolu.')
  }
}

/** Prisma, EXCLUDE ihlalini bilinen bir koda cevirmez; kodu mesajda ya da meta'da arariz. */
export function isSlotOverlapError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const meta = (err as { meta?: { code?: unknown } }).meta
  if (meta?.code === EXCLUSION_VIOLATION) return true
  return err.message.includes(EXCLUSION_VIOLATION) || err.message.includes(SLOT_OVERLAP_CONSTRAINT)
}

/** Rota catch blogu icin: kisit ihlali 409 SLOT_TAKEN olur, diger hatalar error handler'a gider. */
export function respondSlotTakenOr(err: unknown, res: import('express').Response, next: import('express').NextFunction): void {
  if (isSlotOverlapError(err)) {
    res.status(409).json(SLOT_TAKEN_BODY)
    return
  }
  next(err)
}
