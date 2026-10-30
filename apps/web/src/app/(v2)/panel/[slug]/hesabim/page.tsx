import type { Metadata } from 'next'
import { AccountScreen } from '@/features/account/account-screen'

export const metadata: Metadata = { title: 'Hesabım · BeautyOS' }

export default function AccountPage() {
  return <AccountScreen />
}
