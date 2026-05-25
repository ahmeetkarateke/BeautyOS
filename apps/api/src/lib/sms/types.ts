// SMS sağlayıcı abstraction. Sprint 1: Netgsm + Mock implementations.
// Sprint 2'de İletimerkezi vs eklemek istenirse aynı interface'i implement eder.

export interface SmsSendInput {
  to: string            // E.164 normalize edilmiş telefon
  body: string          // Mesaj gövdesi, max 160-918 karakter (provider'a göre)
  header?: string       // Override header (genelde env'den)
}

export interface SmsSendResult {
  success: boolean
  providerName: string
  providerMessageId?: string
  errorCode?: string
  errorMessage?: string
  cost?: number         // Tahmini maliyet (TL)
}

export interface SmsProvider {
  readonly name: string
  send(input: SmsSendInput): Promise<SmsSendResult>
}

/** Telefon numarasını E.164 formatına normalize eder (TR varsayılan). */
export function normalizePhoneTR(input: string): string | null {
  if (!input) return null
  // Sadece rakamları al
  let digits = input.replace(/[^\d+]/g, '')

  if (digits.startsWith('+')) {
    digits = '+' + digits.slice(1).replace(/\D/g, '')
    if (digits.length < 8) return null
    return digits
  }

  // TR formatları: 0XXX..., 5XXX..., 90XXX...
  const onlyDigits = digits.replace(/\D/g, '')
  if (onlyDigits.length === 10 && onlyDigits.startsWith('5')) return '+90' + onlyDigits
  if (onlyDigits.length === 11 && onlyDigits.startsWith('05')) return '+90' + onlyDigits.slice(1)
  if (onlyDigits.length === 12 && onlyDigits.startsWith('90')) return '+' + onlyDigits
  if (onlyDigits.length === 13 && onlyDigits.startsWith('905')) return '+' + onlyDigits

  return null
}

/** Bir mesajın SMS karakter sayısına göre kaç parçaya bölüneceğini hesaplar. */
export function smsPartCount(body: string): number {
  // GSM 7-bit: 160 char/parça, çoklu parça 153 char/parça
  // Unicode (UCS-2): 70 char/parça, çoklu parça 67 char/parça
  // Türkçe diakritikler GSM-7 turkish extension destekler ama çoğu provider UCS-2 sayar
  const hasNonGsm = /[ğĞıİşŞçÇöÖüÜ]/.test(body)
  const total = body.length
  if (hasNonGsm) {
    if (total <= 70) return 1
    return Math.ceil(total / 67)
  }
  if (total <= 160) return 1
  return Math.ceil(total / 153)
}
