/** Dollars (possibly fractional) to integer cents. */
export const toCents = (dollars: number): number => Math.round(dollars * 100)

export const toDollars = (cents: number): number => cents / 100

const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Format cents as dollars. `exact` shows cents; default rounds to whole dollars. */
export function formatMoney(cents: number, opts: { exact?: boolean } = {}): string {
  // `+ 0` turns -0 into 0 so we never show "-$0".
  return (opts.exact ? exact : whole).format(cents / 100 + 0)
}

/** Parse "1,234.56", "$1234", "(12.00)" or "-12" into cents. Returns null when not a number. */
export function parseMoney(text: string): number | null {
  let s = text.trim().replace(/[$,\s]/g, '')
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s === '' || !/^[-+]?\d*\.?\d+$/.test(s)) return null
  const value = toCents(Number(s))
  return negative ? -value : value
}

/** Axis labels: $850k, $1.2M */
export function formatCompact(dollars: number): string {
  const abs = Math.abs(dollars)
  const sign = dollars < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

export const formatPct = (fraction: number, digits = 0): string => `${(fraction * 100).toFixed(digits)}%`
