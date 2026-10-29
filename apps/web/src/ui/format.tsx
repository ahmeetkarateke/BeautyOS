import { cn } from './cn'

// Para ve tarih biçimleri (web-design-guidelines Türkçe uyarlamaları): tr-TR, Europe/Istanbul, ₺ önde, tabular rakam.
const TZ = 'Europe/Istanbul'

const moneyWhole = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const moneyCents = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Tam tutar ondalıksız ("₺450"), kuruşlu tutar iki haneli ("₺1.250,50"). */
export function formatMoney(value: number): string {
  const whole = Number.isInteger(value)
  return (whole ? moneyWhole : moneyCents).format(value)
}

const dateParts = {
  long: new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }),
  short: new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: TZ }),
  weekday: new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: TZ }),
} as const
const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ })

export type DateStyle = keyof typeof dateParts

function toDate(input: Date | string): Date | null {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(input: Date | string, style: DateStyle = 'long'): string {
  const date = toDate(input)
  return date ? dateParts[style].format(date) : ''
}

export function formatTime(input: Date | string): string {
  const date = toDate(input)
  return date ? timeFormat.format(date) : ''
}

export function formatDateTime(input: Date | string): string {
  const date = toDate(input)
  return date ? `${formatDate(date)}, ${formatTime(date)}` : ''
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatMoney(value)}</span>
}

const dateTimeFormatters = { date: formatDate, time: formatTime, datetime: formatDateTime } as const

export function DateTime({
  value,
  variant = 'datetime',
  className,
}: {
  value: Date | string
  variant?: keyof typeof dateTimeFormatters
  className?: string
}) {
  const date = toDate(value)
  if (!date) return null
  return (
    <time dateTime={date.toISOString()} className={cn('tabular-nums', className)}>
      {dateTimeFormatters[variant](date)}
    </time>
  )
}
