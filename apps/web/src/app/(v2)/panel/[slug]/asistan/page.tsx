import type { Metadata } from 'next'
import { AssistantScreen } from '@/features/assistant/assistant-screen'

export const metadata: Metadata = { title: 'Mesaj asistanı · BeautyOS' }

export default function AssistantPage() {
  return <AssistantScreen />
}
