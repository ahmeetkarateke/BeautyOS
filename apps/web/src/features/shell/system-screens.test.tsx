import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountInactiveScreen, ErrorScreen, NotFoundScreen, OfflineBar, SessionExpiredScreen } from './system-screens'

describe('W6 K5: sistem ekranları markalı, Türkçe, tek çıkış eylemli (tasarim.md §8.6)', () => {
  it('K5: 404 sayı göstermez, "Sayfa bulunamadı." başlığı ve ana sayfaya dönüş verir', () => {
    render(<NotFoundScreen />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sayfa bulunamadı.')
    expect(document.body.textContent).not.toMatch(/404/)
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' }).getAttribute('href')).toBe('/')
  })

  it('K5: genel hata teknik ayrıntı ve referans numarası göstermez, destek adresi yer tutucu, Yeniden dene çalışır', () => {
    const reset = vi.fn()
    render(<ErrorScreen reset={reset} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Beklenmeyen bir sorun oluştu.')
    expect(document.body.textContent).toContain('[DESTEK_E-POSTASI]')
    expect(document.body.textContent).not.toMatch(/Referans/)
    screen.getByRole('button', { name: 'Yeniden dene' }).click()
    expect(reset).toHaveBeenCalledOnce()
  })

  it('K5: oturum doldu ekranı yeniden giriş bağlantısı verir', () => {
    render(<SessionExpiredScreen />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Oturumunuzun süresi doldu.')
    expect(screen.getByRole('link', { name: 'Giriş yap' }).getAttribute('href')).toBe('/login')
  })

  it('K5: hesap aktif değil ekranı suçlamaz, çıkış yolunu söyler', () => {
    render(<AccountInactiveScreen />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hesabınız şu an aktif değil.')
    expect(screen.getByRole('link', { name: 'Giriş ekranına dön' }).getAttribute('href')).toBe('/login')
  })

  it('K5: çevrimdışı şeridi role=status ile duyurur ve "çevrimdışı çalışır" iddiası yoktur', () => {
    render(<OfflineBar />)
    const bar = screen.getByRole('status')
    expect(bar.textContent).toContain('İnternet bağlantınız yok.')
    expect(bar.textContent).toContain('Bağlantı gelince')
    expect(bar.textContent).not.toMatch(/çevrimdışı çalış/i)
  })
})
