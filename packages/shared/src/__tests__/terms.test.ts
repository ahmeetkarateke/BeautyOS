import { describe, it, expect } from 'vitest'
import * as shared from '../index'

const forms = (key: string, word: string) => ({ [key]: word, [`${key}.plural`]: word, [`${key}.acc`]: word, [`${key}.dat`]: word, [`${key}.gen`]: word })

describe('validateTermOverrides (A5 / ADR-0031)', () => {
  it('bos nesne ve bes bicimli terim gecerli', () => {
    expect(shared.validateTermOverrides({})).toBeNull()
    expect(shared.validateTermOverrides(forms('client', 'Hasta'))).toBeNull()
  })

  it('her terim anahtari beyaz listededir', () => {
    expect([...shared.TERM_KEYS].sort()).toEqual(['business', 'client', 'clientsMine', 'expert', 'owner', 'service'])
    expect([...shared.TERM_FORMS]).toEqual(['nom', 'plural', 'acc', 'dat', 'gen'])
  })

  it('sozluk disi anahtar: unknown_key', () => {
    expect(shared.validateTermOverrides({ ...forms('client', 'Hasta'), foo: 'x' })).toEqual({ code: 'unknown_key', key: 'foo' })
  })

  it('bilinmeyen bicim: unknown_key (client.xyz)', () => {
    expect(shared.validateTermOverrides({ ...forms('client', 'Hasta'), 'client.xyz': 'x' })).toEqual({ code: 'unknown_key', key: 'client.xyz' })
  })

  it('eksik bicim: missing_forms ve eksikler listelenir', () => {
    expect(shared.validateTermOverrides({ client: 'Hasta', 'client.plural': 'Hastalar' })).toEqual({ code: 'missing_forms', key: 'client', missing: ['acc', 'dat', 'gen'] })
  })

  it('yalin hal hem `client` hem `client.nom` verilirse: duplicate_nom', () => {
    expect(shared.validateTermOverrides({ ...forms('client', 'Hasta'), 'client.nom': 'Hasta' })).toEqual({ code: 'duplicate_nom', key: 'client' })
  })

  it('Turk I vakasi: buyuk harfli anahtar bilinmeyen sayilir (harf donusumu yapilmaz)', () => {
    expect(shared.validateTermOverrides(forms('CLIENT', 'x'))?.code).toBe('unknown_key')
  })

  it('termOverrideKeyAllowed yalin ve bicimli anahtari kabul eder', () => {
    expect(shared.termOverrideKeyAllowed('client')).toBe(true)
    expect(shared.termOverrideKeyAllowed('client.gen')).toBe(true)
    expect(shared.termOverrideKeyAllowed('client.x')).toBe(false)
  })
})
