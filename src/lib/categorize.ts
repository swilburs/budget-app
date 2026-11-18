import type { Rule, Transaction } from './types'

/** Normalize a bank payee so "TRADER JOE'S #552 SEATTLE WA" and "Trader Joe's #118" compare equal-ish. */
export function payeeKey(payee: string): string {
  const cleaned = payee
    .toLowerCase()
    .replace(/^(pos|debit|purchase|card|checkcard|recurring|ach)\s+/g, '')
  // The merchant name comes before the first store number ("#552", "*AB12", "1234"); city/state follow it.
  const merchant = cleaned.split(/[#*\d]/)[0] || cleaned
  return merchant
    .replace(/[^a-z&' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

export type CategorySource = 'rule' | 'history' | null

export interface Suggestion {
  categoryId: string | null
  source: CategorySource
}

/**
 * Suggest a category for a new transaction:
 * 1. a rule whose text appears in the payee (longest match wins),
 * 2. otherwise the category used last time for the same payee.
 */
export function suggestCategory(payee: string, rules: Rule[], history: Transaction[]): Suggestion {
  const lower = payee.toLowerCase()
  const rule = rules
    .filter((r) => r.match.trim() !== '' && lower.includes(r.match.trim().toLowerCase()))
    .sort((a, b) => b.match.length - a.match.length)[0]
  if (rule) return { categoryId: rule.categoryId, source: 'rule' }

  const key = payeeKey(payee)
  if (key) {
    const past = history
      .filter((t) => t.approved && t.categoryId !== null && payeeKey(t.payee) === key)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (past) return { categoryId: past.categoryId, source: 'history' }
  }
  return { categoryId: null, source: null }
}

/** Same account, date, amount and payee = the same transaction (for re-imported CSVs). */
export function isDuplicate(t: Pick<Transaction, 'accountId' | 'date' | 'amount' | 'payee'>, existing: Transaction[]): boolean {
  return existing.some(
    (e) => e.accountId === t.accountId && e.date === t.date && e.amount === t.amount && e.payee.trim() === t.payee.trim(),
  )
}
