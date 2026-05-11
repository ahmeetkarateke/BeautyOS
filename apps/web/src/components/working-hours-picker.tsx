'use client'

import { cn } from '@/lib/utils'

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export interface DaySchedule { start: string; end: string }
export type WorkingHoursMap = Record<DayKey, DaySchedule | null>

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday',    label: 'Pazartesi', short: 'Pzt' },
  { key: 'tuesday',   label: 'Salı',      short: 'Sal' },
  { key: 'wednesday', label: 'Çarşamba',  short: 'Çar' },
  { key: 'thursday',  label: 'Perşembe',  short: 'Per' },
  { key: 'friday',    label: 'Cuma',      short: 'Cum' },
  { key: 'saturday',  label: 'Cumartesi', short: 'Cmt' },
  { key: 'sunday',    label: 'Pazar',     short: 'Paz' },
]

const DEFAULT_SCHEDULE: DaySchedule = { start: '09:00', end: '19:00' }

export const DEFAULT_WORKING_HOURS: WorkingHoursMap = {
  monday: DEFAULT_SCHEDULE,
  tuesday: DEFAULT_SCHEDULE,
  wednesday: DEFAULT_SCHEDULE,
  thursday: DEFAULT_SCHEDULE,
  friday: DEFAULT_SCHEDULE,
  saturday: DEFAULT_SCHEDULE,
  sunday: null,
}

/** Hem eski string ("09:00-19:00") hem yeni JSON formatını kabul eder. */
export function parseWorkingHours(value: unknown): WorkingHoursMap {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if ('monday' in obj || 'tuesday' in obj || 'sunday' in obj) {
      const result: Partial<WorkingHoursMap> = {}
      for (const { key } of DAYS) {
        const day = obj[key]
        if (day && typeof day === 'object' && 'start' in day && 'end' in day) {
          result[key] = { start: String((day as DaySchedule).start), end: String((day as DaySchedule).end) }
        } else {
          result[key] = null
        }
      }
      return { ...DEFAULT_WORKING_HOURS, ...result }
    }
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (m) {
      const schedule = { start: m[1], end: m[2] }
      return {
        monday: schedule, tuesday: schedule, wednesday: schedule,
        thursday: schedule, friday: schedule, saturday: schedule,
        sunday: null,
      }
    }
  }
  return DEFAULT_WORKING_HOURS
}

/** Salon detay sayfası için kısa Türkçe gösterim. */
export function formatWorkingHours(value: unknown): string {
  const wh = parseWorkingHours(value)
  const parts: string[] = []
  for (const { key, short } of DAYS) {
    const day = wh[key]
    parts.push(day ? `${short} ${day.start}-${day.end}` : `${short} kapalı`)
  }
  return parts.join(' · ')
}

interface Props {
  value: WorkingHoursMap
  onChange: (next: WorkingHoursMap) => void
  variant?: 'light' | 'dark'
}

export function WorkingHoursPicker({ value, onChange, variant = 'light' }: Props) {
  function toggleDay(key: DayKey) {
    const next: WorkingHoursMap = { ...value }
    next[key] = value[key] === null ? { ...DEFAULT_SCHEDULE } : null
    onChange(next)
  }

  function updateDay(key: DayKey, field: 'start' | 'end', val: string) {
    const day = value[key]
    if (!day) return
    onChange({ ...value, [key]: { ...day, [field]: val } })
  }

  function applyToAll() {
    // İlk açık günü template olarak kullan
    const firstOpen = DAYS.find((d) => value[d.key])?.key
    const template = firstOpen ? value[firstOpen] : DEFAULT_SCHEDULE
    if (!template) return
    const next: WorkingHoursMap = { ...value }
    for (const { key } of DAYS) {
      if (value[key]) next[key] = { ...template }
    }
    onChange(next)
  }

  const isDark = variant === 'dark'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={applyToAll}
          className={cn(
            'text-xs underline-offset-2 hover:underline',
            isDark ? 'text-white/50 hover:text-white' : 'text-salon-muted hover:text-gray-900',
          )}
        >
          Açık günleri eşitle
        </button>
      </div>
      {DAYS.map(({ key, label }) => {
        const day = value[key]
        const open = day !== null
        return (
          <div key={key} className="flex items-center gap-2 py-1">
            <button
              type="button"
              onClick={() => toggleDay(key)}
              className={cn(
                'shrink-0 w-24 text-left text-xs font-medium px-2 py-1.5 rounded-md border transition-colors',
                open
                  ? isDark ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-primary text-white border-primary'
                  : isDark ? 'bg-white/5 border-white/10 text-white/40' : 'bg-zinc-50 border-salon-border text-salon-muted',
              )}
            >
              {label}
            </button>
            {open ? (
              <>
                <input
                  type="time"
                  value={day.start}
                  onChange={(e) => updateDay(key, 'start', e.target.value)}
                  className={cn(
                    'flex-1 h-9 px-2 rounded-md text-xs focus:outline-none',
                    isDark
                      ? 'bg-white/5 border border-white/10 text-white focus:border-purple-500'
                      : 'border border-salon-border bg-white text-gray-900 focus:ring-2 focus:ring-primary',
                  )}
                />
                <span className={cn('text-xs shrink-0', isDark ? 'text-white/30' : 'text-salon-muted')}>—</span>
                <input
                  type="time"
                  value={day.end}
                  onChange={(e) => updateDay(key, 'end', e.target.value)}
                  className={cn(
                    'flex-1 h-9 px-2 rounded-md text-xs focus:outline-none',
                    isDark
                      ? 'bg-white/5 border border-white/10 text-white focus:border-purple-500'
                      : 'border border-salon-border bg-white text-gray-900 focus:ring-2 focus:ring-primary',
                  )}
                />
              </>
            ) : (
              <span className={cn('flex-1 text-xs italic', isDark ? 'text-white/30' : 'text-salon-muted')}>Kapalı</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
