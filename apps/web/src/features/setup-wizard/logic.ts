// İskelet: davranış sonraki commit'te (kırmızı adım).
export type StepId = 'type' | 'salon' | 'hours' | 'services' | 'staff' | 'legal' | 'ready'
export type Step = { id: StepId; label: string; skippable: boolean }
export type PickedService = { name: string; category: string; durationText: string; priceText: string }
export type InviteValues = { fullName: string; email: string; role: 'manager' | 'receptionist' | 'staff' }
export const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = []
export const stepsFor = (_t: string): Step[] => []
export const nextStep = (id: StepId): StepId => id
export const prevStep = (id: StepId): StepId => id
export const stepProgress = (_id: StepId) => ({ index: 0, total: 0 })
export const suggestionsFor = (_t: string): { name: string; category: string; durationText: string }[] => [{ name: 'x', category: '', durationText: '' }]
export const pickToServiceValues = (p: PickedService) => ({ name: '', category: '', durationText: '', priceText: p.priceText, bufferText: '0', isOnlineBookable: true, isActive: true })
export const validateInvite = (_v: InviteValues): Record<string, string> => ({ x: 'x' })
export const readyTasks = (_slug: string): { id: string; label: string; href: string | null }[] => []
