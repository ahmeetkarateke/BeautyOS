import { PanelSession } from '@/features/shell/panel-session'

// Panelin kabuğu: oturumu açar, menüyü ve kimliği kurar (W6). Salon kısaltması yalnız ipucudur; kiracıyı sunucu belirler.
export default async function PanelSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PanelSession slug={slug}>{children}</PanelSession>
}
