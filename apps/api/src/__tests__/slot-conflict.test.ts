import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { isSlotOverlapError, SlotTakenError, SLOT_TAKEN_BODY } from '../lib/slot-conflict'

// S3-K2: veritabani cakisma kisitinin (23P01) hata bicimleri her yolda ayni sekilde taninir.
describe('S3-K2: isSlotOverlapError', () => {
  it('Prisma bilinmeyen istek hatasi: mesajda 23P01 kodu', () => {
    const err = new Prisma.PrismaClientUnknownRequestError(
      'Invalid `prisma.appointment.create()` invocation: ERROR: conflicting key value violates exclusion constraint "appointments_staff_no_overlap" (code: 23P01)',
      { clientVersion: '5.22.0' },
    )
    expect(isSlotOverlapError(err)).toBe(true)
  })

  it('Prisma bilinen istek hatasi: meta icinde 23P01', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: '5.22.0',
      meta: { code: '23P01', message: 'exclusion violation' },
    })
    expect(isSlotOverlapError(err)).toBe(true)
  })

  it('kisit adi mesajda geciyorsa (kod gorunmese de) taninir', () => {
    expect(isSlotOverlapError(new Error('violates exclusion constraint "appointments_staff_no_overlap"'))).toBe(true)
  })

  it('benzersizlik ihlali (P2002) cakisma sayilmaz', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`referenceCode`)', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['referenceCode'] },
    })
    expect(isSlotOverlapError(err)).toBe(false)
  })

  it('bos, metin ve ilgisiz hatalar cakisma sayilmaz', () => {
    expect(isSlotOverlapError(null)).toBe(false)
    expect(isSlotOverlapError('23P01')).toBe(false)
    expect(isSlotOverlapError(new Error('connection refused'))).toBe(false)
  })

  it('SLOT_TAKEN govdesi tek tiptir ve SlotTakenError ayni kodu tasir', () => {
    expect(SLOT_TAKEN_BODY).toEqual({ error: { code: 'SLOT_TAKEN', message: 'Bu saat dolu, lütfen başka bir saat seçin.' } })
    expect(new SlotTakenError().code).toBe('SLOT_TAKEN')
  })
})
