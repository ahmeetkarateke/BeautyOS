import { afterEach, describe, expect, it } from 'vitest'
import { permissionsFor, ROLES } from '@beautyos/shared'
import { buildMeProfile } from '../lib/me-profile'
import { MODULE_KEYS } from '../lib/modules'
import { resolveBookingMode } from '../lib/booking-mode'

const baseUser = { id: 'u1', email: 'a@b.test', fullName: 'Ayse Yilmaz', role: 'owner' as const }
const baseTenant = {
  slug: 'defne',
  name: 'Defne Guzellik',
  businessType: 'beauty_center' as const,
  settings: {} as unknown,
}

describe('A1: buildMeProfile', () => {
  it('A1-K1: yanit rol, etkin izin listesi, kiraci blogu ve staffId icerir', () => {
    const me = buildMeProfile({ user: baseUser, tenant: baseTenant, staffId: 's1', bookingMode: 'approval_required' })
    expect(me.role).toBe('owner')
    expect(me.permissions).toEqual(permissionsFor('owner'))
    expect(me.staffId).toBe('s1')
    expect(me.tenant).toEqual({
      slug: 'defne',
      name: 'Defne Guzellik',
      businessType: 'beauty_center',
      termSet: 'salon',
      terms: {},
      activeModules: [...MODULE_KEYS],
      bookingMode: 'approval_required',
      timezone: 'Europe/Istanbul',
    })
  })

  it('A1-K2: her rol icin permissions[] izin tablosundan gelir (staff finans izni almaz)', () => {
    for (const role of ROLES) {
      const me = buildMeProfile({ user: { ...baseUser, role }, tenant: baseTenant, staffId: null, bookingMode: 'verified' })
      expect(me.permissions).toEqual(permissionsFor(role))
    }
    const staff = buildMeProfile({ user: { ...baseUser, role: 'staff' }, tenant: baseTenant, staffId: null, bookingMode: 'verified' })
    expect(staff.permissions).not.toContain('finance.close_day')
    expect(staff.permissions).toContain('health.view')
  })

  it('A1-K3: staffProfile yoksa staffId null doner', () => {
    const me = buildMeProfile({ user: baseUser, tenant: baseTenant, staffId: null, bookingMode: 'verified' })
    expect(me.staffId).toBeNull()
  })

  it('A1-K4: yanit hassas alan tasimaz (passwordHash, token, telegram/whatsapp anahtari)', () => {
    const tenant = {
      ...baseTenant,
      settings: { whatsappApiToken: 'x', telegramBotToken: 'y', botRules: 'gizli kural' },
    }
    const me = buildMeProfile({
      user: { ...baseUser, passwordHash: 'h' } as typeof baseUser,
      tenant,
      staffId: null,
      bookingMode: 'verified',
    })
    const json = JSON.stringify(me)
    for (const forbidden of ['passwordHash', 'whatsappApiToken', 'telegramBotToken', 'botRules', 'gizli kural']) {
      expect(json).not.toContain(forbidden)
    }
  })

  it('A1-K5: settings.activeModules yalniz gecerli anahtarlari tasir; bos ya da gecersizse tum moduller', () => {
    const only = buildMeProfile({
      user: baseUser,
      tenant: { ...baseTenant, settings: { activeModules: ['dashboard', 'finance', 'bogus'] } },
      staffId: null,
      bookingMode: 'verified',
    })
    expect(only.tenant.activeModules).toEqual(['dashboard', 'finance'])

    for (const settings of [{ activeModules: [] }, { activeModules: ['bogus'] }, { activeModules: 'x' }, null]) {
      const me = buildMeProfile({ user: baseUser, tenant: { ...baseTenant, settings }, staffId: null, bookingMode: 'verified' })
      expect(me.tenant.activeModules).toEqual([...MODULE_KEYS])
    }
  })

  it('A1-K6: termSet gecerliyse settings\'ten, degilse salon; terms yalniz string-string ciftleri', () => {
    const ok = buildMeProfile({
      user: baseUser,
      tenant: { ...baseTenant, settings: { termSet: 'clinic_patient', termOverrides: { client: 'Hasta', n: 3, o: { a: 1 } } } },
      staffId: null,
      bookingMode: 'verified',
    })
    expect(ok.tenant.termSet).toBe('clinic_patient')
    expect(ok.tenant.terms).toEqual({ client: 'Hasta' })

    const bad = buildMeProfile({
      user: baseUser,
      tenant: { ...baseTenant, settings: { termSet: 'CLINIC_PATIENT' } },
      staffId: null,
      bookingMode: 'verified',
    })
    expect(bad.tenant.termSet).toBe('salon')
  })
})

describe('A1: resolveBookingMode', () => {
  const original = process.env.NETGSM_USERCODE
  afterEach(() => {
    if (original === undefined) delete process.env.NETGSM_USERCODE
    else process.env.NETGSM_USERCODE = original
  })

  it('A1-K7: SMS saglayicisi yapilandirilmamissa none / approval_required', () => {
    delete process.env.NETGSM_USERCODE
    expect(resolveBookingMode()).toEqual({ phoneVerification: 'none', bookingMode: 'approval_required' })
  })

  it('A1-K8: SMS saglayicisi yapilandirilmissa sms / verified', () => {
    process.env.NETGSM_USERCODE = 'kullanici'
    expect(resolveBookingMode()).toEqual({ phoneVerification: 'sms', bookingMode: 'verified' })
  })

  it('A1-K9: bos ya da bosluklu NETGSM_USERCODE saglayici sayilmaz', () => {
    process.env.NETGSM_USERCODE = '   '
    expect(resolveBookingMode().phoneVerification).toBe('none')
  })
})
