/** "YYYY-MM" for a Date (local time). */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function todayISO(now = new Date()): string {
  return `${monthOf(now)}-${String(now.getDate()).padStart(2, '0')}`
}

/** Add n months to a "YYYY-MM" string. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Whole months from `from` to `to` ("YYYY-MM" or longer), never negative. Matches the sheet's Months to Target. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2031-05" -> "May 2031" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${monthNames[m - 1]} ${y}`
}

/** Months as "4 yr 6 mo" */
export function formatDuration(months: number): string {
  if (!Number.isFinite(months)) return 'never'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mo`
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`
}
