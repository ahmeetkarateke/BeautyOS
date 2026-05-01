import { TenantShell } from '@/components/layout/tenant-shell'

interface TenantLayoutProps {
  children: React.ReactNode
  params: { slug: string }
}

export default function TenantLayout({ children, params }: TenantLayoutProps) {
  return <TenantShell slug={params.slug}>{children}</TenantShell>
}
