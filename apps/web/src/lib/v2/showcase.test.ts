// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseShowcaseFlag } from './showcase'

describe('vitrin sayfası bayrağı (W4: yalnız staging)', () => {
  it('W4: yalnız "1" açar', () => {
    expect(parseShowcaseFlag('1')).toBe(true)
  })

  it.each([undefined, '', '0', 'true', 'TRUE', 'yes', ' 1', 'site,panel'])('W4: %j kapalı kalır (kapalı başarısızlık)', (raw) => {
    expect(parseShowcaseFlag(raw)).toBe(false)
  })
})
