// Telefon alanı yardımcıları (tasarim.md §4: "+90" ön eki, 5xx xxx xx xx).
// Karşılaştırma/anahtar değeri her zaman yalnız rakamlardır; boşluklu biçim sadece gösterim içindir.

const NATIONAL_LENGTH = 10

/** Yapıştırılan her biçimden (+90, 0, NBSP, sekme, uzun tire, U+2212) 10 haneye kadar ulusal numarayı çıkarır. */
export function toNationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '')
  // Ulusal numara 5 ile başlar; baştaki 90 ülke kodu, 0 ise alan kodu öneki olabilir.
  if (digits.startsWith('90')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, NATIONAL_LENGTH)
}

/** "5321234567" -> "532 123 45 67"; eksik girdiyi olduğu kadar böler. */
export function formatNationalPhone(digits: string): string {
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)]
  return groups.filter(Boolean).join(' ')
}
