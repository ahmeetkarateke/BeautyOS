import type { Metadata } from 'next'
import { SettingsHub } from '@/features/settings/settings-screens'

export const metadata: Metadata = { title: 'Ayarlar · BeautyOS' }

export default function SettingsPage() {
  return <SettingsHub />
}
