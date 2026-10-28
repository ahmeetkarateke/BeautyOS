import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge, STATUS_LABELS } from './status-badge'

describe('StatusBadge (tasarim.md §3.1 randevu durumları)', () => {
  it('W3: altı durumun her biri Türkçe adını metin olarak yazar (yalnız renkle verilmez)', () => {
    expect(STATUS_LABELS).toEqual({
      pending: 'Bekliyor',
      confirmed: 'Onaylandı',
      in_progress: 'Devam ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal edildi',
      no_show: 'Gelmedi',
    })
    for (const [status, label] of Object.entries(STATUS_LABELS)) {
      const { unmount } = render(<StatusBadge status={status as keyof typeof STATUS_LABELS} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })

  it('W3: "Yakında" etiketi gri, noktasız ve metinle gelir', () => {
    render(<StatusBadge status="soon" />)
    const badge = screen.getByText('Yakında')
    expect(badge.getAttribute('data-dot')).toBe('false')
  })

  it('W3: durum noktası dekoratif olduğundan ekran okuyucudan gizlenir', () => {
    const { container } = render(<StatusBadge status="pending" />)
    const dot = container.querySelector('[data-status-dot]')
    expect(dot?.getAttribute('aria-hidden')).toBe('true')
  })

  it('W3: iptal edildi adı üstü çizili değil, yalnız rozet kendi tonunu taşır', () => {
    render(<StatusBadge status="cancelled" />)
    expect(screen.getByText('İptal edildi').className).not.toContain('line-through')
  })
})
