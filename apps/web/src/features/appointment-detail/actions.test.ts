import { describe, expect, it } from 'vitest'
import { availableActions, isLocked, whatsappHref } from './actions'

const all = { canReschedule: true, canDelete: true, hasService: true }

describe('availableActions', () => {
  it('K-onaylı: başlat, saati değiştir, gelmedi, iptal, sil', () => {
    expect(availableActions('confirmed', all)).toEqual(['start', 'reschedule', 'noShow', 'cancel', 'delete'])
  })
  it('K-bekleyen: başlat ve gelmedi yok', () => {
    expect(availableActions('pending', all)).toEqual(['reschedule', 'cancel', 'delete'])
  })
  it.each(['completed', 'cancelled', 'no_show'] as const)('K-kilit: %s durumunda eylem yok', (status) => {
    expect(availableActions(status, all)).toEqual([])
    expect(isLocked(status)).toBe(true)
  })
  it('K-devam-eden: eylem yok (tamamlama W16)', () => {
    expect(availableActions('in_progress', all)).toEqual([])
  })
  it('K-yetki: saat değiştirme izni yoksa ya da hizmet kimliği yoksa saati değiştir çıkmaz; silme yalnız yetkiliye', () => {
    expect(availableActions('confirmed', { ...all, canReschedule: false })).not.toContain('reschedule')
    expect(availableActions('confirmed', { ...all, hasService: false })).not.toContain('reschedule')
    expect(availableActions('confirmed', { ...all, canDelete: false })).not.toContain('delete')
  })
})

describe('whatsappHref', () => {
  it('K-wa: ulusal numarayı 90 ön ekli bağlantıya çevirir', () => {
    expect(whatsappHref('0532 111 22 33')).toBe('https://wa.me/905321112233')
    expect(whatsappHref('+90 532 111 22 33')).toBe('https://wa.me/905321112233')
    expect(whatsappHref('5321112233')).toBe('https://wa.me/905321112233')
  })
  it('K-wa: tanınmayan numara bağlantı üretmez', () => {
    expect(whatsappHref('123')).toBeNull()
    expect(whatsappHref('')).toBeNull()
  })
})
