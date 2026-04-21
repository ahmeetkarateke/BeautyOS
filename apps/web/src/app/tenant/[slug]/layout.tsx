import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AuthGuard } from '@/components/layout/auth-guard'

interface TenantLayoutProps {
  children: React.ReactNode
  params: { slug: string }
}

export default function TenantLayout({ children, params }: TenantLayoutProps) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-salon-bg">
        {/* Desktop Sidebar */}
        <div className="hidden sm:flex">
          <Sidebar tenantSlug={params.slug} />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-16 sm:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileNav tenantSlug={params.slug} />
      </div>
    </AuthGuard>
  )
}
