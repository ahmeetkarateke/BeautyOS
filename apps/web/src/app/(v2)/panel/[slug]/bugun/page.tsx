import type { Metadata } from 'next'
import { TodayScreen } from '@/features/today/today-screen'

export const metadata: Metadata = { title: 'Bugün · BeautyOS' }

export default function TodayPage() {
  return <TodayScreen />
}
