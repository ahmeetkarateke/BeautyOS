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
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('beautyos_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('beautyos_token')
        set({ user: null, token: null })
      },
    }),
    {
      name: 'beautyos-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
