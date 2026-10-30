export type PhoneVerificationMode = 'sms' | 'none'
export type BookingMode = 'verified' | 'approval_required'

/**
 * ADR-0034: telefon dogrulama modu SMS saglayicisinin varligina baglidir (ortam degiskeni, kiraci ayari degil).
 * Saglayici yokken online randevu dogrulamasiz ve zorunlu salon onayiyla calisir.
 */
/** SMS sağlayıcısı yapılandırılmış mı? Tüm kararlar (mod, kod gönderimi) bu tek tanıma bakar; boşluk 'yok' sayılır. */
export function isSmsConfigured(): boolean {
  return (process.env.NETGSM_USERCODE ?? '').trim().length > 0
}

export function resolveBookingMode(): { phoneVerification: PhoneVerificationMode; bookingMode: BookingMode } {
  return isSmsConfigured()
    ? { phoneVerification: 'sms', bookingMode: 'verified' }
    : { phoneVerification: 'none', bookingMode: 'approval_required' }
}

const MANUAL_BY_DEFAULT: ReadonlySet<string> = new Set(['dentist', 'aesthetic_clinic'])

/** T3: salon ayarı varsa o; yoksa klinik türleri elle onay, diğerleri otomatik. Yalnız sms (doğrulanmış) modunda geçerlidir. */
export function resolveApprovalMode(tenant: { settings: unknown; businessType: string }): 'auto' | 'manual' {
  const configured = (tenant.settings as { onlineBookingApproval?: unknown } | null)?.onlineBookingApproval
  if (configured === 'auto' || configured === 'manual') return configured
  return MANUAL_BY_DEFAULT.has(tenant.businessType) ? 'manual' : 'auto'
}
