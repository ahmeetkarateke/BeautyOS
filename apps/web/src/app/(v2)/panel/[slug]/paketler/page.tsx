import type { Metadata } from 'next'
import { PackagesScreen } from '@/features/packages/packages-screen'

export const metadata: Metadata = { title: 'Paketler · BeautyOS' }

export default function PackagesPage() {
  return <PackagesScreen />
}
