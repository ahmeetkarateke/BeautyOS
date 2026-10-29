// Iskelet (kirmizi adim): gercek uygulama sonraki commit'te.
export type AppointmentChannel = 'manual' | 'bot' | 'waitlist' | 'web'
export function initialAppointmentStatus(_channel: AppointmentChannel, _opts?: { approvalRequired?: boolean }): 'pending' | 'confirmed' {
  return 'pending'
}
