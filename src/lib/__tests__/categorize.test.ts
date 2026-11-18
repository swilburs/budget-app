import { describe, expect, it } from 'vitest'
import { payeeKey, suggestCategory } from '../categorize'
import type { Transaction } from '../types'

const tx = (payee: string, categoryId: string, date = '2026-10-01'): Transaction => ({
  id: payee, date, accountId: 'a', payee, amount: -100, categoryId, approved: true,
})

describe('categorize', () => {
  it('normalizes store numbers and locations away', () => {
    expect(payeeKey("TRADER JOE'S #552 SEATTLE WA")).toBe(payeeKey("Trader Joe's #118 Bellevue WA"))
  })
  it('rules win, longest match first', () => {
    const rules = [
      { id: '1', match: 'amazon', categoryId: 'other' },
      { id: '2', match: 'amazon fresh', categoryId: 'groceries' },
    ]
    expect(suggestCategory('AMAZON FRESH*AB12', rules, [])).toEqual({ categoryId: 'groceries', source: 'rule' })
  })
  it('falls back to the last category used for the same payee', () => {
    const history = [tx('SHELL OIL 123', 'transportation', '2026-09-01'), tx('SHELL OIL 456', 'auto', '2026-10-01')]
    expect(suggestCategory('SHELL OIL 789', [], history)).toEqual({ categoryId: 'auto', source: 'history' })
  })
  it('returns null for an unknown payee', () => {
    expect(suggestCategory('NEW PLACE', [], [])).toEqual({ categoryId: null, source: null })
  })
})
