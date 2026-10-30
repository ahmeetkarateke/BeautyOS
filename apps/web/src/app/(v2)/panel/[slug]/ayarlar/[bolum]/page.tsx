import type { Metadata } from 'next'
import { SettingsSection } from '@/features/settings/settings-screens'

export const metadata: Metadata = { title: 'Ayarlar · BeautyOS' }

export default async function SettingsSectionPage({ params }: { params: Promise<{ bolum: string }> }) {
  const { bolum } = await params
  return <SettingsSection section={bolum} />
}
