import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const signOut = vi.fn(async () => {})
vi.mock('@/lib/v2/api-context', () => ({ useApiClient: () => client, signOut: (...args: unknown[]) => signOut(...(args as [])) }))
import { AccountScreen } from './account-screen'

type Init = { method?: string; body?: Record<string, unknown> }
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

function mount() {
  return render(
    <MeProvider me={makeMe('owner')}>
      <ToastProvider>
        <AccountScreen />
      </ToastProvider>
    </MeProvider>,
  )
}
function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Mevcut şifre'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }))
}

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue({ ok: true })
  signOut.mockClear()
})
afterEach(cleanup)

describe('W28 Hesabım', () => {
  it('K1: profil bilgisi görünür', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Hesabım' })).toBeTruthy()
    expect(screen.getByText(makeMe('owner').user.email)).toBeTruthy()
  })
  it('K2: hatalı alanla istek gitmez, hata alanın altında yazılır', async () => {
    mount()
    fill('Eski1234', 'kisa', 'kisa')
    expect(await screen.findByText('Şifre en az 8 karakter olmalı.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })
  it('K3: başarıda doğru uca PATCH gider ve oturum kapatılır', async () => {
    mount()
    fill('Eski1234', 'Yeni12345', 'Yeni12345')
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    const [path, init] = writes()[0] as [string, Init]
    expect(path).toBe(`/api/v1/tenants/${makeMe('owner').tenant.slug}/users/${makeMe('owner').user.id}/password`)
    expect(init).toEqual({ method: 'PATCH', body: { currentPassword: 'Eski1234', newPassword: 'Yeni12345' } })
  })
  it('K4: mevcut şifre yanlışsa anlaşılır hata çıkar, oturum kapanmaz, form açık kalır', async () => {
    request.mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_PASSWORD' }))
    mount()
    fill('Yanlis123', 'Yeni12345', 'Yeni12345')
    expect(await screen.findByText('Mevcut şifreniz hatalı. Tekrar deneyin.')).toBeTruthy()
    expect(signOut).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Şifreyi değiştir' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('K5: Çıkış yap düğmesi oturumu kapatır', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
