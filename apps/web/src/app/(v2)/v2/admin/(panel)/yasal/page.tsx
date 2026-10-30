import type { Metadata } from 'next'
import { LegalScreen } from '@/features/admin/screens'

export const metadata: Metadata = { title: 'Yasal belgeler · Sistem yönetimi' }

export default function AdminLegalPage() {
  return <LegalScreen />
}
