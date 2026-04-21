/**
 * Dependencies required (not yet installed in apps/web):
 *   npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
 * And add a vitest.config.ts similar to apps/api/vitest.config.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Step1Salon } from '../../app/onboarding/steps/Step1Salon'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../components/ui/toaster', () => ({
  toast: vi.fn(),
}))

import { apiFetch } from '../../lib/api'
import { toast } from '../../components/ui/toaster'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('Step1Salon', () => {
  const onNext = vi.fn()
  const slug = 'test-salon'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation errors when form is submitted empty', async () => {
    const user = userEvent.setup()
    render(<Step1Salon slug={slug} onNext={onNext} />, { wrapper })

    await user.click(screen.getByRole('button', { name: /İleri/i }))

    await waitFor(() => {
      expect(screen.getByText('Salon adı en az 2 karakter olmalıdır')).toBeInTheDocument()
      expect(screen.getByText('Adres giriniz')).toBeInTheDocument()
      expect(screen.getByText('Geçerli bir telefon numarası girin')).toBeInTheDocument()
    })

    expect(onNext).not.toHaveBeenCalled()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('calls apiFetch with correct data and advances on success', async () => {
    const user = userEvent.setup()
    vi.mocked(apiFetch).mockResolvedValueOnce({})

    render(<Step1Salon slug={slug} onNext={onNext} />, { wrapper })

    await user.type(screen.getByLabelText(/Salon Adı/i), 'Güzellik Salonu')
    await user.type(screen.getByLabelText(/Adres/i), 'Kadıköy, İstanbul')
    await user.type(screen.getByLabelText(/Telefon/i), '05551234567')

    // Working hours has a default value, so no need to type

    await user.click(screen.getByRole('button', { name: /İleri/i }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/api/v1/tenants/${slug}/settings`,
        expect.objectContaining({ method: 'PATCH' }),
      )
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it('shows toast and does not advance when API fails', async () => {
    const user = userEvent.setup()
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Sunucu hatası'))

    render(<Step1Salon slug={slug} onNext={onNext} />, { wrapper })

    await user.type(screen.getByLabelText(/Salon Adı/i), 'Güzellik Salonu')
    await user.type(screen.getByLabelText(/Adres/i), 'Kadıköy, İstanbul')
    await user.type(screen.getByLabelText(/Telefon/i), '05551234567')

    await user.click(screen.getByRole('button', { name: /İleri/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Sunucu hatası', 'error')
      expect(onNext).not.toHaveBeenCalled()
    })
  })
})
