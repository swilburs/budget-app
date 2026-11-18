import { addMonths, monthOf } from './dates'

/** Example transactions for trying the app. Payees end in "(example)" so they are never mistaken for real data. */
export function sampleTransactions(accountId: string, now = new Date()) {
  const m = monthOf(now)
  const prev = addMonths(m, -1)
  const rows: [string, string, number][] = [
    [`${prev}-28`, 'ACME CORP PAYROLL (example)', 750000],
    [`${m}-01`, 'ACME CORP PAYROLL (example)', 750000],
    [`${m}-01`, 'MAPLE RIDGE HOA (example)', -260000],
    [`${m}-02`, "TRADER JOE'S #552 (example)", -8412],
    [`${m}-03`, 'SHELL OIL 1234 (example)', -4510],
    [`${m}-04`, 'CITY LIGHT & WATER (example)', -18733],
    [`${m}-05`, "TRADER JOE'S #118 (example)", -6240],
    [`${m}-06`, 'BRIGHT HORIZONS CHILDCARE (example)', -160000],
    [`${m}-07`, 'TAQUERIA EL SOL (example)', -3825],
    [`${m}-08`, 'JIFFY LUBE #221 (example)', -8999],
  ]
  return rows.map(([date, payee, amount]) => ({ date, payee, amount, accountId }))
}
