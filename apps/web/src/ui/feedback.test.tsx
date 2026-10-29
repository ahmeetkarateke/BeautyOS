import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from './banner'
import { EmptyState, ErrorState, Forbidden } from './states'

describe('Şerit (Banner)', () => {
  it('W3: hata şeridi role=alert, diğerleri role=status taşır', () => {
    const { unmount } = render(<Banner tone="error">Randevu kaydedilemedi.</Banner>)
    expect(screen.getByRole('alert').textContent).toContain('Randevu kaydedilemedi.')
    unmount()
    for (const tone of ['info', 'warning', 'success'] as const) {
      const r = render(<Banner tone={tone}>Mesaj</Banner>)
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
      r.unmount()
    }
  })

  it('W3: tek eylem düğmesi çalışır; ikon süstür (aria-hidden)', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Banner tone="warning" action={{ label: 'Planı yükselt', onClick }}>
        Deneme süreniz 3 gün sonra bitiyor.
      </Banner>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Planı yükselt' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('W3: her ton ayrı görünüm sınıfı alır (renk tek başına anlam taşımaz: ikon da farklı)', () => {
    const seen = new Set<string>()
    const icons = new Set<string>()
    for (const tone of ['info', 'warning', 'success', 'error'] as const) {
      const { container, unmount } = render(<Banner tone={tone}>x</Banner>)
      seen.add((container.firstElementChild as HTMLElement).className)
      icons.add(container.querySelector('svg')?.innerHTML ?? '')
      unmount()
    }
    expect(seen.size).toBe(4)
    expect(icons.size).toBe(4)
  })
})

describe('Boş / hata / yetkisiz durumlar', () => {
  it('W3: boş durum başlık, açıklama ve tek birincil eylem gösterir', () => {
    render(
      <EmptyState
        title="Henüz müşteri yok."
        description="Müşteri ekleyince randevuları buradan takip edersiniz."
        action={{ label: 'Müşteri ekle', onClick: () => {} }}
      />,
    )
    expect(screen.getByText('Henüz müşteri yok.')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Müşteri ekle' })).toBeTruthy()
  })

  it('W3: eylemsiz boş durum düğme göstermez', () => {
    render(<EmptyState title="Bekleyen müşteri yok." />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('W3: hata durumu "X yüklenemedi" der, Yeniden dene çalışır, role=alert taşır', () => {
    const onRetry = vi.fn()
    render(<ErrorState subject="Müşteri listesi" onRetry={onRetry} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Müşteri listesi yüklenemedi.')
    expect(alert.textContent).toContain('Bağlantınızı kontrol edip tekrar deneyin.')
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('W3: son başarılı yükleme saati İstanbul saatiyle yazılır', () => {
    render(<ErrorState subject="Takvim" onRetry={() => {}} lastLoadedAt={new Date('2026-10-29T11:32:00Z')} />)
    expect(screen.getByRole('alert').textContent).toContain('14:32')
  })

  it('W3: yeniden deneme sürerken düğme meşgul olur ve tekrar basılamaz', () => {
    const onRetry = vi.fn()
    render(<ErrorState subject="Takvim" onRetry={onRetry} retrying />)
    const button = screen.getByRole('button', { name: /Deneniyor…/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('W3: yetkisiz durum suçlamaz, çıkış yolu verir ve teknik terim içermez', () => {
    render(<Forbidden action={<a href="/bugun">Bugün’e dön</a>} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('Bu sayfayı görme yetkiniz yok.')
    expect(text).toContain('Gerekiyorsa salon sahibinden yetki isteyin.')
    expect(text).not.toMatch(/403|forbidden|tenant|hata/i)
    expect(screen.getByRole('link', { name: 'Bugün’e dön' })).toBeTruthy()
  })
})
