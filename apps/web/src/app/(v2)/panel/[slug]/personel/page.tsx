import type { Metadata } from 'next'
import { StaffScreen } from '@/features/staff/staff-screen'

export const metadata: Metadata = { title: 'Personel · BeautyOS' }

export default function StaffPage() {
  return <StaffScreen />
}
