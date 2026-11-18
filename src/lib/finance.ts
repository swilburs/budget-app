import type { Debt, Investment } from './types'
import { addMonths, monthsBetween } from './dates'

/**
 * Months to pay off a balance, rounded up. Same as the sheet's
 * ROUNDUP(NPER(apr/12, -payment, balance), 0).
 * Returns 0 for no balance and Infinity when the payment doesn't cover the monthly interest.
 */
export function monthsToPayoff(balance: number, apr: number, payment: number): number {
  if (balance <= 0) return 0
  if (payment <= 0) return Infinity
  const r = apr / 12
  if (r === 0) return Math.ceil(balance / payment)
  if (payment <= balance * r) return Infinity
  const n = -Math.log(1 - (r * balance) / payment) / Math.log(1 + r)
  // Guard against float noise turning an exact 54.0000001 into 55.
  return Math.ceil(n - 1e-9)
}

/** Future value with monthly compounding and end-of-month contributions. Same as the sheet's FV(rate/12, n, -pmt, -pv, 0). */
export function futureValue(annualReturn: number, months: number, monthlyContribution: number, presentValue: number): number {
  const r = annualReturn / 12
  if (r === 0) return presentValue + monthlyContribution * months
  const g = Math.pow(1 + r, months)
  return presentValue * g + monthlyContribution * ((g - 1) / r)
}

export function employerMatch(inv: Investment, contribution: number): number {
  return inv.employerMatch ? Math.round(contribution * inv.matchPct) : 0
}

/** Months from `today` to the account's target date, like the sheet's Months to Target. */
export function monthsToTarget(inv: Investment, today: string): number {
  return monthsBetween(today, inv.targetDate)
}

export function projectedAtTarget(inv: Investment, contribution: number, today: string): number {
  const total = contribution + employerMatch(inv, contribution)
  return Math.round(futureValue(inv.annualReturn, monthsToTarget(inv, today), total, inv.balance))
}

// ---------------------------------------------------------------------------
// Month-by-month simulation, used by the Debt, Retirement and What-if screens.
// ---------------------------------------------------------------------------

export interface PlanInput {
  debts: Debt[]
  /** debtId -> monthly payment (cents) */
  debtPayments: Record<string, number>
  investments: Investment[]
  /** investmentId -> monthly contribution before match (cents) */
  contributions: Record<string, number>
  /**
   * When a debt is paid off, its payment goes to the remaining debt with the highest APR
   * (the "avalanche"). Once all debts are gone, the whole debt budget goes to `rolloverInvestmentId` if set.
   */
  rollover: boolean
  rolloverInvestmentId?: string
  months: number
  startMonth: string
}

export interface PlanPoint {
  month: string
  debt: number
  invested: number
  netWorth: number
}

export interface DebtResult {
  id: string
  /** Months until paid off, Infinity if not within the horizon. */
  payoffMonths: number
  interestPaid: number
}

export interface PlanResult {
  timeline: PlanPoint[]
  debts: DebtResult[]
  totalInterest: number
  /** Month all debt is gone, or null if not within the horizon. */
  debtFreeMonth: string | null
  /** investmentId -> balance at each account's own target date (or end of horizon if later). */
  balanceAtTarget: Record<string, number>
}

export function simulatePlan(input: PlanInput): PlanResult {
  const balances = new Map(input.debts.map((d) => [d.id, Math.max(0, d.balance)]))
  const scheduled = new Map(input.debts.map((d) => [d.id, input.debtPayments[d.id] ?? 0]))
  const interest = new Map(input.debts.map((d) => [d.id, 0]))
  const payoff = new Map<string, number>(input.debts.filter((d) => d.balance <= 0).map((d) => [d.id, 0]))
  const invBalances = new Map(input.investments.map((i) => [i.id, i.balance]))
  const targetMonth = new Map(input.investments.map((i) => [i.id, monthsBetween(input.startMonth, i.targetDate)]))
  const balanceAtTarget: Record<string, number> = {}
  const byApr = [...input.debts].sort((a, b) => b.apr - a.apr)
  const debtBudget = [...scheduled.values()].reduce((a, b) => a + b, 0)
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)

  const point = (month: string): PlanPoint => {
    const debt = sum(balances)
    const invested = sum(invBalances)
    return { month, debt: Math.round(debt), invested: Math.round(invested), netWorth: Math.round(invested - debt) }
  }

  const timeline: PlanPoint[] = [point(input.startMonth)]
  let debtFreeMonth: string | null = sum(balances) <= 0 ? input.startMonth : null
  for (const inv of input.investments) {
    if (targetMonth.get(inv.id) === 0) balanceAtTarget[inv.id] = Math.round(inv.balance)
  }

  for (let m = 1; m <= input.months; m++) {
    // 1. Interest accrues, then each debt gets its own scheduled payment.
    let paidTotal = 0
    for (const d of input.debts) {
      const bal = balances.get(d.id)!
      if (bal <= 0) continue
      const accrued = bal * (d.apr / 12)
      interest.set(d.id, interest.get(d.id)! + accrued)
      const pay = Math.min(scheduled.get(d.id)!, bal + accrued)
      balances.set(d.id, bal + accrued - pay)
      paidTotal += pay
    }
    // 2. Avalanche: money freed by paid-off debts goes to the highest-APR debt still owed.
    let extra = input.rollover ? debtBudget - paidTotal : 0
    for (const d of byApr) {
      if (extra <= 0) break
      const bal = balances.get(d.id)!
      if (bal <= 0) continue
      const pay = Math.min(extra, bal)
      balances.set(d.id, bal - pay)
      extra -= pay
    }
    for (const d of input.debts) {
      if (!payoff.has(d.id) && balances.get(d.id)! <= 0.5) {
        balances.set(d.id, 0)
        payoff.set(d.id, m)
      }
    }
    // 3. Investments grow; once debt is gone, freed payments can flow into one account.
    for (const inv of input.investments) {
      const own = input.contributions[inv.id] ?? 0
      let total = own + employerMatch(inv, own)
      if (input.rollover && inv.id === input.rolloverInvestmentId) total += Math.max(0, extra)
      const bal = invBalances.get(inv.id)! * (1 + inv.annualReturn / 12) + total
      invBalances.set(inv.id, bal)
      if (targetMonth.get(inv.id) === m) balanceAtTarget[inv.id] = Math.round(bal)
    }

    const month = addMonths(input.startMonth, m)
    timeline.push(point(month))
    if (debtFreeMonth === null && sum(balances) <= 0) debtFreeMonth = month
  }

  for (const inv of input.investments) {
    if (!(inv.id in balanceAtTarget)) balanceAtTarget[inv.id] = Math.round(invBalances.get(inv.id)!)
  }

  const debts = input.debts.map((d) => ({
    id: d.id,
    payoffMonths: payoff.get(d.id) ?? Infinity,
    interestPaid: Math.round(interest.get(d.id)!),
  }))
  return {
    timeline,
    debts,
    totalInterest: debts.reduce((a, d) => a + d.interestPaid, 0),
    debtFreeMonth,
    balanceAtTarget,
  }
}
