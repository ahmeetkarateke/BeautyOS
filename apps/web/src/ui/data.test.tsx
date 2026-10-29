import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './data-table'
import { buildDayRange, DayStrip } from './day-strip'
import { TimeSlots } from './time-slots'

type Row = { id: string; name: string; service: string; total: number }
const rows: Row[] = [
  { id: 'a', name: 'Ayşe Yılmaz', service: 'Saç boyama', total: 450 },
  { id: 'b', name: 'Elif Kaya', service: 'Manikür', total: 300 },
]
const columns = [
  { key: 'name', header: 'Müşteri', cell: (r: Row) => r.name, primary: true },
  { key: 'service', header: 'Hizmet', cell: (r: Row) => r.service },
  { key: 'total', header: 'Tutar', cell: (r: Row) => `₺${r.total}`, align: 'right' as const },
]

describe('Tablo (tasarim.md §4)', () => {
  it('W4: masaüstü tablosu sütun başlıklarını th scope=col ile verir ve satırları yazar', () => {
    render(<DataTable aria-label="Randevu listesi" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const table = screen.getByRole('table', { name: 'Randevu listesi' })
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual(['Müşteri', 'Hizmet', 'Tutar'])
    expect(headers[0].getAttribute('scope')).toBe('col')
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('W4: sayı sütunu sağa yaslı ve tabular; zebra yok', () => {
    render(<DataTable aria-label="Liste" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const cell = within(screen.getByRole('table')).getAllByText('₺450')[0].closest('td') as HTMLElement
    expect(cell.className).toContain('text-right')
    expect(cell.className).toContain('tabular-nums')
    expect(document.querySelector('tbody')?.innerHTML).not.toMatch(/odd:|even:/)
  })

  it('W4: toplam satırı tfoot içinde', () => {
    render(
      <DataTable
        aria-label="Liste"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        footer={{ name: 'Toplam', total: '₺750' }}
      />,
    )
    const tfoot = document.querySelector('tfoot') as HTMLElement
    expect(tfoot.textContent).toContain('Toplam')
    expect(tfoot.textContent).toContain('₺750')
  })

  it('W4: 640 px altında satıra döner: ana sütun başlık, diğer alanlar etiketiyle 2. satıra iner, alan düşmez', () => {
    render(<DataTable aria-label="Liste" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const cards = document.querySelectorAll('[data-row-card]')
    expect(cards).toHaveLength(2)
    const first = cards[0] as HTMLElement
    expect(within(first).getByText('Ayşe Yılmaz')).toBeTruthy()
    expect(first.textContent).toContain('Hizmet')
    expect(first.textContent).toContain('Saç boyama')
    expect(first.textContent).toContain('Tutar')
    expect(first.textContent).toContain('₺450')
  })

  it('W4: masaüstü tablosu 640 px altında gizlenir, satır listesi 640 px üstünde gizlenir', () => {
    render(<DataTable aria-label="Liste" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(screen.getByRole('table').parentElement?.className).toContain('max-sm:hidden')
    expect((document.querySelector('[data-row-list]') as HTMLElement).className).toContain('sm:hidden')
  })

  it('W4: onRowPress verilirse satır kartı düğmedir ve tıklanır', () => {
    const onRowPress = vi.fn()
    render(<DataTable aria-label="Liste" columns={columns} rows={rows} rowKey={(r) => r.id} onRowPress={onRowPress} />)
    fireEvent.click(document.querySelectorAll('[data-row-card] button')[1] as HTMLElement)
    expect(onRowPress).toHaveBeenCalledWith(rows[1])
  })
})

describe('Gün şeridi', () => {
  it('W4: buildDayRange ardışık 14 gün üretir (ay sınırını geçer)', () => {
    const days = buildDayRange('2026-10-29', 14)
    expect(days).toHaveLength(14)
    expect(days[0]).toBe('2026-10-29')
    expect(days[3]).toBe('2026-11-01')
    expect(days[13]).toBe('2026-11-11')
  })

  it('W4: seçili gün aria-pressed, kapalı gün devre dışı ve adında "kapalı" yazar', () => {
    const onSelect = vi.fn()
    render(
      <DayStrip
        days={[{ date: '2026-10-29' }, { date: '2026-10-30' }, { date: '2026-10-31', closed: true }]}
        selected="2026-10-30"
        onSelect={onSelect}
      />,
    )
    expect(screen.getByRole('group', { name: 'Tarih seçin' })).toBeTruthy()
    const selected = screen.getByRole('button', { name: /30 Ekim/ })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    const closed = screen.getByRole('button', { name: /31 Ekim.*kapalı/ }) as HTMLButtonElement
    expect(closed.disabled).toBe(true)
    expect(closed.className).toContain('border-dashed')
    fireEvent.click(screen.getByRole('button', { name: /29 Ekim/ }))
    expect(onSelect).toHaveBeenCalledWith('2026-10-29')
  })

  it('W4: gün adı kısa (Per), gün numarası görünür; şerit kendi içinde kayar', () => {
    render(<DayStrip days={[{ date: '2026-10-29' }]} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('Per')).toBeTruthy()
    expect(screen.getByText('29')).toBeTruthy()
    expect(screen.getByRole('group').className).toContain('overflow-x-auto')
  })
})

describe('Saat ızgarası', () => {
  it('W4: yalnız verilen boş saatler düğme olur; seçili aria-pressed taşır', () => {
    const onSelect = vi.fn()
    render(<TimeSlots slots={['09:00', '09:30', '11:00']} selected="09:30" onSelect={onSelect} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '09:30' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '11:00' }))
    expect(onSelect).toHaveBeenCalledWith('11:00')
  })

  it('W4: düğme 76 px genişliğinde ve tabular rakamlıdır', () => {
    render(<TimeSlots slots={['09:00']} selected={null} onSelect={() => {}} />)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('w-19')
    expect(cls).toContain('tabular-nums')
  })

  it('W4: yüklenirken "Boş saatler getiriliyor…" duyurulur ve düğme yoktur', () => {
    render(<TimeSlots slots={[]} selected={null} onSelect={() => {}} loading />)
    expect(screen.getByRole('status').textContent).toContain('Boş saatler getiriliyor…')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('W4: boş saat yoksa nedenini ve çıkış yolunu söyler', () => {
    render(<TimeSlots slots={[]} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('Bu gün boş saat yok. Başka bir gün seçin.')).toBeTruthy()
  })
})
