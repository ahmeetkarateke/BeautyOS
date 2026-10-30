import type { Metadata } from 'next'
import { InvoicesScreen } from '@/features/invoices/invoices-screen'

export const metadata: Metadata = { title: 'Alış faturaları · BeautyOS' }

export default function InvoicesPage() {
  return <InvoicesScreen />
}
