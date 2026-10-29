// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, 'tokens.css'), 'utf8')

// :root bloğundaki "--ad: değer;" çiftleri (yorumlar atılır).
function parseTokens(source: string): Map<string, string> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const map = new Map<string, string>()
  for (const m of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!map.has(m[1])) map.set(m[1], m[2].trim())
  }
  return map
}

const tokens = parseTokens(css)

function resolve(name: string): string {
  let value = tokens.get(name)
  if (value === undefined) throw new Error(`token yok: ${name}`)
  for (let i = 0; i < 5; i++) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value)
    if (!ref) return value
    const next = tokens.get(ref[1])
    if (next === undefined) throw new Error(`token yok: ${ref[1]}`)
    value = next
  }
  throw new Error(`döngüsel ya da çok derin başvuru: ${name}`)
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(resolve(a)), luminance(resolve(b))].sort((x, y) => y - x)
  return (la + 0.05) / (lb + 0.05)
}

describe('tokens.css adlandırma (ADR-UI-04)', () => {
  it('K1: tasarim.md §3 anlamsal ve ham katman adlarının hepsi tanımlı', () => {
    const required = [
      '--ref-petrol-700', '--ref-powder-300', '--ref-gray-900', '--ref-green-700', '--ref-amber-800', '--ref-red-600',
      '--color-page', '--color-surface', '--color-surface-subtle', '--color-surface-active', '--color-border',
      '--color-border-subtle', '--color-border-control', '--color-text', '--color-text-secondary', '--color-text-muted',
      '--color-primary', '--color-primary-hover', '--color-primary-pressed', '--color-on-primary', '--color-primary-soft',
      '--color-primary-soft-text', '--color-accent', '--color-accent-mark', '--color-accent-text', '--color-focus',
      '--color-success', '--color-warning-bg', '--color-danger', '--color-info-bg', '--color-past-bg', '--color-past-text',
      '--status-pending-bg', '--status-confirmed-bg', '--status-inprogress-bg', '--status-completed-bg',
      '--status-cancelled-bg', '--status-noshow-bg', '--person-1-bg', '--person-5-mark', '--brand-booking',
      '--font-sans', '--text-xs', '--text-2xl', '--space-1', '--space-32', '--radius-card', '--shadow-floating',
      '--size-control', '--duration-fast', '--ease-out',
    ]
    for (const name of required) expect(tokens.has(name), name).toBe(true)
  })

  it('K1: Türkçe takma adlar (--renk-*, --durum-*, --kisi-*) taşınmamış', () => {
    const turkish = [...tokens.keys()].filter((n) => /^--(renk|durum|kisi|yazi|bosluk|yaricap|golge|sure)-/.test(n))
    expect(turkish).toEqual([])
  })

  it('K1: hex yalnız ham katmanda ve kişi tonlarında; anlamsal katman ham tokena başvurur', () => {
    const hexOutsideRaw = [...tokens].filter(([n, v]) => /#[0-9a-f]{3,8}\b/i.test(v) && !/^--(ref|person|brand)-/.test(n))
    expect(hexOutsideRaw).toEqual([])
  })

  it('K1: koyu tema bloğu kodda boş (yalnız yorum)', () => {
    expect(css).not.toMatch(/^\s*\[data-theme="dark"\]\s*\{/m)
  })
})

describe('kontrast (tasarim.md §3.1, WCAG 2.2 AA)', () => {
  const textPairs: Array<[string, string, number]> = [
    ['--color-text', '--color-surface', 15.9],
    ['--color-text-secondary', '--color-surface', 7.8],
    ['--color-text-muted', '--color-surface', 5.3],
    ['--color-text-muted', '--color-page', 4.8],
    ['--color-on-primary', '--color-primary', 11.6],
    ['--color-primary-soft-text', '--color-primary-soft', 11],
    ['--color-accent-text', '--color-surface', 5.6],
    ['--color-success-text', '--color-success-bg', 6.4],
    ['--color-warning-text', '--color-warning-bg', 6.9],
    ['--color-danger-text', '--color-danger-bg', 6.6],
    ['--color-past-text', '--color-past-bg', 4.5],
    ['--status-pending-text', '--status-pending-bg', 4.5],
    ['--status-confirmed-text', '--status-confirmed-bg', 4.5],
    ['--status-inprogress-text', '--status-inprogress-bg', 4.5],
    ['--status-completed-text', '--status-completed-bg', 4.5],
    ['--status-cancelled-text', '--status-cancelled-bg', 4.5],
    ['--status-noshow-text', '--status-noshow-bg', 4.5],
    ['--person-1-text', '--person-1-bg', 4.5],
    ['--person-2-text', '--person-2-bg', 4.5],
    ['--person-3-text', '--person-3-bg', 4.5],
    ['--person-4-text', '--person-4-bg', 4.5],
    ['--person-5-text', '--person-5-bg', 4.5],
    ['--brand-booking-on', '--brand-booking', 4.5],
  ]
  it.each(textPairs)('K1: %s / %s en az 4,5:1 ve belgedeki değerden (%f) en çok 0,3 düşük', (fg, bg, documented) => {
    const ratio = contrast(fg, bg)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeGreaterThanOrEqual(documented - 0.3)
  })

  const graphicPairs: Array<[string, string, number]> = [
    ['--color-border-control', '--color-surface', 3],
    ['--color-focus', '--color-surface', 3],
    ['--color-accent-mark', '--color-surface', 3],
  ]
  it.each(graphicPairs)('K1: grafik öğe %s / %s en az 3:1 (WCAG 1.4.11)', (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min)
  })

  it('K1: pudra dolgu (--color-accent) metin için kullanılamayacak kadar düşük kontrastlı olduğu belgelenmiş değerle uyuşur', () => {
    expect(contrast('--color-accent', '--color-surface')).toBeLessThan(3)
  })
})
