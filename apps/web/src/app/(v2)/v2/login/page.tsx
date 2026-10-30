import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { LoginScreen } from '@/features/auth/login-screen'

export const metadata: Metadata = { title: 'Giriş yap · BeautyOS' }

export default function LoginPage() {
  return (
    <AuthClientProvider>
      <LoginScreen />
    </AuthClientProvider>
  )
}
