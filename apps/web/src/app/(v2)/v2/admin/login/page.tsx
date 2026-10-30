import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { AdminLoginScreen } from '@/features/admin/screens'

export const metadata: Metadata = { title: 'Yönetim girişi · BeautyOS' }

export default function AdminLoginPage() {
  return (
    <AuthClientProvider>
      <AdminLoginScreen />
    </AuthClientProvider>
  )
}
