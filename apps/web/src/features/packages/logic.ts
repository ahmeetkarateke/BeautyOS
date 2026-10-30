export type PackageRow = { id: string; name: string; serviceId: string; serviceName?: string | null; totalSessions: number; price: number; validityDays?: number | null; description?: string | null; isActive: boolean }
export type PackageValues = { serviceId: string; name: string; sessionsText: string; priceText: string; validityText: string; description: string; isActive: boolean }
export const perSession = (_p: number, _n: number) => -1
export const packageMeta = (_p: PackageRow) => ''
export const sortPackages = (p: readonly PackageRow[]): PackageRow[] => [...p]
export const validatePackage = (_v: PackageValues): Record<string, string> => ({ name: 'x' })
export const packageBody = (_v: PackageValues): Record<string, unknown> => ({})
export const toPackageValues = (_p: PackageRow): PackageValues => emptyPackage()
export const emptyPackage = (): PackageValues => ({ serviceId: 'x', name: 'x', sessionsText: 'x', priceText: 'x', validityText: 'x', description: 'x', isActive: false })
