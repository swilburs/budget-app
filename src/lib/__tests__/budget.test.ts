import { describe, expect, it } from 'vitest'
import { buildMonthView } from '../budget'
import { reducer } from '../store'
import { seedState } from '../seed'
import { INCOME } from '../types'

describe('buildMonthView', () => {
  it('left to plan matches the sheet ($2,050)', () => {
    const v = buildMonthView(seedState(), '2026-11')
    expect(v.leftToPlan).toBe(205_000)
    expect(v.totalPlanned).toBe(1_295_000)
  })

  it('available rolls over month to month and ready to assign tracks income minus assigned', () => {
    let s = seedState()
    s = reducer(s, { type: 'addTransactions', transactions: [{ date: '2026-11-01', accountId: 'chase-checking', payee: 'Payroll', amount: 1_500_000 }] })
    const payroll = s.transactions[0]
    s = reducer(s, { type: 'updateTransaction', id: payroll.id, patch: { categoryId: INCOME, approved: true } })
    s = reducer(s, { type: 'assign', month: '2026-11', categoryId: 'sinking-gifts', cents: 20_000 })
    s = reducer(s, { type: 'assign', month: '2026-12', categoryId: 'sinking-gifts', cents: 20_000 })
    s = reducer(s, { type: 'addTransactions', transactions: [{ date: '2026-12-10', accountId: 'chase-checking', payee: 'Toy Store', amount: -15_000 }] })
    const toy = s.transactions.find((t) => t.payee === 'Toy Store')!
    s = reducer(s, { type: 'updateTransaction', id: toy.id, patch: { categoryId: 'sinking-gifts', approved: true } })

    const nov = buildMonthView(s, '2026-11')
    const dec = buildMonthView(s, '2026-12')
    const gifts = (v: typeof nov) => v.groups.flatMap((g) => g.rows).find((r) => r.category.id === 'sinking-gifts')!
    expect(gifts(nov).available).toBe(20_000)
    expect(gifts(dec).activity).toBe(-15_000)
    expect(gifts(dec).available).toBe(25_000)
    expect(dec.readyToAssign).toBe(1_500_000 - 40_000)
  })
})

describe('learning from a categorization', () => {
  it('suggests the same category for other pending transactions from that payee', () => {
    let s = seedState()
    s = reducer(s, {
      type: 'addTransactions',
      transactions: [
        { date: '2026-11-03', accountId: 'chase-checking', payee: "TRADER JOE'S #552 SEATTLE WA", amount: -8412 },
        { date: '2026-11-07', accountId: 'chase-checking', payee: "TRADER JOE'S #118 BELLEVUE WA", amount: -6240 },
      ],
    })
    s = reducer(s, { type: 'updateTransaction', id: s.transactions[0].id, patch: { categoryId: 'fixed-groceries', approved: true } })
    expect(s.transactions[1]).toMatchObject({ categoryId: 'fixed-groceries', approved: false })
  })
})
