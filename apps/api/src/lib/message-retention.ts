import { db } from './db'

// L4 / ADR-0047: teslim kaydı 1 yıl sonra alıcı telefon/e-postası ve (varsa) gövde silinerek anonimleştirilir.
// Kanal, amaç, durum, zaman ve maliyet kalır (sayım ve fatura için). Yıl = 365 gün.
export const DELIVERY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000

export async function anonymizeOldDeliveries(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_MS)
  const result = await db.messageDelivery.updateMany({
    // Zaten anonim satırlar yeniden yazılmaz.
    where: { createdAt: { lt: cutoff }, OR: [{ phone: { not: null } }, { email: { not: null } }, { body: { not: null } }] },
    data: { phone: null, email: null, body: null },
  })
  return result.count
}
