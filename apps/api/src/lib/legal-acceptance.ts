// ADR-0048: kabul edilen belge ve etiket sürümleri. Metin değişince ilgili sabit güncellenir; eski sürümle gelen kayıt reddedilir.
export const LEGAL_VERSIONS = {
  termsVersion: '2026-10-30',
  dpaVersion: '2026-10-30',
  labelVersion: '2026-10-30',
  marketingTextVersion: '2026-10-30',
} as const

export interface RegistrationConsents {
  terms: true
  termsVersion: string
  dpaVersion: string
  labelVersion: string
  marketingEmail?: boolean
}

export interface RequestEvidence {
  ipAddress: string | null
  userAgent: string | null
}

export function versionsMatch(c: Pick<RegistrationConsents, 'termsVersion' | 'dpaVersion' | 'labelVersion'>): boolean {
  return c.termsVersion === LEGAL_VERSIONS.termsVersion && c.dpaVersion === LEGAL_VERSIONS.dpaVersion && c.labelVersion === LEGAL_VERSIONS.labelVersion
}

// Kullanım Şartları ve DPA tek kutuyla kabul edilir ama kayıt belge başına ayrı satırdır.
export function acceptanceRows(tenantId: string, userId: string, c: RegistrationConsents, ev: RequestEvidence) {
  return [
    { documentType: 'terms', documentVersion: c.termsVersion },
    { documentType: 'dpa', documentVersion: c.dpaVersion },
  ].map((d) => ({ tenantId, userId, ...d, channel: 'signup', labelVersion: c.labelVersion, ...ev }))
}

// K3: yalnız kutu işaretliyse satır yazılır; varsayılan "izin yok".
export function marketingRows(tenantId: string, userId: string, c: RegistrationConsents, ev: RequestEvidence) {
  if (!c.marketingEmail) return []
  return [{ tenantId, userId, channel: 'email', status: 'granted', source: 'signup_form', consentTextVersion: LEGAL_VERSIONS.marketingTextVersion, ...ev }]
}

export function requestEvidence(req: { ip?: string; get(name: string): string | undefined }): RequestEvidence {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 300) ?? null }
}
