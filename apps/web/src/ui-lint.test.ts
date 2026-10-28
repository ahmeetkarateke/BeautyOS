// @vitest-environment node
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintSource, lintV2 } from '../scripts/ui-lint/lint.mjs'

type Finding = { rule: string; line: number; text: string }
const rules = (file: string, code: string): string[] => (lintSource(file, code) as Finding[]).map((f) => f.rule)

describe('ui-lint kuralları', () => {
  it('ADR-UI-04: bileşende hex renk yakalanır, tokens.css içinde serbest', () => {
    expect(rules('ui/button.tsx', "const c = '#1F3E47'")).toEqual(['hex-renk'])
    expect(rules('styles/tokens.css', '--ref-petrol-700: #1F3E47;')).toEqual([])
  })

  it('ADR-UI-04: ham Tailwind renk sınıfları ve dark: yakalanır', () => {
    expect(rules('ui/a.tsx', '<div className="bg-white" />')).toEqual(['ham-renk-sinifi'])
    expect(rules('ui/a.tsx', '<div className="text-gray-500" />')).toEqual(['ham-renk-sinifi'])
    expect(rules('ui/a.tsx', '<div className="bg-surface dark:bg-black" />')).toEqual(expect.arrayContaining(['dark-varyanti']))
    expect(rules('ui/a.tsx', '<div className="bg-surface text-text" />')).toEqual([])
  })

  it('tasarim.md §3.2: 12 px altı yazı ve 700 kalınlık yakalanır; 12 px serbest', () => {
    expect(rules('ui/a.tsx', '<p className="text-[10px]" />')).toEqual(['12px-alti-yazi'])
    expect(rules('ui/a.css', '.a { font-size: 11px }')).toEqual(['12px-alti-yazi'])
    expect(rules('ui/a.tsx', '<p className="text-[12px]" />')).toEqual([])
    expect(rules('ui/a.tsx', '<b className="font-bold" />')).toEqual(['kalin-700'])
  })

  it('ADR-UI-02: eski klasörlerden içe aktarma yakalanır, v2 içi serbest', () => {
    expect(rules('ui/a.tsx', "import { Button } from '@/components/ui/button'")).toEqual(['eski-klasor-importu'])
    expect(rules('ui/a.tsx', "import { apiFetch } from '@/lib/api'")).toEqual(['eski-klasor-importu'])
    expect(rules('ui/a.tsx', "import { useAuthStore } from '@/store/auth'")).toEqual(['eski-klasor-importu'])
    expect(rules('ui/a.tsx', "import x from '../../components/foo'")).toEqual(['eski-klasor-importu'])
    expect(rules('ui/a.tsx', "import { resolveRoute } from '@/lib/v2/routes'")).toEqual([])
    expect(rules('ui/a.tsx', "import { cva } from 'class-variance-authority'")).toEqual([])
  })

  it('yorum satırındaki ihlal sayılmaz', () => {
    expect(rules('ui/a.tsx', "// bg-white eskiden vardı, #fff değil")).toEqual([])
    expect(rules('ui/a.css', '/* #fff ve dark: */ .a { color: var(--color-text) }')).toEqual([])
  })
})

describe('ui-lint: gerçek v2 klasörleri', () => {
  it('ADR-UI-04: v2 klasörlerinde ihlal yok', () => {
    const found = lintV2(path.join(__dirname)) as Array<Finding & { file: string }>
    expect(found.map((f) => `${f.file}:${f.line} ${f.rule}`)).toEqual([])
  })
})
