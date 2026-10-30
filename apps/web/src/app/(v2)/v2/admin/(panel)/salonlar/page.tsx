import type { Metadata } from 'next'
import { TenantsScreen } from '@/features/admin/screens'

export const metadata: Metadata = { title: 'Salonlar · Sistem yönetimi' }

export default function AdminTenantsPage() {
  return <TenantsScreen />
}
