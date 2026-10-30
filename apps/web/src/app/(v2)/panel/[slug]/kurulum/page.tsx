import type { Metadata } from 'next'
import { SetupWizard } from '@/features/setup-wizard/wizard'

export const metadata: Metadata = { title: 'Kurulum · BeautyOS' }

export default function SetupPage() {
  return <SetupWizard />
}
