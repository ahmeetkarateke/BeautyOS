import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Admin {
  id: string
  email: string
  name: string
}

interface AdminState {
  admin: Admin | null
  adminToken: string | null
  _hasHydrated: boolean
  setAdmin: (admin: Admin, token: string) => void
  logoutAdmin: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      admin: null,
      adminToken: null,
      _hasHydrated: false,
      setAdmin: (admin, token) => {
        localStorage.setItem('beautyos_admin_token', token)
        set({ admin, adminToken: token })
      },
      logoutAdmin: () => {
        localStorage.removeItem('beautyos_admin_token')
        set({ admin: null, adminToken: null })
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'beautyos-admin',
      partialize: (state) => ({ admin: state.admin, adminToken: state.adminToken }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
