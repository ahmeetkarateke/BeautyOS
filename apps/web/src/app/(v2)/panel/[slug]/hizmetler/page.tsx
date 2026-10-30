import type { Metadata } from 'next'
import { ServicesScreen } from '@/features/services/services-screen'

export const metadata: Metadata = { title: 'Hizmetler · BeautyOS' }

export default function ServicesPage() {
  return <ServicesScreen />
}
