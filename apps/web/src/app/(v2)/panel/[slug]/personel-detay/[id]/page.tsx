import type { Metadata } from 'next'
import { StaffDetailScreen } from '@/features/staff/staff-detail'

export const metadata: Metadata = { title: 'Personel ayrıntısı · BeautyOS' }

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StaffDetailScreen staffId={id} />
}
