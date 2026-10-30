// Terim ozellestirme sozlesmesi (ADR-0031). Web `resolveTerm` yalin hali `anahtar`, diger halleri `anahtar.bicim`
// anahtarlarindan okur; sunucu yazarken ve okurken ayni listeyi kullanir.
export const TERM_KEYS = ['business', 'owner', 'client', 'expert', 'service', 'clientsMine'] as const
export const TERM_FORMS = ['nom', 'plural', 'acc', 'dat', 'gen'] as const

export type TermOverrideError =
  | { code: 'unknown_key'; key: string }
  | { code: 'duplicate_nom'; key: string }
  | { code: 'missing_forms'; key: string; missing: string[] }

const KEY_SET: ReadonlySet<string> = new Set(TERM_KEYS)
const FORM_SET: ReadonlySet<string> = new Set(TERM_FORMS)

/** `client` ya da `client.acc` gibi bir anahtari (terim, bicim) ciftine ayirir; sozluk disiysa null. Karsilastirma harf donusumsuzdur (Turk I). */
function parseOverrideKey(key: string): { term: string; form: string; bare: boolean } | null {
  const parts = key.split('.')
  if (parts.length === 1 && KEY_SET.has(parts[0])) return { term: parts[0], form: 'nom', bare: true }
  if (parts.length === 2 && KEY_SET.has(parts[0]) && FORM_SET.has(parts[1])) return { term: parts[0], form: parts[1], bare: false }
  return null
}

export function termOverrideKeyAllowed(key: string): boolean {
  return parseOverrideKey(key) !== null
}

/**
 * Beyaz liste + "bir terim girildiyse bes bicim de zorunlu" kurali. Gecerliyse null, degilse ilk hata.
 * Yalin hal `client` ya da `client.nom` ile yazilabilir, ikisi birden olamaz.
 */
export function validateTermOverrides(overrides: Record<string, string>): TermOverrideError | null {
  const seen = new Map<string, Set<string>>()
  for (const key of Object.keys(overrides)) {
    const parsed = parseOverrideKey(key)
    if (!parsed) return { code: 'unknown_key', key }
    const forms = seen.get(parsed.term) ?? new Set<string>()
    if (forms.has('nom') && parsed.form === 'nom') return { code: 'duplicate_nom', key: parsed.term }
    forms.add(parsed.form)
    seen.set(parsed.term, forms)
  }
  for (const [term, forms] of seen) {
    const missing = TERM_FORMS.filter((f) => !forms.has(f))
    if (missing.length > 0) return { code: 'missing_forms', key: term, missing }
  }
  return null
}
