import type { LucideIcon } from 'lucide-react'
import {
  BookText, Truck, Layers, CalendarCheck, CalendarDays, Clock, HandCoins, Landmark, Menu, MessageCircle, Package,
  Percent, Plus, ReceiptText, Scissors, Settings, UserRound, Users, Wallet,
} from 'lucide-react'
import type { NavIconId } from '@/lib/v2/nav-config'
import { cn } from '@/ui/cn'

// nav-config veri dosyasıdır (React'e bağlı değil); ikon eşlemesi burada. Her ikon aria-hidden: ad her zaman yanındaki metindedir.
const ICONS: Record<NavIconId, LucideIcon> = {
  today: CalendarCheck,
  calendar: CalendarDays,
  clients: Users,
  clock: Clock,
  cash: Wallet,
  service: Scissors,
  staff: UserRound,
  commission: Percent,
  chat: MessageCircle,
  account: Landmark,
  ledger: BookText,
  invoice: ReceiptText,
  truck: Truck,
  box: Package,
  package: Layers,
  tip: HandCoins,
  settings: Settings,
  menu: Menu,
  plus: Plus,
}

export function NavIcon({ id, className }: { id: NavIconId; className?: string }) {
  const Icon = ICONS[id]
  return <Icon aria-hidden="true" className={cn('size-5 flex-none', className)} strokeWidth={1.75} />
}
