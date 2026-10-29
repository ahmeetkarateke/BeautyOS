import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Step1Salon } from '../../app/(legacy)/onboarding/steps/Step1Salon'

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('../../components/ui/toaster', () => ({ toast: vi.fn() }))

import { apiFetch } from '../../lib/api'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('Step1Salon işletme türü (isteğe bağlı alan)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('işletme türü seçilmeden form gönderilir ve sonraki adıma geçilir', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    vi.mocked(apiFetch).mockResolvedValueOnce({})
    render(<Step1Salon slug="test-salon" onNext={onNext} />, { wrapper })

    await user.type(screen.getByLabelText(/Salon Adı/i), 'Güzellik Salonu')
    await user.type(screen.getByLabelText(/Adres/i), 'Kadıköy, İstanbul')
    await user.type(screen.getByLabelText(/Telefon/i), '05551234567')
    await user.click(screen.getByRole('button', { name: /İleri/i }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1)
      expect(String(vi.mocked(apiFetch).mock.calls[0][1]?.body)).not.toContain('businessType')
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })
})
