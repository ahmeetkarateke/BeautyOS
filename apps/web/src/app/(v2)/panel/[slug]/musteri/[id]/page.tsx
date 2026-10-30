import type { Metadata } from 'next'
import { CustomerCardScreen } from '@/features/customers/customer-card'

export const metadata: Metadata = { title: 'Müşteri kartı · BeautyOS' }

export default async function CustomerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CustomerCardScreen customerId={id} />
}
