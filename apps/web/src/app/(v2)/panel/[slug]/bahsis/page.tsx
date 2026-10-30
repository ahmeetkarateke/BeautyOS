import type { Metadata } from 'next'
import { TipsScreen } from '@/features/tips/tips-screen'

export const metadata: Metadata = { title: 'Bahşiş · BeautyOS' }

export default function TipsPage() {
  return <TipsScreen />
}
