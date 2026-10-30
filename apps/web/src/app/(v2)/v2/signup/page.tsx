import type { Metadata } from 'next'
import { AuthClientProvider } from '@/features/auth/auth-shell'
import { SignupScreen } from '@/features/auth/signup-screen'

export const metadata: Metadata = { title: 'Hesap oluştur · BeautyOS' }

export default function SignupPage() {
  return (
    <AuthClientProvider>
      <SignupScreen />
    </AuthClientProvider>
  )
}
