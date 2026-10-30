import { describe, expect, it } from 'vitest'
import { canOpen, phoneLine, searchMode, searchPhase, visitLine, type CustomerRow } from './logic'

const row = (over: Partial<CustomerRow> = {}): CustomerRow => ({
  id: 'c1',
  fullName: 'Ayşe Demir',
  phone: '+90 532 111 22 33',
  phoneMasked: false,
  isOwn: true,
  totalVisits: 3,
  lastVisitDate: '2026-10-20T09:00:00.000Z',
  ...over,
})

describe('W17 searchPhase', () => {
  it('K1: sahip/müdür/resepsiyon listesi aramasız da yüklenir (idle değil, list)', () => {
    expect(searchPhase('', false)).toBe('list')
  })
  it('K1: liste kipinde 1 karakter henüz aramaz, 2 karakter arar', () => {
    expect(searchPhase('a', false)).toBe('list')
    expect(searchPhase('ay', false)).toBe('search')
  })
  it('K2: uzman kipinde liste yok: boşken "idle", 2 karakterde "short", 3 karakterde "search"', () => {
    expect(searchPhase('', true)).toBe('idle')
    expect(searchPhase('ay', true)).toBe('short')
    expect(searchPhase('ayş', true)).toBe('search')
  })
  it('K2: boşluklar sayılmaz ("  a  " 1 karakterdir)', () => {
    expect(searchPhase('  ay  ', true)).toBe('short')
  })
})

describe('W17 searchMode', () => {
  it('K2: customer.view_all izni yoksa arama kipidir', () => {
    expect(searchMode(false)).toBe(true)
    expect(searchMode(true)).toBe(false)
  })
})

describe('W17 canOpen (R4)', () => {
  it('K3: maskeli ve kendisinin olmayan kart açılmaz', () => {
    expect(canOpen(row({ phoneMasked: true, isOwn: false }))).toBe(false)
  })
  it('K3: kendi müşterisi (maskesiz) açılır', () => {
    expect(canOpen(row())).toBe(true)
  })
  it('K3: liste kipinde alanlar gelmezse (undefined) açılır: sahip her kartı açar', () => {
    expect(canOpen(row({ phoneMasked: undefined, isOwn: undefined }))).toBe(true)
  })
})

describe('W17 phoneLine', () => {
  it('K4: telefon yoksa (Telegram müşterisi) "Telefon yok" yazar, boş bırakmaz', () => {
    expect(phoneLine(row({ phone: null }))).toBe('Telefon yok')
    expect(phoneLine(row({ phone: '' }))).toBe('Telefon yok')
  })
  it('K4: telefon olduğu gibi gösterilir', () => {
    expect(phoneLine(row())).toBe('+90 532 111 22 33')
  })
})

describe('W17 visitLine', () => {
  it('K5: maskeli kayıtta ziyaret bilgisi yok (null) ise boş döner, uydurulmaz', () => {
    expect(visitLine(row({ totalVisits: null, lastVisitDate: null }))).toBe('')
  })
  it('K5: hiç ziyareti olmayan müşteri "Henüz ziyaret yok" yazar', () => {
    expect(visitLine(row({ totalVisits: 0, lastVisitDate: null }))).toBe('Henüz ziyaret yok')
  })
  it('K5: ziyaret sayısı ve son ziyaret tarihi', () => {
    expect(visitLine(row())).toBe('3 ziyaret · son: 20 Eki')
  })
})
