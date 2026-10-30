import type { Metadata } from 'next'
import { PayoutsScreen } from '@/features/payouts/payouts-screen'

export const metadata: Metadata = { title: 'Personel ödemeleri · BeautyOS' }

export default function PayoutsPage() {
  return <PayoutsScreen />
}
