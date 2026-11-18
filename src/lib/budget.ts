import { INCOME, type BudgetState, type Category, type Group } from './types'

export interface CategoryMonth {
  category: Category
  assigned: number
  /** Spending this month (negative = money out). */
  activity: number
  /** Carried over + assigned - spent, through the end of this month. */
  available: number
}

export interface GroupMonth {
  group: Group
  rows: CategoryMonth[]
  planned: number
  assigned: number
  activity: number
  available: number
}

export interface MonthView {
  month: string
  groups: GroupMonth[]
  /** Income received ever, minus everything assigned ever (YNAB's "Ready to Assign"). */
  readyToAssign: number
  incomeThisMonth: number
  /** Planned income minus planned spending (the sheet's "left to budget"). */
  leftToPlan: number
  totalPlanned: number
  uncategorizedCount: number
}

const monthOfDate = (date: string) => date.slice(0, 7)

export function buildMonthView(state: BudgetState, month: string): MonthView {
  const assignedThrough = new Map<string, number>()
  const assignedIn = state.assignments[month] ?? {}
  let assignedEver = 0
  for (const [m, byCat] of Object.entries(state.assignments)) {
    for (const [catId, amt] of Object.entries(byCat)) {
      assignedEver += amt
      if (m <= month) assignedThrough.set(catId, (assignedThrough.get(catId) ?? 0) + amt)
    }
  }

  const activityThrough = new Map<string, number>()
  const activityIn = new Map<string, number>()
  let incomeEver = 0
  let incomeThisMonth = 0
  let uncategorizedCount = 0
  for (const t of state.transactions) {
    const m = monthOfDate(t.date)
    if (t.categoryId === null) {
      uncategorizedCount++
      continue
    }
    if (t.categoryId === INCOME) {
      incomeEver += t.amount
      if (m === month) incomeThisMonth += t.amount
      continue
    }
    if (m <= month) activityThrough.set(t.categoryId, (activityThrough.get(t.categoryId) ?? 0) + t.amount)
    if (m === month) activityIn.set(t.categoryId, (activityIn.get(t.categoryId) ?? 0) + t.amount)
  }

  const groups = state.groups.map((group) => {
    const rows = state.categories
      .filter((c) => c.groupId === group.id)
      .map((category) => ({
        category,
        assigned: assignedIn[category.id] ?? 0,
        activity: activityIn.get(category.id) ?? 0,
        available: (assignedThrough.get(category.id) ?? 0) + (activityThrough.get(category.id) ?? 0),
      }))
    const total = (k: 'assigned' | 'activity' | 'available') => rows.reduce((a, r) => a + r[k], 0)
    return {
      group,
      rows,
      planned: rows.reduce((a, r) => a + r.category.planned, 0),
      assigned: total('assigned'),
      activity: total('activity'),
      available: total('available'),
    }
  })

  const totalPlanned = groups.reduce((a, g) => a + g.planned, 0)
  return {
    month,
    groups,
    readyToAssign: incomeEver - assignedEver,
    incomeThisMonth,
    leftToPlan: state.monthlyIncome - totalPlanned,
    totalPlanned,
    uncategorizedCount,
  }
}

/** Planned monthly payment per debt and contribution per investment, from their linked categories. */
export function linkedAmounts(categories: Category[]) {
  const debtPayments: Record<string, number> = {}
  const contributions: Record<string, number> = {}
  for (const c of categories) {
    if (c.debtId) debtPayments[c.debtId] = (debtPayments[c.debtId] ?? 0) + c.planned
    if (c.investmentId) contributions[c.investmentId] = (contributions[c.investmentId] ?? 0) + c.planned
  }
  return { debtPayments, contributions }
}
