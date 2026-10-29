import type { Metadata } from 'next'
import { MyDayScreen } from '@/features/my-day/my-day-screen'

export const metadata: Metadata = { title: 'Günüm · BeautyOS' }

export default function MyDayPage() {
  return <MyDayScreen />
}
