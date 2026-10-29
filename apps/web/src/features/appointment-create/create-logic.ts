import type { StaffMember } from '@/features/appointments/staff'

// Randevu oluşturma akışının saf kuralları (arayüzden ayrı, birim testli).

/** Slot kimliği Z'siz UTC ISO ("2026-10-29T07:00:00"); gönderilecek başlangıç Z'li ISO'dur. */
export function slotStartAt(slotId: string): string {
  return slotId.endsWith('Z') ? slotId : `${slotId}Z`
}

/** Seçilen hizmeti verebilen personel. Hizmet listesi bilinmiyorsa (serviceIds yok) elenmez. */
export function staffForService(staff: readonly StaffMember[], serviceId: string): StaffMember[] {
  return staff.filter((s) => s.serviceIds === undefined || s.serviceIds.includes(serviceId))
}

export type CustomerChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; phoneDigits: string }

export type NewCustomerIssue = 'name' | 'phone' | null

/** Yeni müşteri için en az iki harfli ad ve 10 haneli ulusal telefon (5xx xxx xx xx). */
export function newCustomerIssue(name: string, phoneDigits: string): NewCustomerIssue {
  if (name.trim().length < 2) return 'name'
  if (!/^5\d{9}$/.test(phoneDigits)) return 'phone'
  return null
}

export type CreateDraft = {
  customer: CustomerChoice | null
  serviceId: string
  staffId: string
  slotId: string
}

export function isDraftComplete(draft: CreateDraft): boolean {
  if (!draft.customer || !draft.serviceId || !draft.staffId || !draft.slotId) return false
  if (draft.customer.kind === 'new') return newCustomerIssue(draft.customer.name, draft.customer.phoneDigits) === null
  return true
}
