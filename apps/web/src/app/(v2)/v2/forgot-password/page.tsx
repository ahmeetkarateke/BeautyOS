import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { ForgotScreen } from '@/features/auth/forgot-screen'

export const metadata: Metadata = { title: 'Şifremi unuttum · BeautyOS' }

export default function ForgotPasswordPage() {
  return (
    <AuthClientProvider>
      <ForgotScreen />
    </AuthClientProvider>
  )
}
