export type PhoneVerificationMode = 'sms' | 'none'
export type BookingMode = 'verified' | 'approval_required'

/**
 * ADR-0034: telefon dogrulama modu SMS saglayicisinin varligina baglidir (ortam degiskeni, kiraci ayari degil).
 * Saglayici yokken online randevu dogrulamasiz ve zorunlu salon onayiyla calisir.
 */
export function resolveBookingMode(): { phoneVerification: PhoneVerificationMode; bookingMode: BookingMode } {
  const smsConfigured = (process.env.NETGSM_USERCODE ?? '').trim().length > 0
  return smsConfigured
    ? { phoneVerification: 'sms', bookingMode: 'verified' }
    : { phoneVerification: 'none', bookingMode: 'approval_required' }
}
