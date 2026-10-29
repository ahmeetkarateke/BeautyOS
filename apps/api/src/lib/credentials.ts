import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

/** Hash maliyeti: kayıt, sıfırlama ve personel ekleme `bcrypt.hash(..., 12)` kullanır; sahte hash de aynı maliyette olmalı. */
export const BCRYPT_COST = 12

/**
 * E-posta küçük harfle ve kırpılmış saklanır/aranır. `toLowerCase()` dilden bağımsızdır (Türk I'sı tuzağı yok:
 * "ISIK" -> "isik"). Kullanıcıya görünen metin için kullanılmaz.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

let dummyHash: Promise<string> | undefined

/**
 * Kullanıcı bulunamadığında karşılaştırılan GEÇERLİ bir bcrypt özeti (gerçek maliyetle). Geçersiz biçimli özet
 * bcrypt'te hemen false döner ve yanıt süresi hesabın varlığını ele verir.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), BCRYPT_COST)
  return dummyHash
}

/** Kullanıcı yoksa (hash undefined) da bcrypt karşılaştırması yapar; sonuç yalnız gerçek kullanıcıda true olabilir. */
export async function comparePassword(password: string, hash: string | undefined): Promise<boolean> {
  const match = await bcrypt.compare(password, hash ?? (await getDummyHash()))
  return hash !== undefined && match
}
