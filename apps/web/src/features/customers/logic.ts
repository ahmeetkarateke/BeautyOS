export type CustomerRow = { id: string; fullName: string; phone?: string | null; phoneMasked?: boolean; isOwn?: boolean; totalVisits?: number | null; lastVisitDate?: string | null }
export const searchPhase = (_term: string, _staff: boolean): 'list' | 'search' | 'idle' | 'short' => 'idle'
export const searchMode = (_can: boolean) => false
export const canOpen = (_row: CustomerRow) => false
export const phoneLine = (_row: CustomerRow) => ''
export const visitLine = (_row: CustomerRow) => 'x'
