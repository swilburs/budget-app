import { parseMoney } from './money'

/** Split CSV text into rows, handling quoted fields with commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface ParsedTransaction {
  date: string
  payee: string
  amount: number
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  skipped: number
  error?: string
}

const DATE_HEADERS = ['transaction date', 'posting date', 'posted date', 'date', 'trans. date', 'post date']
const PAYEE_HEADERS = ['description', 'payee', 'merchant', 'name', 'details']
const AMOUNT_HEADERS = ['amount', 'transaction amount']

function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i >= 0) return i
  }
  return -1
}

/** "11/03/2026" or "2026-11-03" -> "2026-11-03" */
export function normalizeDate(text: string): string | null {
  const s = text.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

/**
 * Parse a bank CSV export. Works with Chase and Bank of America checking and credit card
 * downloads, and any CSV with a date, description and amount (or debit/credit) column.
 * Bank of America checking files start with a summary block; we skip down to the real header row.
 * `flipSign` is for card exports that list purchases as positive numbers.
 */
export function parseBankCsv(text: string, opts: { flipSign?: boolean } = {}): ParseResult {
  const rows = parseCsv(text)
  const headerIdx = rows.findIndex((r) => {
    const h = r.map((c) => c.trim().toLowerCase())
    return findCol(h, DATE_HEADERS) >= 0 && findCol(h, PAYEE_HEADERS) >= 0
  })
  if (headerIdx < 0) return { transactions: [], skipped: 0, error: 'Could not find a header row with a date and description column.' }

  const header = rows[headerIdx].map((c) => c.trim().toLowerCase())
  const dateCol = findCol(header, DATE_HEADERS)
  const payeeCol = findCol(header, PAYEE_HEADERS)
  const amountCol = findCol(header, AMOUNT_HEADERS)
  const debitCol = findCol(header, ['debit', 'withdrawals', 'withdrawal'])
  const creditCol = findCol(header, ['credit', 'deposits', 'deposit'])
  if (amountCol < 0 && debitCol < 0 && creditCol < 0)
    return { transactions: [], skipped: 0, error: 'Could not find an amount column.' }

  const transactions: ParsedTransaction[] = []
  let skipped = 0
  for (const r of rows.slice(headerIdx + 1)) {
    const date = normalizeDate(r[dateCol] ?? '')
    const payee = (r[payeeCol] ?? '').trim()
    let amount: number | null = null
    if (amountCol >= 0) amount = parseMoney(r[amountCol] ?? '')
    else {
      const debit = parseMoney(r[debitCol] ?? '') ?? 0
      const credit = parseMoney(r[creditCol] ?? '') ?? 0
      amount = credit - Math.abs(debit)
      if (debit === 0 && credit === 0) amount = null
    }
    // Rows like BofA's "Beginning balance as of ..." have no amount; skip them.
    if (!date || !payee || amount === null || /^beginning balance/i.test(payee)) {
      skipped++
      continue
    }
    transactions.push({ date, payee, amount: opts.flipSign ? -amount : amount })
  }
  return { transactions, skipped }
}
