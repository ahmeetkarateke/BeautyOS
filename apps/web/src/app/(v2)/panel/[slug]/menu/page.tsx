import type { Metadata } from 'next'
import { MenuScreen } from '@/features/shell/menu-screen'

export const metadata: Metadata = { title: 'Menü · BeautyOS' }

export default function MenuPage() {
  return <MenuScreen />
}
