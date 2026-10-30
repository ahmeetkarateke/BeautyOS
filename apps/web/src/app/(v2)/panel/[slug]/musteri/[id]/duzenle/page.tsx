import type { Metadata } from 'next'
import { EditCustomerScreen } from '@/features/customers/customer-form'

export const metadata: Metadata = { title: 'Müşteri düzenle · BeautyOS' }

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditCustomerScreen customerId={id} />
}
