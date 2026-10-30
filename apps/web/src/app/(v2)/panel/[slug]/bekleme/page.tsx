import type { Metadata } from 'next'
import { WaitlistScreen } from '@/features/waitlist/waitlist-screen'

export const metadata: Metadata = { title: 'Bekleme listesi · BeautyOS' }

export default function WaitlistPage() {
  return <WaitlistScreen />
}
