export type CardAppointment = { id: string; startTime: string; endTime: string; status: string; priceCharged: number; serviceName: string; staffName: string }
export type CardDetail = {
  id: string
  fullName: string
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  allergyNotes?: string | null
  preferenceNotes?: string | null
  totalVisits: number
  lifetimeValue: number
  segment?: string | null
  lastVisitAt?: string | null
  marketingConsentSms: boolean
  marketingConsentEmail: boolean
  appointments: CardAppointment[]
}
export const availableTabs = (_p: readonly string[]): { value: string; label: string }[] => []
export const summaryItems = (_d: CardDetail): { label: string; value: string }[] => []
export const formatAnswer = (_t: string, _v: unknown) => ''
