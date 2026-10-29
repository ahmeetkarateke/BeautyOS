import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { permissionsFor } from '@beautyos/shared'
import type { Role } from '@beautyos/shared'
import { buildNav } from './nav-config'
import { MeProvider, RequirePermission, useCan, useTerm } from './session'
import { parseMe, type Me } from './me'

const ALL_MODULES = [
  'dashboard', 'appointments', 'customers', 'services', 'staff', 'packages', 'tips', 'staff-payouts', 'finance',
  'current-accounts', 'purchase-invoices', 'suppliers', 'accounts', 'inventory', 'waitlist',
]

function makeMe(role: Role, over: Partial<Me['tenant']> = {}): Me {
  return {
    role,
    permissions: permissionsFor(role),
    staffId: role === 'staff' ? 's1' : null,
    user: { id: 'u1', email: 'a@b.c', name: 'Defne Kaya' },
    tenant: {
      slug: 'defne',
      name: 'Defne Güzellik',
      businessType: 'beauty_center',
      termSet: 'salon',
      terms: {},
      activeModules: ALL_MODULES,
      bookingMode: 'verified',
      timezone: 'Europe/Istanbul',
      ...over,
    },
  }
}

const ids = (me: Me) => buildNav(me).flatMap((g) => g.items.map((i) => i.id))

describe('menü: rol başına anlık görüntü (ADR-UI-09)', () => {
  it('K3: sahip tüm menüyü görür', () => {
    expect(ids(makeMe('owner'))).toEqual([
      'today', 'calendar', 'clients', 'waitlist', 'cash',
      'services', 'staff', 'assistant',
      'accounts', 'current-accounts', 'purchase-invoices', 'suppliers', 'inventory', 'packages', 'staff-payouts', 'tips',
      'settings',
    ])
  })

  it('K3: müdür asistan hariç sahibin menüsünü görür', () => {
    expect(ids(makeMe('manager'))).toEqual(ids(makeMe('owner')).filter((id) => id !== 'assistant'))
  })

  it('K3: uzman yalnız Günüm, Takvimim, Müşterilerim ve Primim öğelerini görür; rol dışı öğe gizlenir', () => {
    const items = buildNav(makeMe('staff')).flatMap((g) => g.items)
    expect(items.map((i) => i.id)).toEqual(['today', 'calendar', 'clients', 'my-commission'])
    expect(items.map((i) => i.label)).toEqual(['Günüm', 'Takvimim', 'Müşterilerim', 'Primim'])
  })

  it('K3: kapalı modül menüde görünmez', () => {
    const me = makeMe('owner', { activeModules: ALL_MODULES.filter((m) => m !== 'inventory' && m !== 'waitlist') })
    expect(ids(me)).not.toContain('inventory')
    expect(ids(me)).not.toContain('waitlist')
  })

  it('K3: bağlantılar /panel/<salon>/<yol> biçimindedir', () => {
    const items = buildNav(makeMe('owner')).flatMap((g) => g.items)
    expect(items.find((i) => i.id === 'today')?.href).toBe('/panel/defne/bugun')
    expect(items.find((i) => i.id === 'current-accounts')?.href).toBe('/panel/defne/cari')
  })

  it('K3: etiketler terim setinden gelir (klinik-danışan: Danışanlar, Uygulamalar)', () => {
    const items = buildNav(makeMe('owner', { termSet: 'clinic_client' })).flatMap((g) => g.items)
    expect(items.find((i) => i.id === 'clients')?.label).toBe('Danışanlar')
    expect(items.find((i) => i.id === 'services')?.label).toBe('Uygulamalar')
  })
})

function CanProbe({ permission }: { permission: Parameters<typeof useCan>[0] }) {
  return <p>{useCan(permission) ? 'var' : 'yok'}</p>
}

describe('izin (K3: useCan /auth/me yanıtından okur)', () => {
  it('K3: useCan me.permissions listesine bakar; web izni rolden hesaplamaz', () => {
    // Rol "owner" ama izin listesi boş: sunucunun söylediği geçerlidir.
    const me: Me = { ...makeMe('owner'), permissions: [] }
    render(
      <MeProvider me={me}>
        <CanProbe permission="finance.close_day" />
      </MeProvider>,
    )
    expect(screen.getByText('yok')).toBeTruthy()
  })

  it('K3: izin listede varsa true', () => {
    render(
      <MeProvider me={makeMe('manager')}>
        <CanProbe permission="finance.close_day" />
      </MeProvider>,
    )
    expect(screen.getByText('var')).toBeTruthy()
  })

  it('K3: MeProvider dışında useCan anlaşılır hata verir', () => {
    expect(() => render(<CanProbe permission="finance.close_day" />)).toThrow(/MeProvider/)
  })

  it('K3: RequirePermission izinli kullanıcıya içeriği, izinsize Yetkisiz ekranını (çıkış yoluyla) gösterir', () => {
    const { unmount } = render(
      <MeProvider me={makeMe('owner')}>
        <RequirePermission permission="finance.close_day">kasa içeriği</RequirePermission>
      </MeProvider>,
    )
    expect(screen.getByText('kasa içeriği')).toBeTruthy()
    unmount()
    render(
      <MeProvider me={makeMe('staff')}>
        <RequirePermission permission="finance.close_day">kasa içeriği</RequirePermission>
      </MeProvider>,
    )
    expect(screen.queryByText('kasa içeriği')).toBeNull()
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bugün’e dön' }).getAttribute('href')).toBe('/panel/defne/bugun')
  })
})

function TermProbe({ term, form }: { term: 'client' | 'expert' | 'service' | 'business'; form?: 'nom' | 'plural' | 'acc' | 'dat' | 'gen' }) {
  const t = useTerm()
  return <p>{t(term, form)}</p>
}

describe('terim (K3: useTerm /auth/me yanıtından okur)', () => {
  it.each([
    ['salon', 'client', 'müşteri', 'müşteriyi', 'müşteriye'],
    ['clinic_client', 'client', 'danışan', 'danışanı', 'danışana'],
    ['clinic_patient', 'client', 'hasta', 'hastayı', 'hastaya'],
  ] as const)('K3: %s setinde %s beş biçimi yazar (ek üretilmez, tabloda yazılıdır)', (set, term, nom, acc, dat) => {
    for (const [form, expected] of [['nom', nom], ['acc', acc], ['dat', dat]] as const) {
      const { unmount } = render(
        <MeProvider me={makeMe('owner', { termSet: set })}>
          <TermProbe term={term} form={form} />
        </MeProvider>,
      )
      expect(screen.getByText(expected)).toBeTruthy()
      unmount()
    }
  })

  it('K3: hasta setinde hizmet "işlem", uzman "hekim" olur; "tedavi" hiçbir yerde yok', () => {
    render(
      <MeProvider me={makeMe('owner', { termSet: 'clinic_patient' })}>
        <TermProbe term="service" />
        <TermProbe term="expert" />
      </MeProvider>,
    )
    expect(screen.getByText('işlem')).toBeTruthy()
    expect(screen.getByText('hekim')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/tedavi/i)
  })

  it('K3: sahibin özel terimi (terms) setin varsayılanını ezer; girilmeyen biçim setten gelir', () => {
    render(
      <MeProvider me={makeMe('owner', { terms: { client: 'misafir', 'client.acc': 'misafiri' } })}>
        <TermProbe term="client" />
        <TermProbe term="client" form="acc" />
        <TermProbe term="client" form="dat" />
      </MeProvider>,
    )
    expect(screen.getByText('misafir')).toBeTruthy()
    expect(screen.getByText('misafiri')).toBeTruthy()
    expect(screen.getByText('müşteriye')).toBeTruthy()
  })
})

describe('/auth/me yanıtı doğrulama (A1 sözleşmesi)', () => {
  it('K3: geçerli yanıtı Me olarak döner', () => {
    const me = makeMe('owner')
    expect(parseMe(JSON.parse(JSON.stringify(me)))).toEqual(me)
  })

  it('K3: eksik alan ya da bilinmeyen terim seti hata verir (kapalı başarısızlık)', () => {
    expect(() => parseMe({})).toThrow()
    expect(() => parseMe({ ...makeMe('owner'), tenant: { ...makeMe('owner').tenant, termSet: 'bilinmeyen' } })).toThrow()
  })
})
