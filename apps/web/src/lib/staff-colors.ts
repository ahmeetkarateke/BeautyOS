export const STAFF_COLORS = [
  '#6B48FF', // primary
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
]

export function getStaffColor(colorCode?: number | null): string {
  return STAFF_COLORS[colorCode ?? 0] ?? '#6B48FF'
}
