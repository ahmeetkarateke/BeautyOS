import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { InviteScreen } from '@/features/auth/invite-screen'

// Davet belirteci adresin # parçasındadır (ADR-0046): başka sitelere Referer gitmesin.
export const metadata: Metadata = { title: 'Daveti kabul et · BeautyOS', referrer: 'no-referrer' }

export default function InvitePage() {
  return (
    <AuthClientProvider>
      <InviteScreen />
    </AuthClientProvider>
  )
}
