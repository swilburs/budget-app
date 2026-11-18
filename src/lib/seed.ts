import { toCents } from './money'
import type { BudgetState, Category, Group } from './types'

/**
 * Starting budget, taken from the "Monthly Budget with Automatic Investments and Debt Calculator"
 * spreadsheet (Budget, Debt Tracker and Investment Tracker tabs) as of Nov 2026.
 */
export function seedState(): BudgetState {
  const groups: Group[] = [
    { id: 'fixed', name: 'Fixed Costs', kind: 'fixed', targetPct: 0.6 },
    { id: 'debt', name: 'Debt Payments', kind: 'debt', targetPct: null },
    { id: 'investments', name: 'Investments', kind: 'investment', targetPct: 0.15 },
    { id: 'sinking', name: 'Sink Funds', kind: 'sinking', targetPct: 0.1 },
    { id: 'fun', name: 'Fun Money', kind: 'fun', targetPct: 0.15 },
  ]

  const cat = (groupId: string, name: string, dollars: number, extra: Partial<Category> = {}): Category => ({
    id: `${groupId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
    groupId,
    name,
    planned: toCents(dollars),
    ...extra,
  })

  const categories: Category[] = [
    cat('fixed', 'Giving/Donations', 1600),
    cat('fixed', 'Housing (Rent/HOA)', 2600),
    cat('fixed', 'Utilities & Bills', 600),
    cat('fixed', 'Groceries', 1200),
    cat('fixed', 'Transportation', 250),
    cat('fixed', 'Insurance', 270),
    cat('fixed', 'Childcare', 1600),
    cat('fixed', 'Medical', 250),
    cat('fixed', 'Other', 300),
    cat('debt', 'Student Loan', 0, { debtId: 'student-loan' }),
    cat('debt', 'Car Loan', 400, { debtId: 'car-loan' }),
    cat('debt', 'Mortgage', 0, { debtId: 'mortgage' }),
    cat('debt', 'HELOC/Other', 400, { debtId: 'heloc' }),
    cat('investments', '401k', 630, { investmentId: '401k' }),
    cat('investments', 'Roth IRA', 0, { investmentId: 'roth' }),
    cat('investments', 'Brokerage', 0, { investmentId: 'brokerage' }),
    cat('investments', 'Other', 0, { investmentId: 'other-investment' }),
    cat('sinking', 'Auto Maintenance', 300),
    cat('sinking', 'Home Maintenance', 125),
    cat('sinking', 'Homemaking', 125),
    cat('sinking', 'Gifts', 200),
    cat('sinking', 'Stuff I Forgot to Budget For', 200),
    cat('fun', 'Vacation & Travel', 500),
    cat('fun', 'Dining Out', 100),
    cat('fun', 'Fun Money', 1300),
    cat('fun', 'Other', 0),
  ]

  return {
    version: 1,
    monthlyIncome: toCents(15000),
    groups,
    categories,
    debts: [
      { id: 'student-loan', name: 'Student Loan', balance: 0, apr: 0.06 },
      { id: 'car-loan', name: 'Car Loan', balance: toCents(18500), apr: 0.0649 },
      { id: 'mortgage', name: 'Mortgage', balance: 0, apr: 0.06 },
      { id: 'heloc', name: 'HELOC/Other', balance: toCents(62000), apr: 0.0749 },
    ],
    investments: [
      { id: '401k', name: '401k', balance: 0, employerMatch: true, matchPct: 1, annualReturn: 0.07, targetDate: '2045-01-01' },
      { id: 'roth', name: 'Roth IRA', balance: 0, employerMatch: false, matchPct: 0.5, annualReturn: 0.07, targetDate: '2045-01-01' },
      { id: 'brokerage', name: 'Brokerage', balance: 0, employerMatch: false, matchPct: 0.5, annualReturn: 0.07, targetDate: '2045-01-01' },
      { id: 'other-investment', name: 'Other', balance: 0, employerMatch: false, matchPct: 0.5, annualReturn: 0.07, targetDate: '2045-01-01' },
    ],
    accounts: [
      { id: 'chase-checking', name: 'Chase Checking', type: 'checking' },
      { id: 'bofa-checking', name: 'Bank of America Checking', type: 'checking' },
    ],
    transactions: [],
    assignments: {},
    rules: [],
    retirement: { withdrawalRate: 0.04, inflationRate: 0.03 },
  }
}
