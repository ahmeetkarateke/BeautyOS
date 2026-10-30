import type { Metadata } from 'next'
import { ReportsScreen } from '@/features/reports/reports-screen'

export const metadata: Metadata = { title: 'Raporlar · BeautyOS' }

export default function ReportsPage() {
  return <ReportsScreen />
}
