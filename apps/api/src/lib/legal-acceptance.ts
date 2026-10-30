// ADR-0048: kayıtta kabul edilen belgelerin sürümü. Belge metni değişince bu değer güncellenir ve yeniden kabul (G1) istenir.
export const LEGAL_DOCUMENT_VERSION = '2026-10-30'

export interface RegistrationConsents {
  terms: true
  marketingEmail?: boolean
}

// Kullanım Şartları ve Veri İşleme Sözleşmesi tek kutuyla kabul edilir ama kayıt belge başına ayrı satırdır.
export function acceptanceRows(tenantId: string, userId: string, consents: RegistrationConsents) {
  const documents = ['terms', 'dpa', ...(consents.marketingEmail ? ['marketing_email'] : [])]
  return documents.map((document) => ({ tenantId, userId, document, version: LEGAL_DOCUMENT_VERSION }))
}
