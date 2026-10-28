// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(path.join(__dirname, name), 'utf8')
const app = read('app.css')
const fonts = read('fonts.css')

describe('app.css genel kurallar (W2-K3)', () => {
  it('K3: :focus-visible 2 px odak halkası ve 2 px boşluk tanımlı', () => {
    expect(app).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)[^}]*outline-offset:\s*2px/)
  })

  it('K3: prefers-reduced-motion animasyon ve geçiş sürelerini sıfırlar', () => {
    expect(app).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*0\.001ms/)
    expect(app).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/)
  })

  it('ADR-UI-04: Tailwind yalnız v2 klasörlerini tarar ve varsayılan renk paleti kapalı', () => {
    expect(app).toMatch(/@import "tailwindcss" source\(none\)/)
    expect([...app.matchAll(/@source "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(['../app/(v2)', '../content', '../features', '../ui'])
    expect(app).toMatch(/--color-\*:\s*initial/)
  })
})

describe('fonts.css (W2-K2, ADR-UI-06)', () => {
  it('K2: Hanken Grotesk latin ve latin-ext dosyaları yerelden (url) yüklenir, Google isteği yok', () => {
    expect(fonts).toContain('hanken-grotesk-latin-wght-normal.woff2')
    expect(fonts).toContain('hanken-grotesk-latin-ext-wght-normal.woff2')
    expect(fonts).not.toMatch(/https?:\/\//)
  })

  it('K2: latin-ext aralığı ı İ Ş Ğ (U+0130-U+015F aralığını) kapsar', () => {
    const ext = /hanken-grotesk-latin-ext[\s\S]*?unicode-range:\s*([^;]+);/.exec(fonts)?.[1] ?? ''
    expect(ext).toContain('U+0100-02BA')
  })

  it('K2: latin aralığı ı (U+0131) kapsar', () => {
    const latin = /latin-wght-normal[\s\S]*?unicode-range:\s*([^;]+);/.exec(fonts)?.[1] ?? ''
    expect(latin).toContain('U+0131')
  })

  it('K2: ₺ (U+20BA) yalnız Inter dosyasından gelir', () => {
    const inter = /font-family: "Inter"[\s\S]*?unicode-range:\s*([^;]+);/.exec(fonts)?.[1]
    expect(inter?.trim()).toBe('U+20BA')
    const hanken = [...fonts.matchAll(/font-family: "Hanken Grotesk"[\s\S]*?unicode-range:\s*([^;]+);/g)].map((m) => m[1]).join(',')
    expect(hanken).not.toMatch(/U\+20BA\b/)
  })
})
