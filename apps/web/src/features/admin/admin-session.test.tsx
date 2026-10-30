import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/lib/v2/api-client'
import '@/ui/test-polyfills'
import { AdminSession } from './admin-session'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))

const fakeClient = (restored: boolean) => ({ restoreSession: async () => restored, request: vi.fn(), setAccessToken: vi.fn() }) as unknown as ApiClient

afterEach(cleanup)

describe('W33 yönetim oturum kapısı', () => {
  it('K17: oturum yoksa içerik çizilmez ve giriş ekranına gidilir', async () => {
    const navigate = vi.fn()
    render(
      <AdminSession createClient={() => fakeClient(false)} navigate={navigate}>
        <p>gizli içerik</p>
      </AdminSession>,
    )
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/login'))
    expect(screen.queryByText('gizli içerik')).toBeNull()
  })
  it('K18: oturum varsa içerik ve yönetim menüsü çizilir', async () => {
    const navigate = vi.fn()
    render(
      <AdminSession createClient={() => fakeClient(true)} navigate={navigate}>
        <p>gizli içerik</p>
      </AdminSession>,
    )
    expect(await screen.findByText('gizli içerik')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Salonlar' }).getAttribute('href')).toBe('/admin/salonlar')
    expect(screen.getByRole('link', { name: 'Genel bakış' }).getAttribute('aria-current')).toBe('page')
    expect(navigate).not.toHaveBeenCalled()
  })
})
