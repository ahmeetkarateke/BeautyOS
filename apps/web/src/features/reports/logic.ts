export type Preset = 'today' | 'week' | 'month'
export type CommissionRow = { staffId: string; staffName: string; completedAppointments: number; revenue: number; commission: number }
export const periodRange = (_p: Preset, _t: string): { from: string; to: string } => ({ from: '', to: '' })
export const validateRange = (_f: string, _t: string, _today: string): string | null => 'x'
export const sortCommissions = (r: readonly CommissionRow[]): CommissionRow[] => [...r]
