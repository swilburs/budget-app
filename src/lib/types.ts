// All money values are integer cents. Months are "YYYY-MM" strings. Dates are "YYYY-MM-DD".

export type GroupKind = 'fixed' | 'debt' | 'investment' | 'sinking' | 'fun'

export interface Group {
  id: string
  name: string
  kind: GroupKind
  /** Target share of monthly income, 0..1 (e.g. 0.6 for "Fixed Costs (60%)"). */
  targetPct: number | null
}

export interface Category {
  id: string
  groupId: string
  name: string
  /** Planned monthly amount (the "Monthly Payment" column in the spreadsheet). */
  planned: number
  /** For debt categories: the debt this pays. */
  debtId?: string
  /** For investment categories: the account this funds. */
  investmentId?: string
}

export interface Debt {
  id: string
  name: string
  balance: number
  /** Annual rate, e.g. 0.0649 */
  apr: number
}

export interface Investment {
  id: string
  name: string
  balance: number
  employerMatch: boolean
  /** Match as a fraction of the contribution, e.g. 1 = 100% */
  matchPct: number
  /** Expected annual return, e.g. 0.07 */
  annualReturn: number
  /** Target withdrawal date, "YYYY-MM-DD" */
  targetDate: string
}

export type AccountType = 'checking' | 'savings' | 'credit'

export interface Account {
  id: string
  name: string
  type: AccountType
}

/** Special category id for income; income goes to Ready to Assign. */
export const INCOME = 'income'

export interface Transaction {
  id: string
  date: string
  accountId: string
  payee: string
  /** Negative = money out, positive = money in. */
  amount: number
  /** Category id, INCOME, or null when uncategorized. */
  categoryId: string | null
  /** False until the person confirms the category (auto-categorized rows start unapproved). */
  approved: boolean
}

export interface Rule {
  id: string
  /** Case-insensitive text matched against the payee. */
  match: string
  categoryId: string
}

export interface RetirementSettings {
  /** Annual withdrawal rate used to estimate retirement income, e.g. 0.04 */
  withdrawalRate: number
  /** Expected yearly inflation, used to show projections in today's dollars, e.g. 0.03 */
  inflationRate: number
}

export interface BudgetState {
  version: 1
  monthlyIncome: number
  groups: Group[]
  categories: Category[]
  debts: Debt[]
  investments: Investment[]
  accounts: Account[]
  transactions: Transaction[]
  /** assignments[month][categoryId] = cents assigned that month */
  assignments: Record<string, Record<string, number>>
  rules: Rule[]
  retirement: RetirementSettings
}
