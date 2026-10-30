import { phoneVariants } from './online-booking'

export type PhoneResolution = { kind: 'none' } | { kind: 'single'; id: string } | { kind: 'multiple'; ids: string[] }

/** `db` ya da bir işlem (`tx`): yalnız customer.findMany gerekir. */
export interface CustomerLookup {
  customer: {
    findMany(args: {
      where: { tenantId: string; phone: { in: string[] } }
      orderBy: { createdAt: 'asc' }
      take: number
      select: { id: true }
    }): Promise<Array<{ id: string }>>
  }
}

// Ayni telefonu paylasan kart sayisi pratikte tek hanelik; sinir yalniz kotu veriye karsi.
const RESOLVE_LIMIT = 10

/** `exact`: kanal kimligi (Telegram sohbet no) telefon degildir; normalize edilirse gercek bir telefonla tesadufen eslesebilir. Aranacak degerler: ham giris + telefonun eski kayit bicimleri (normalize edilemeyen kimlikler, ornegin Telegram sohbet no, oldugu gibi). */
export function lookupValues(phone: string, exact: boolean): string[] {
  return exact ? [phone] : Array.from(new Set([phone, ...phoneVariants(phone)]))
}

/**
 * ADR-0038: telefon her zaman kiracı içinde ve normalize biçimiyle aranır; aynı telefonla birden çok müşteri olabilir.
 * none -> yeni kart, single -> bağla (yalnız doğrulanmış kanalda), multiple -> hiçbirine bağlanma, salon eşleştirsin.
 */
export async function resolveCustomerByPhone(
  tx: CustomerLookup,
  tenantId: string,
  phone: string,
  options: { exact?: boolean } = {},
): Promise<PhoneResolution> {
  const rows = await tx.customer.findMany({
    where: { tenantId, phone: { in: lookupValues(phone, options.exact === true) } },
    orderBy: { createdAt: 'asc' },
    take: RESOLVE_LIMIT,
    select: { id: true },
  })
  if (rows.length === 0) return { kind: 'none' }
  if (rows.length === 1) return { kind: 'single', id: rows[0].id }
  return { kind: 'multiple', ids: rows.map((r) => r.id) }
}

/** ADR-0039: Telegram sohbet no kiracıda tekildir (telegramChatId); telefon biçimleriyle aranmaz. */
export async function resolveCustomerByChatId(
  tx: { customer: { findMany(args: { where: { tenantId: string; telegramChatId: string }; take: number; select: { id: true } }): Promise<Array<{ id: string }>> } },
  tenantId: string,
  chatId: string,
): Promise<PhoneResolution> {
  const rows = await tx.customer.findMany({ where: { tenantId, telegramChatId: chatId }, take: 1, select: { id: true } })
  return rows.length === 0 ? { kind: 'none' } : { kind: 'single', id: rows[0].id }
}

/** Panel yinelenen telefon kontrolü: aynı kiracıda (isteğe bağlı bir kart hariç) bu telefonla kayıtlı kart var mı? */
export async function phoneInUse(
  tx: { customer: { findMany(args: unknown): Promise<Array<{ id: string }>> } },
  tenantId: string,
  phone: string,
  exceptCustomerId?: string,
): Promise<boolean> {
  const rows = await tx.customer.findMany({
    where: { tenantId, phone: { in: lookupValues(phone, false) }, ...(exceptCustomerId ? { id: { not: exceptCustomerId } } : {}) },
    take: 1,
    select: { id: true },
  })
  return rows.length > 0
}
