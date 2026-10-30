import type { Metadata } from 'next'
import { TenantDetailScreen } from '@/features/admin/screens'

export const metadata: Metadata = { title: 'Salon ayrıntısı · Sistem yönetimi' }

export default async function AdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TenantDetailScreen id={id} />
}
