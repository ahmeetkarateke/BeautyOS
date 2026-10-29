import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button (tasarim.md §4 Düğme)', () => {
  it('W3: işlem sürerken aria-busy taşır, "Kaydediliyor…" yazar ve tekrar basılamaz', () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" loading loadingText="Kaydediliyor…" onClick={onClick}>
        Müşteri ekle
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toContain('Kaydediliyor…')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('W3: işlem yokken tıklama çalışır ve aria-busy yoktur', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Müşteri ekle</Button>)
    const button = screen.getByRole('button', { name: 'Müşteri ekle' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  it('W3: devre dışı düğme okunur kalır (metin görünür) ve tıklanamaz', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Randevu oluştur
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Randevu oluştur' })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('W3: ikon düğmesi aria-label ile gelir ve erişilebilir adı o olur', () => {
    render(<Button variant="icon" aria-label="Kapat" icon={<svg aria-hidden="true" />} />)
    expect(screen.getByRole('button', { name: 'Kapat' })).toBeTruthy()
  })

  it('W3: varsayılan tür button (form göndermez), submit istenince submit', () => {
    const { rerender } = render(<Button>Vazgeç</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
    rerender(<Button type="submit">Kaydet</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('W3: her tür ayrı sınıf alır (birincil, ikincil, metin, tehlike, dolu tehlike)', () => {
    const variants = ['primary', 'secondary', 'text', 'danger', 'danger-solid'] as const
    const classes = variants.map((variant) => {
      const { unmount } = render(<Button variant={variant}>Ad</Button>)
      const cls = screen.getByRole('button').className
      unmount()
      return cls
    })
    expect(new Set(classes).size).toBe(variants.length)
  })
})
