// ADR-0045: randevunun baslangic durumu tek yerden gelir. Personelin actigi (panel), bekleme listesinden gelen ve
// bot randevusu hemen onaylidir; yalniz online (web) talep salon onayi gerektirebilir (bookingMode / T3 kurali).
export type AppointmentChannel = 'manual' | 'bot' | 'waitlist' | 'web'

export function initialAppointmentStatus(channel: AppointmentChannel, opts?: { approvalRequired?: boolean }): 'pending' | 'confirmed' {
  if (channel === 'web' && opts?.approvalRequired) return 'pending'
  return 'confirmed'
}
