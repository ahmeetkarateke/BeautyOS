import type { Metadata } from 'next'
import { AccountsScreen } from '@/features/accounts/accounts-screen'

export const metadata: Metadata = { title: 'Hesaplar · BeautyOS' }

export default function AccountsPage() {
  return <AccountsScreen />
}
