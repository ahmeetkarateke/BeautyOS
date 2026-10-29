import { ROLES } from '@beautyos/shared'
import { describe, expect, it } from 'vitest'
import { makeMe } from '@/lib/v2/test-me'
import { roleLabel } from './shell-helpers'

describe('roleLabel', () => {
  it('her rol için boş olmayan bir ad döner (yeni rol eklenince bu test uyarır)', () => {
    for (const role of ROLES) {
      expect(roleLabel(makeMe(role)).length, role).toBeGreaterThan(0)
    }
  })

  it('resepsiyon rolü "Resepsiyon" olarak görünür', () => {
    expect(roleLabel(makeMe('receptionist'))).toBe('Resepsiyon')
  })
})
