import type { Metadata } from 'next'
import { CalendarScreen } from '@/features/calendar/calendar-screen'

export const metadata: Metadata = { title: 'Takvim · BeautyOS' }

export default function CalendarPage() {
  return <CalendarScreen />
}
