import type { Metadata } from 'next'
import { OverviewScreen } from '@/features/admin/screens'

export const metadata: Metadata = { title: 'Genel bakış · Sistem yönetimi' }

export default function AdminOverviewPage() {
  return <OverviewScreen />
}
