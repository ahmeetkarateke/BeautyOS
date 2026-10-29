import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Chip, ChipRow } from './chip'
import { SegmentedControl } from './segmented-control'
import { SelectionCard } from './selection-card'

const options = [
  { value: 'gun', label: 'Gün' },
  { value: 'hafta', label: 'Hafta' },
  { value: 'ay', label: 'Ay' },
]

describe('Parçalı seçim (tasarim.md §4)', () => {
  it('W3: grup adı ve seçili seçenek erişilebilirlikte bildirilir', () => {
    render(<SegmentedControl aria-label="Dönem" options={options} value="hafta" onValueChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Dönem' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Hafta' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Gün' }).getAttribute('aria-checked')).toBe('false')
  })

  it('W3: tıklama değeri değiştirir; sağ ok sonrakini seçer ve sondan başa sarar', () => {
    const onValueChange = vi.fn()
    render(<SegmentedControl aria-label="Dönem" options={options} value="ay" onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Gün' }))
    expect(onValueChange).toHaveBeenLastCalledWith('gun')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Ay' }), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenLastCalledWith('gun')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Ay' }), { key: 'ArrowLeft' })
    expect(onValueChange).toHaveBeenLastCalledWith('hafta')
  })

  it('W3: yalnız seçili seçenek sekme sırasındadır (roving tabindex)', () => {
    render(<SegmentedControl aria-label="Dönem" options={options} value="hafta" onValueChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Hafta' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('radio', { name: 'Gün' }).getAttribute('tabindex')).toBe('-1')
  })

  it('W3: 2-5 dışı seçenek sayısı geliştirmede hata verir', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<SegmentedControl aria-label="Tek" options={[options[0]]} value="gun" onValueChange={() => {}} />),
    ).toThrow(/2.*5/)
    spy.mockRestore()
  })
})

describe('Seçim kartı', () => {
  it('W3: seçili durum aria-pressed ile bildirilir, tıklama onSelect çağırır', () => {
    const onSelect = vi.fn()
    render(<SelectionCard title="Saç kesimi" description="45 dk" price="₺450" selected={false} onSelect={onSelect} />)
    const card = screen.getByRole('button', { name: /Saç kesimi/ })
    expect(card.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('W3: fiyat sağda tabular rakamla ve kart adına dahil edilir', () => {
    render(<SelectionCard title="Manikür" price="₺300" selected onSelect={() => {}} />)
    const card = screen.getByRole('button', { name: /Manikür/ })
    expect(card.getAttribute('aria-pressed')).toBe('true')
    const price = screen.getByText('₺300')
    expect(price.className).toContain('tabular-nums')
  })
})

describe('Çip', () => {
  it('W3: seçili çip aria-pressed=true taşır ve tıklanınca onToggle çağrılır', () => {
    const onToggle = vi.fn()
    render(
      <ChipRow aria-label="Durum süzgeci">
        <Chip pressed onToggle={onToggle}>
          Tümü
        </Chip>
        <Chip pressed={false} count={3} onToggle={onToggle}>
          Bekleyen
        </Chip>
      </ChipRow>,
    )
    expect(screen.getByRole('button', { name: 'Tümü' }).getAttribute('aria-pressed')).toBe('true')
    const second = screen.getByRole('button', { name: /Bekleyen/ })
    expect(second.getAttribute('aria-pressed')).toBe('false')
    expect(second.textContent).toContain('3')
    fireEvent.click(second)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('W3: çip satırı kendi içinde yatay kayar (sayfa kaymaz)', () => {
    render(
      <ChipRow aria-label="Süzgeç">
        <Chip pressed={false} onToggle={() => {}}>
          A
        </Chip>
      </ChipRow>,
    )
    expect(screen.getByRole('group', { name: 'Süzgeç' }).className).toContain('overflow-x-auto')
  })
})

describe('Parçalı seçim: değer eşleşmezse (denetim W3-1 Önemli 1)', () => {
  it('W3: value hiçbir seçenekle eşleşmezse ilk seçenek sekme sırasındadır (klavyeyle erişilebilir)', () => {
    render(<SegmentedControl aria-label="Ödeme" options={options} value="" onValueChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Gün' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('radio', { name: 'Hafta' }).getAttribute('tabindex')).toBe('-1')
    expect(screen.getByRole('radio', { name: 'Gün' }).getAttribute('aria-checked')).toBe('false')
  })

  it('W3: değer eşleşmezken ok tuşu ilk/sonraki seçeneği seçer', () => {
    const onValueChange = vi.fn()
    render(<SegmentedControl aria-label="Ödeme" options={options} value="" onValueChange={onValueChange} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gün' }), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenLastCalledWith('hafta')
  })
})
