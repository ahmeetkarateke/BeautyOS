import { describe, expect, it } from 'vitest'
import { parseSurfaces } from './flags'

describe('parseSurfaces', () => {
  it('K2: tanımsız ya da boş değer hiçbir yüzeyi açmaz (kapalı başarısızlık)', () => {
    expect(parseSurfaces(undefined).size).toBe(0)
    expect(parseSurfaces('').size).toBe(0)
  })

  it('K2: virgülle ayrılmış yüzeyleri açar', () => {
    expect([...parseSurfaces('site,auth,panel,book,admin')].sort()).toEqual(['admin', 'auth', 'book', 'panel', 'site'])
    expect([...parseSurfaces('panel')]).toEqual(['panel'])
  })

  it('K2: bilinmeyen parçayı yok sayar, geçerli olanı korur', () => {
    expect([...parseSurfaces('panel,hepsi,,site;auth')]).toEqual(['panel'])
  })

  it('K2: boşluk ve büyük I içeren girdiyi dil bağımsız çözer (Türk I)', () => {
    expect([...parseSurfaces(' PANEL , SITE')].sort()).toEqual(['panel', 'site'])
  })

  it('K2: noktalı büyük İ içeren parça hiçbir yüzeyi açmaz', () => {
    expect(parseSurfaces('SİTE').size).toBe(0)
  })
})
