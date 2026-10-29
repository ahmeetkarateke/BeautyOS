// Panel ozeti (menu sayaclari, deneme suresi, bugunku kasa, ilk kurulum) icin saf yardimcilar.

export const SETUP_STEP_IDS = ['salon', 'working-hours', 'services', 'staff', 'first-appointment', 'online-link'] as const
export type SetupStepId = (typeof SETUP_STEP_IDS)[number]

const DAY_MS = 24 * 60 * 60 * 1000
// Turkiye yil boyu UTC+3 (yaz saati uygulamasi yok); tenant.route.ts'teki toTRBounds ile ayni sinirlar.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000

/** `now` aninin Istanbul takvim gununun [baslangic, bitis] araligi (UTC Date olarak). */
export function istanbulDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = now.getTime() + ISTANBUL_OFFSET_MS
  const dayStartShifted = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS)
  const start = new Date(dayStartShifted - ISTANBUL_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS - 1) }
}

export interface TrialStatus {
  endsAt: string
  daysLeft: number
  expired: boolean
}

/** Yalniz `trial` planinda ve bitis tarihi varsa doner; tarih uydurulmaz. */
export function trialStatus(plan: string, trialEndsAt: Date | null, now: Date): TrialStatus | null {
  if (plan !== 'trial' || !trialEndsAt) return null
  const remaining = trialEndsAt.getTime() - now.getTime()
  return {
    endsAt: trialEndsAt.toISOString(),
    daysLeft: remaining > 0 ? Math.ceil(remaining / DAY_MS) : 0,
    expired: remaining <= 0,
  }
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** Calisma saati metin ("09:00-19:00") ya da gun nesnesi olabilir; en az bir acik gun gerekir. */
function hasWorkingHours(value: unknown): boolean {
  if (hasText(value)) return true
  if (value && typeof value === 'object') return Object.values(value).some((day) => day !== null && typeof day === 'object')
  return false
}

export interface SetupInput {
  settings: Record<string, unknown>
  serviceCount: number
  staffCount: number
  appointmentCount: number
}

export interface SetupSummary {
  percent: number
  doneCount: number
  totalCount: number
  steps: Array<{ id: SetupStepId; done: boolean }>
}

export function buildSetupSteps(input: SetupInput): SetupSummary {
  const s = input.settings
  const done: Record<SetupStepId, boolean> = {
    salon: hasText(s.phone) && hasText(s.address),
    'working-hours': hasWorkingHours(s.workingHours),
    services: input.serviceCount > 0,
    staff: input.staffCount > 0,
    'first-appointment': input.appointmentCount > 0,
    'online-link': s.publicBookingEnabled === true,
  }
  const steps = SETUP_STEP_IDS.map((id) => ({ id, done: done[id] }))
  const doneCount = steps.filter((x) => x.done).length
  return { percent: Math.round((doneCount / steps.length) * 100), doneCount, totalCount: steps.length, steps }
}
