import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { ResetScreen } from '@/features/auth/reset-screen'

// Belirteç adreste taşınır (ADR-0046): başka sitelere Referer gitmesin.
export const metadata: Metadata = { title: 'Yeni şifre · BeautyOS', referrer: 'no-referrer' }

export default function ResetPasswordPage() {
  return (
    <AuthClientProvider>
      <ResetScreen />
    </AuthClientProvider>
  )
}
