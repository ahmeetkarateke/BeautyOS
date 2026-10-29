import type { Metadata } from 'next'
import { StockScreen } from '@/features/stock/stock-screen'

export const metadata: Metadata = { title: 'Stok · BeautyOS' }

export default function StockPage() {
  return <StockScreen />
}
