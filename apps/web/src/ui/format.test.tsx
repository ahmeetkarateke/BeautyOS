import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DateTime, formatDate, formatDateTime, formatMoney, formatTime, Money } from './format'

describe('Para (tasarim.md §3.2, web-design-guidelines tr)', () => {
  it('W4: tam tutar ondalıksız, kuruşlu tutar iki haneli; binlik nokta, ondalık virgül, ₺ önde', () => {
    expect(formatMoney(450)).toBe('₺450')
    expect(formatMoney(1250.5)).toBe('₺1.250,50')
    expect(formatMoney(0)).toBe('₺0')
    expect(formatMoney(1234567)).toBe('₺1.234.567')
  })

  it('W4: eksi tutar işaretle başlar', () => {
    expect(formatMoney(-120)).toBe('-₺120')
  })

  it('W4: Money bileşeni tabular rakamla yazar ve sarmaz', () => {
    render(<Money value={1250.5} />)
    const node = screen.getByText('₺1.250,50')
    expect(node.className).toContain('tabular-nums')
    expect(node.className).toContain('whitespace-nowrap')
  })
})

describe('Tarih ve saat (Europe/Istanbul)', () => {
  it('W4: saat İstanbul saatiyle yazılır (UTC+3)', () => {
    expect(formatTime('2026-10-29T11:32:00Z')).toBe('14:32')
    expect(formatTime(new Date('2026-10-29T21:30:00Z'))).toBe('00:30')
  })

  it('W4: gün, ay adı ve yıl Türkçe; gece yarısı sonrası İstanbul gününe geçer', () => {
    expect(formatDate('2026-10-29T11:32:00Z')).toBe('29 Ekim 2026')
    expect(formatDate('2026-10-29T21:30:00Z')).toBe('30 Ekim 2026')
    expect(formatDate('2026-10-29T11:32:00Z', 'short')).toBe('29 Eki')
    expect(formatDate('2026-10-29T11:32:00Z', 'weekday')).toBe('Perşembe')
  })

  it('W4: tarih ve saat birlikte', () => {
    expect(formatDateTime('2026-10-29T11:32:00Z')).toBe('29 Ekim 2026, 14:32')
  })

  it('W4: DateTime bileşeni time öğesi, makine okunur datetime ile gelir', () => {
    const { container } = render(<DateTime value="2026-10-29T11:32:00Z" variant="time" />)
    const el = container.querySelector('time') as HTMLTimeElement
    expect(el.textContent).toBe('14:32')
    expect(el.getAttribute('datetime')).toBe('2026-10-29T11:32:00.000Z')
    expect(el.className).toContain('tabular-nums')
  })

  it('W4: geçersiz tarih çökmez, boş yazar', () => {
    expect(formatTime('bozuk')).toBe('')
    expect(formatDate('bozuk')).toBe('')
  })
})
