import { TenantShell } from '@/components/layout/tenant-shell'

interface TenantLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function TenantLayout(props: TenantLayoutProps) {
  const params = await props.params

  const {
    children
  } = props

  return <TenantShell slug={params.slug}>{children}</TenantShell>
}
