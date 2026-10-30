import type { Metadata } from 'next'
import { PrimimScreen } from '@/features/reports/primim-screen'

export const metadata: Metadata = { title: 'Primim · BeautyOS' }

export default function PrimimPage() {
  return <PrimimScreen />
}
