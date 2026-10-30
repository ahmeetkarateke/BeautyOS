import type { Metadata } from 'next'
import { CashScreen } from '@/features/cash/cash-screen'

export const metadata: Metadata = { title: 'Kasa · BeautyOS' }

export default function CashPage() {
  return <CashScreen />
}
