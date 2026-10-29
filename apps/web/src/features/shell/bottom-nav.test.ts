import { describe, expect, it } from 'vitest'
import { buildBottomNav } from '@/lib/v2/nav-config'
import { makeMe } from '@/lib/v2/test-me'

const labels = (role: Parameters<typeof makeMe>[0], over?: Parameters<typeof makeMe>[1]) =>
  buildBottomNav(makeMe(role, over)).items.map((item) => item.label)

describe('W6 K1/K2: alt menü rol başına (tasarim.md §5)', () => {
  it.each(['owner', 'manager'] as const)('K2: %s için Bugün · Takvim · Müşteriler · Menü ve ortada "+"', (role) => {
    expect(labels(role)).toEqual(['Bugün', 'Takvim', 'Müşteriler', 'Menü'])
    expect(buildBottomNav(makeMe(role)).create).toEqual({ label: 'Randevu oluştur', href: '/panel/defne/takvim?yeni=randevu' })
  })

  it('K2: uzmanda Günüm · Takvimim · Müşterilerim · Menü', () => {
    expect(labels('staff')).toEqual(['Günüm', 'Takvimim', 'Müşterilerim', 'Menü'])
  })

  it('K2: klinik-hasta setinde uzmanın listesi Hastalarım', () => {
    expect(labels('staff', { termSet: 'clinic_patient' })).toContain('Hastalarım')
  })

  it('K3: kapalı modül alt menüde de görünmez; takvim kapalıyken "+" çizilmez', () => {
    const noCalendar = buildBottomNav(makeMe('owner', { activeModules: ['dashboard', 'customers'] }))
    expect(noCalendar.items.map((i) => i.label)).toEqual(['Bugün', 'Müşteriler', 'Menü'])
    expect(noCalendar.create).toBeNull()
  })

  it('K1: Menü öğesi menü ekranına gider ve bağlantılar salon adresini taşır', () => {
    const { items } = buildBottomNav(makeMe('owner'))
    expect(items.map((i) => i.href)).toEqual(['/panel/defne/bugun', '/panel/defne/takvim', '/panel/defne/musteriler', '/panel/defne/menu'])
  })
})
