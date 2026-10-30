import { describe, expect, it } from 'vitest'
import { emptyInvite, inviteBody, inviteErrorText, validateInvite } from './invite-logic'

const ok = { ...emptyInvite, fullName: 'Ece Kaya', email: 'ece@ornek.com' }

describe('W21 davet doğrulama', () => {
  it('K1: geçerli davet hatasızdır; unvan boşsa gövdede yok, e-posta kırpılır', () => {
    expect(validateInvite(ok)).toEqual({})
    expect(inviteBody({ ...ok, email: ' ece@ornek.com ' })).toEqual({ fullName: 'Ece Kaya', email: 'ece@ornek.com', role: 'staff' })
    expect(inviteBody({ ...ok, title: ' Kuaför ' }).title).toBe('Kuaför')
  })
  it('K2: ad en az 2 karakter (e-posta geçerli)', () => {
    expect(Object.keys(validateInvite({ ...ok, fullName: ' E ' }))).toEqual(['fullName'])
  })
  it('K3: e-posta biçimi (ad geçerli)', () => {
    expect(Object.keys(validateInvite({ ...ok, email: 'ece@ornek' }))).toEqual(['email'])
    expect(Object.keys(validateInvite({ ...ok, email: '' }))).toEqual(['email'])
  })
  it('K4: unvan en çok 100 karakter', () => {
    expect(Object.keys(validateInvite({ ...ok, title: 'x'.repeat(101) }))).toEqual(['title'])
  })
  it('K5: DUPLICATE_EMAIL davet bağlamında girişe yönlendirmez', () => {
    expect(inviteErrorText('DUPLICATE_EMAIL', 'x')).toBe('Bu e-posta için kullanıcı ya da bekleyen davet zaten var.')
    expect(inviteErrorText('INVITE_LIMIT', 'Sınır')).toBe('Sınır')
  })
})
