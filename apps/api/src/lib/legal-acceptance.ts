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
  /** K3 kutusu isaretliyse zorunlu: istemcinin gordugu izin metni surumu. */
  marketingTextVersion?: string
}

export interface RequestEvidence {
  ipAddress: string | null
  userAgent: string | null
}

// Izin metni surumu yalniz K3 isaretliyse aranir: izin, kullanicinin gordugu metin surumuyle kaydedilmeli (ispat).
export function versionsMatch(c: Pick<RegistrationConsents, 'termsVersion' | 'dpaVersion' | 'labelVersion' | 'marketingEmail' | 'marketingTextVersion'>): boolean {
  const marketingOk = !c.marketingEmail || c.marketingTextVersion === LEGAL_VERSIONS.marketingTextVersion
  return c.termsVersion === LEGAL_VERSIONS.termsVersion && c.dpaVersion === LEGAL_VERSIONS.dpaVersion && c.labelVersion === LEGAL_VERSIONS.labelVersion && marketingOk
}

// Kayıt anının anlık görüntüsü: kiracı ya da kullanıcı silinse de kabul kaydı kanıt olarak okunabilir kalır (ADR-0048, SET NULL).
export interface RecordSnapshot {
  tenantSlug: string
  tenantName: string
  userEmail: string
}

// Kullanım Şartları ve DPA tek kutuyla kabul edilir ama kayıt belge başına ayrı satırdır.
export function acceptanceRows(tenantId: string, userId: string, c: RegistrationConsents, ev: RequestEvidence, snap: RecordSnapshot) {
  return [
    { documentType: 'terms', documentVersion: c.termsVersion },
    { documentType: 'dpa', documentVersion: c.dpaVersion },
  ].map((d) => ({ tenantId, userId, ...d, channel: 'signup', labelVersion: c.labelVersion, ...ev, ...snap }))
}

// K3: yalnız kutu işaretliyse satır yazılır; varsayılan "izin yok".
export function marketingRows(tenantId: string, userId: string, c: RegistrationConsents, ev: RequestEvidence, snap: RecordSnapshot) {
  if (!c.marketingEmail) return []
  return [{ tenantId, userId, channel: 'email', status: 'granted', source: 'signup_form', consentTextVersion: c.marketingTextVersion ?? LEGAL_VERSIONS.marketingTextVersion, ...ev, ...snap }]
}

export function requestEvidence(req: { ip?: string; get(name: string): string | undefined }): RequestEvidence {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 300) ?? null }
}
