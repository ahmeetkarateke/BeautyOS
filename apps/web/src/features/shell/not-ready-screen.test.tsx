import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { NotReadyScreen } from './not-ready-screen'

afterEach(cleanup)

const mount = (rest: string[], role: Parameters<typeof makeMe>[0] = 'owner') =>
  render(
    <MeProvider me={makeMe(role)}>
      <NotReadyScreen rest={rest} />
    </MeProvider>,
  )

describe('W6 K6: hazır olmayan ekran', () => {
  it('K6: "Eski ekranda açın" bağlantısı eski arayüzdeki karşılığa ?eski=1 ile gider (yoksa yeni panele geri yönlenir)', () => {
    mount(['takvim'])
    const link = screen.getByRole('link', { name: 'Eski ekranda açın' })
    expect(link.getAttribute('href')).toBe('/tenant/defne/appointments?eski=1')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bu ekran yeni arayüzde hazırlanıyor.')
  })

  it('K6: ayrıntı yolunda kimlik taşınır (musteri/c1 -> customers/c1)', () => {
    mount(['musteri', 'c1'])
    expect(screen.getByRole('link', { name: 'Eski ekranda açın' }).getAttribute('href')).toBe('/tenant/defne/customers/c1?eski=1')
  })

  it('K6: eski karşılığı olmayan ekranda bağlantı yok, Bugün’e dön var', () => {
    mount(['gunum'])
    expect(screen.queryByRole('link', { name: 'Eski ekranda açın' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Bugün’e dön' }).getAttribute('href')).toBe('/panel/defne/bugun')
  })

  it('K6: yol parçaları kullanıcı girdisidir; bağlantıya kodlanarak girer (../ ile kaçamaz)', () => {
    mount(['musteri', '../x'])
    const href = screen.getByRole('link', { name: 'Eski ekranda açın' }).getAttribute('href') ?? ''
    expect(href).toBe('/tenant/defne/customers/..%2Fx?eski=1')
  })
})
