export type HourRow = { key: string; label: string; open: boolean; start: string; end: string }
export type Leave = { id: string; leaveDate: string; leaveType: string; note?: string | null }
export const weekRows = (_w: unknown): HourRow[] => []
export const validateHours = (_r: readonly HourRow[]): Record<string, string> => ({ x: 'x' })
export const hoursBody = (_r: readonly HourRow[]): Record<string, unknown> => ({})
export const validateProfile = (_v: { title: string; bio: string }): Record<string, string> => ({ title: 'x' })
export const commissionLine = (_t: string, _v: number) => ''
export const leaveTypeLabel = (_t: string) => ''
export const sortLeaves = (l: readonly Leave[]): Leave[] => [...l]
