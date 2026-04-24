import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: string
  tenantSlug: string
}

interface AuthState {
  user: User | null
  token: string | null
  onboardingCompleted: boolean
  _hasHydrated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
  completeOnboarding: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      onboardingCompleted: false,
      _hasHydrated: false,
      setAuth: (user, token) => {
        localStorage.setItem('beautyos_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('beautyos_token')
        set({ user: null, token: null, onboardingCompleted: false })
      },
      completeOnboarding: () => set({ onboardingCompleted: true }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'beautyos-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        onboardingCompleted: state.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
