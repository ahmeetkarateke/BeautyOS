// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn: projenin özel ölçekleri (denetim W3-1 Öneri)', () => {
  it('W3: sonraki köşe sınıfı önceki özel köşeyi ezer', () => {
    expect(cn('rounded-control', 'rounded-full')).toBe('rounded-full')
    expect(cn('rounded-card', 'rounded-tag')).toBe('rounded-tag')
  })

  it('W3: sonraki gölge önceki özel gölgeyi ezer', () => {
    expect(cn('shadow-menu', 'shadow-none')).toBe('shadow-none')
    expect(cn('shadow-floating', 'shadow-menu')).toBe('shadow-menu')
  })

  it('W3: ilgisiz sınıflar korunur', () => {
    expect(cn('rounded-card border', 'p-4')).toBe('rounded-card border p-4')
  })
})
