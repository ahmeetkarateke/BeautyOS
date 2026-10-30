import type { Metadata } from 'next'
import { ManageScreen } from '@/features/booking/manage-screen'
import { PublicClientProvider } from '@/features/booking/public-shell'

// Gizli bağlantı: adres # parçasında belirteç taşır; arama motorlarına kapalı, Referer gönderilmez (ADR-0046).
export const metadata: Metadata = { title: 'Randevunuz', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function ManagePage() {
  return (
    <PublicClientProvider>
      <ManageScreen />
    </PublicClientProvider>
  )
}
