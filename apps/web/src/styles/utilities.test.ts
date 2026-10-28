// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { beforeAll, describe, expect, it } from 'vitest'

// Bileşenlerin kullandığı anlamsal sınıflar gerçekten üretiliyor mu? Üretilmeyen sınıf sessizce stilsiz kalır.
// (--status-* ve --person-* Tailwind renk ad alanında değildir; app.css'te @theme inline ile bağlanır.)
const file = path.join(__dirname, 'app.css')
let css = ''
const esc = (c: string) => c.replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`)

const statuses = ['pending', 'confirmed', 'inprogress', 'completed', 'cancelled', 'noshow']
const persons = [1, 2, 3, 4, 5]
const candidates = [
  ...statuses.flatMap((s) => [`bg-status-${s}-bg`, `text-status-${s}-text`]),
  ...persons.flatMap((n) => [`bg-person-${n}-bg`, `text-person-${n}-text`, `bg-person-${n}-mark`]),
]

beforeAll(async () => {
  // @source inline: sınıfları kaynak dosyada kullanılmasalar da üretmeye zorlar.
  const input = `${readFileSync(file, 'utf8')}\n@source inline("${candidates.join(' ')}");`
  css = (await postcss([tailwind()]).process(input, { from: file })).css
}, 30_000)

describe('app.css üretilen sınıflar (W3)', () => {
  it.each(statuses)('W3: durum rengi %s için bg ve text sınıfı üretilir', (s) => {
    expect(css).toContain(`.${esc(`bg-status-${s}-bg`)}`)
    expect(css).toContain(`.${esc(`text-status-${s}-text`)}`)
  })

  it.each(persons)('W3: kişi tonu %i için bg, text ve mark sınıfı üretilir', (n) => {
    expect(css).toContain(`.${esc(`bg-person-${n}-bg`)}`)
    expect(css).toContain(`.${esc(`text-person-${n}-text`)}`)
    expect(css).toContain(`.${esc(`bg-person-${n}-mark`)}`)
  })

  it('W3: varsayılan Tailwind paleti kapalı kalır (bg-gray-500 üretilmez)', () => {
    expect(css).not.toContain('.bg-gray-500')
  })
})
