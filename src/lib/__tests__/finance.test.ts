import { describe, expect, it } from 'vitest'
import { futureValue, monthsToPayoff, projectedAtTarget, simulatePlan } from '../finance'
import { seedState } from '../seed'
import { linkedAmounts } from '../budget'

describe('monthsToPayoff (matches the Debt Tracker tab)', () => {
  it('Car Loan: $18,500 at 6.49% paying $400 takes 54 months', () => {
    expect(monthsToPayoff(1_850_000, 0.0649, 40_000)).toBe(54)
  })
  it('HELOC/Other: $62,000 at 7.49% paying $400 takes 551 months', () => {
    expect(monthsToPayoff(6_200_000, 0.0749, 40_000)).toBe(551)
  })
  it('is 0 with no balance and Infinity when the payment only covers interest', () => {
    expect(monthsToPayoff(0, 0.06, 0)).toBe(0)
    expect(monthsToPayoff(1_000_000, 0.12, 10_000)).toBe(Infinity)
  })
  it('handles 0% APR', () => {
    expect(monthsToPayoff(100_000, 0, 30_000)).toBe(4)
  })
})

describe('futureValue (matches the Investment Tracker tab)', () => {
  it('401k: $630 + 100% match for 218 months at 7% is about $551,586', () => {
    expect(Math.round(futureValue(0.07, 218, 126_000, 0) / 100)).toBe(551_586)
  })
  it('projectedAtTarget uses months from today to the target date', () => {
    const inv = seedState().investments[0]
    expect(Math.round(projectedAtTarget(inv, 63_000, '2026-11-11') / 100)).toBe(551_586)
  })
})

describe('simulatePlan', () => {
  const s = seedState()
  const { debtPayments, contributions } = linkedAmounts(s.categories)
  const base = { debts: s.debts, debtPayments, investments: s.investments, contributions, months: 600, startMonth: '2026-11' }

  it('without rollover, payoff months match the closed-form formula', () => {
    const r = simulatePlan({ ...base, rollover: false })
    const car = r.debts.find((d) => d.id === 'car-loan')!
    const heloc = r.debts.find((d) => d.id === 'heloc')!
    expect(car.payoffMonths).toBe(54)
    // Simulation compounds on unrounded balances, so allow a month either way.
    expect(Math.abs(heloc.payoffMonths - 551)).toBeLessThanOrEqual(1)
  })

  it('401k balance at target matches the sheet', () => {
    const r = simulatePlan({ ...base, rollover: false })
    expect(Math.round(r.balanceAtTarget['401k'] / 100)).toBe(551_586)
  })

  it('rolling the car payment into the HELOC pays it off decades sooner and saves interest', () => {
    const plain = simulatePlan({ ...base, rollover: false })
    const avalanche = simulatePlan({ ...base, rollover: true })
    const h1 = plain.debts.find((d) => d.id === 'heloc')!
    const h2 = avalanche.debts.find((d) => d.id === 'heloc')!
    expect(h2.payoffMonths).toBeLessThan(h1.payoffMonths / 3)
    expect(avalanche.totalInterest).toBeLessThan(plain.totalInterest)
    expect(avalanche.debtFreeMonth).not.toBeNull()
  })

  it('extra $500/mo on the HELOC pays it off in about 7.5 years', () => {
    const r = simulatePlan({ ...base, debtPayments: { ...debtPayments, heloc: 90_000 }, rollover: false })
    const h = r.debts.find((d) => d.id === 'heloc')!
    expect(h.payoffMonths).toBe(monthsToPayoff(6_200_000, 0.0749, 90_000))
    expect(h.payoffMonths).toBeGreaterThan(85)
    expect(h.payoffMonths).toBeLessThan(95)
  })

  it('after debt-free, the debt budget can flow into an investment', () => {
    const without = simulatePlan({ ...base, rollover: true })
    const withInvest = simulatePlan({ ...base, rollover: true, rolloverInvestmentId: 'roth' })
    expect(withInvest.balanceAtTarget['roth']).toBeGreaterThan(without.balanceAtTarget['roth'])
  })
})
