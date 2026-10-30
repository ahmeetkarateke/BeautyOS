import { db } from './db'

// L4 / ADR-0047: teslim kaydı 1 yıl sonra alıcı telefon/e-postası ve (varsa) gövde silinerek anonimleştirilir.
// Kanal, amaç, durum, zaman ve maliyet kalır (sayım ve fatura için). Yıl = 365 gün.
// Bu bilinçli bir sistem işidir: kiracı filtresi yoktur, tüm kiracıların eski kayıtları birlikte işlenir.
export const DELIVERY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000

export async function anonymizeOldDeliveries(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_MS)
  // Zaten anonim satırlar yeniden yazılmaz.
  const stale = { createdAt: { lt: cutoff }, OR: [{ phone: { not: null } }, { email: { not: null } }, { body: { not: null } }] }
  // Şablonsuz satırda gövde silinince CHECK (message_deliveries_body_or_template) bozulur ve gece işi tüm kiracılarda düşer:
  // bu satırlar gövdeyle birlikte legacy@0 işaretini alır (migration'daki eski kayıt işaretiyle aynı).
  const untemplated = await db.messageDelivery.updateMany({
    where: { ...stale, templateKey: null },
    data: { phone: null, email: null, body: null, templateKey: 'legacy', templateVersion: 0 },
  })
  const templated = await db.messageDelivery.updateMany({
    where: { ...stale, templateKey: { not: null } },
    data: { phone: null, email: null, body: null },
  })
  return untemplated.count + templated.count
}
