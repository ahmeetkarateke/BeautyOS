import type { Metadata } from 'next'
import { NewCustomerScreen } from '@/features/customers/customer-form'

export const metadata: Metadata = { title: 'Yeni müşteri · BeautyOS' }

export default function NewCustomerPage() {
  return <NewCustomerScreen />
}
