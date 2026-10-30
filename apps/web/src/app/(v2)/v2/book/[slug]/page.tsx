import type { Metadata } from 'next'
import { BookingScreen } from '@/features/booking/booking-screen'
import { PublicClientProvider } from '@/features/booking/public-shell'

export const metadata: Metadata = { title: 'Online randevu', referrer: 'no-referrer' }

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <PublicClientProvider>
      <BookingScreen slug={slug} />
    </PublicClientProvider>
  )
}
