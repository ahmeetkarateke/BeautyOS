import { AdminSession } from '@/features/admin/admin-session'

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminSession>{children}</AdminSession>
}
