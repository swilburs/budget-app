import { describe, expect, it } from 'vitest'
import { parseBankCsv } from '../csv'

describe('parseBankCsv', () => {
  it('reads a Chase checking export', () => {
    const csv = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,11/03/2026,"TRADER JOE'S #552, SEATTLE WA",-84.12,DEBIT_CARD,5000.00,,
CREDIT,11/01/2026,ACME PAYROLL,7500.00,ACH_CREDIT,5084.12,,
`
    const r = parseBankCsv(csv)
    expect(r.transactions).toEqual([
      { date: '2026-11-03', payee: "TRADER JOE'S #552, SEATTLE WA", amount: -8412 },
      { date: '2026-11-01', payee: 'ACME PAYROLL', amount: 750000 },
    ])
  })
  it('reads a Chase credit card export', () => {
    const csv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
11/05/2026,11/06/2026,SHELL OIL 1234,Gas,Sale,-45.10,
`
    expect(parseBankCsv(csv).transactions[0]).toEqual({ date: '2026-11-05', payee: 'SHELL OIL 1234', amount: -4510 })
  })
  it('skips the Bank of America summary block', () => {
    const csv = `Description,,Summary Amt.
Beginning balance as of 11/01/2026,,"1,000.00"
Total credits,,"2,000.00"

Date,Description,Amount,Running Bal.
11/01/2026,Beginning balance as of 11/01/2026,,"1,000.00"
11/02/2026,"COSTCO WHSE #0001","-212.45","787.55"
`
    const r = parseBankCsv(csv)
    expect(r.transactions).toEqual([{ date: '2026-11-02', payee: 'COSTCO WHSE #0001', amount: -21245 }])
    expect(r.skipped).toBe(1)
  })
  it('flips sign for cards that list purchases as positive', () => {
    const csv = `Posted Date,Reference Number,Payee,Address,Amount
11/04/2026,123,NETFLIX.COM,LOS GATOS CA,15.49
`
    expect(parseBankCsv(csv, { flipSign: true }).transactions[0].amount).toBe(-1549)
  })
})
