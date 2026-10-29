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

describe('ui-lint: yalıtım beyaz listesi (denetim W2-1 Kritik 1)', () => {
  const bad = [
    "import '@/app/(legacy)/globals.css'",
    "import { apiFetch } from '../lib/api'",
    "import { x } from '@/lib/yeni-eski-dosya'",
    "import { x } from '@/lib/api/sub'",
    "export { Button } from '@/components/ui/button'",
    "const m = await import('@/store/auth')",
  ]
  it.each(bad)('ADR-UI-02: ui/ altından yasak içe aktarma yakalanır: %s', (code) => {
    expect(rules('ui/a.tsx', code)).toEqual(['eski-klasor-importu'])
  })

  it('ADR-UI-02: features/x/ altından ../../lib/api yakalanır', () => {
    expect(rules('features/x/a.tsx', "import { apiFetch } from '../../lib/api'")).toEqual(['eski-klasor-importu'])
  })

  it('ADR-UI-02: v2 içi göreli ve takma adlı içe aktarmalar serbest', () => {
    expect(rules('ui/a.tsx', "import { Button } from '../ui/button'")).toEqual([])
    expect(rules('features/x/a.tsx', "import { cn } from '../../ui/cn'")).toEqual([])
    expect(rules('ui/a.tsx', "import './local.css'")).toEqual([])
    expect(rules('features/x/a.tsx', "import { Button } from '@/ui/button'")).toEqual([])
    expect(rules('app/(v2)/layout.tsx', "import '@/styles/app.css'")).toEqual([])
    expect(rules('proxy.ts', "import { resolveRoute } from './lib/v2/routes'")).toEqual([])
    expect(rules('ui/a.tsx', "import { useState } from 'react'")).toEqual([])
  })

  it('ADR-UI-02: çok satırlı içe aktarmanın from satırı da denetlenir', () => {
    expect(rules('ui/a.tsx', "import {\n  a,\n} from '@/lib/api'")).toEqual(['eski-klasor-importu'])
  })
})

describe('ui-lint: rem/em ve keyfi kalınlık (denetim W2-1 Öneri)', () => {
  it('tasarim.md §3.2: 0,75 rem altı yazı ve font-[700] yakalanır; 0,75 rem ve 600 serbest', () => {
    expect(rules('ui/a.tsx', '<p className="text-[0.6rem]" />')).toEqual(['12px-alti-yazi'])
    expect(rules('ui/a.tsx', '<p className="text-[0.7rem]" />')).toEqual(['12px-alti-yazi'])
    expect(rules('ui/a.tsx', '<p className="text-[0.75rem]" />')).toEqual([])
    expect(rules('ui/a.tsx', '<p className="font-[700]" />')).toEqual(['kalin-700'])
    expect(rules('ui/a.tsx', '<p className="font-[600]" />')).toEqual([])
  })
})

describe('ui-lint: gerçek v2 klasörleri', () => {
  it('ADR-UI-04: v2 klasörlerinde ihlal yok', () => {
    const found = lintV2(path.join(__dirname)) as Array<Finding & { file: string }>
    expect(found.map((f) => `${f.file}:${f.line} ${f.rule}`)).toEqual([])
  })
})
