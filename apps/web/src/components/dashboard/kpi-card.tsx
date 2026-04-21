import { type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  loading?: boolean
}

export function KpiCard({ title, value, subtitle, icon: Icon, iconColor = 'bg-primary-100 text-primary', trend, loading }: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-11 w-11 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-card-hover transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-salon-muted">{title}</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-salon-muted mt-1">{subtitle}</p>}
            {trend && (
              <p className={cn('text-xs font-medium mt-1.5', trend.value >= 0 ? 'text-success' : 'text-red-500')}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
