import { getSlots } from './slots'

// Online randevu (POST /book) ve müşteri taşıması aynı kuralı kullanır: istenen başlangıç, hedef personelin o günkü
// çalışma saatlerinden üretilen slot ızgarasında bir slot olmalıdır. Aksi halde salon kapalıyken (gece, izin günü)
// doğrudan API çağrısıyla randevu alınabilirdi (denetim A7-baglanti-1).
export type SlotCheck = 'ok' | 'off_grid' | 'unavailable'

const istanbulDateOf = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

const slotTime = (id: string): number => new Date(id.includes('Z') || id.includes('+') ? id : `${id}Z`).getTime()

/**
 * `off_grid`: mesai dışı ya da ızgaraya oturmayan saat. `unavailable`: ızgarada ama dolu / izinli (requireAvailable ile).
 * Taşımada requireAvailable verilmez: müşterinin kendi mevcut saati yüzünden bitişik slot dolu görünebilir; doluluk çakışma sorgusuyla bakılır.
 */
export async function checkSlot(input: {
  tenantId: string
  serviceId: string
  staffId: string
  startAt: Date
  requireAvailable?: boolean
}): Promise<SlotCheck> {
  const slots = await getSlots({ tenantId: input.tenantId, serviceId: input.serviceId, staffId: input.staffId, date: istanbulDateOf(input.startAt) })
  const slot = slots.find((s) => slotTime(s.id) === input.startAt.getTime())
  if (!slot) return 'off_grid'
  if (input.requireAvailable && !slot.available) return 'unavailable'
  return 'ok'
}
