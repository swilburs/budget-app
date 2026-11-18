import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { isDuplicate, payeeKey, suggestCategory } from './categorize'
import { seedState } from './seed'
import type { Account, BudgetState, Category, Debt, Investment, Rule, Transaction } from './types'

/**
 * App state lives in this browser's localStorage for now. Everything goes through this reducer,
 * so moving storage to a shared backend (for syncing with your partner) only replaces load/save.
 */
const STORAGE_KEY = 'budget-app/state/v1'

export type Action =
  | { type: 'reset' }
  | { type: 'replace'; state: BudgetState }
  | { type: 'setIncome'; cents: number }
  | { type: 'updateCategory'; id: string; patch: Partial<Category> }
  | { type: 'addCategory'; groupId: string; name: string }
  | { type: 'removeCategory'; id: string }
  | { type: 'assign'; month: string; categoryId: string; cents: number }
  | { type: 'assignPlanned'; month: string }
  | { type: 'updateDebt'; id: string; patch: Partial<Debt> }
  | { type: 'updateInvestment'; id: string; patch: Partial<Investment> }
  | { type: 'addAccount'; account: Account }
  | { type: 'removeAccount'; id: string }
  | { type: 'addTransactions'; transactions: Omit<Transaction, 'id' | 'categoryId' | 'approved'>[] }
  | { type: 'updateTransaction'; id: string; patch: Partial<Transaction> }
  | { type: 'removeTransaction'; id: string }
  | { type: 'approveAll' }
  | { type: 'addRule'; rule: Omit<Rule, 'id'> }
  | { type: 'removeRule'; id: string }
  | { type: 'updateRetirement'; patch: Partial<BudgetState['retirement']> }

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function reducer(state: BudgetState, action: Action): BudgetState {
  switch (action.type) {
    case 'reset':
      return seedState()
    case 'replace':
      return action.state
    case 'setIncome':
      return { ...state, monthlyIncome: action.cents }
    case 'updateCategory':
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'addCategory':
      return {
        ...state,
        categories: [...state.categories, { id: newId(), groupId: action.groupId, name: action.name, planned: 0 }],
      }
    case 'removeCategory':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        transactions: state.transactions.map((t) => (t.categoryId === action.id ? { ...t, categoryId: null, approved: false } : t)),
        rules: state.rules.filter((r) => r.categoryId !== action.id),
      }
    case 'assign': {
      const month = { ...(state.assignments[action.month] ?? {}), [action.categoryId]: action.cents }
      return { ...state, assignments: { ...state.assignments, [action.month]: month } }
    }
    case 'assignPlanned': {
      const month: Record<string, number> = {}
      for (const c of state.categories) month[c.id] = c.planned
      return { ...state, assignments: { ...state.assignments, [action.month]: month } }
    }
    case 'updateDebt':
      return { ...state, debts: state.debts.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)) }
    case 'updateInvestment':
      return { ...state, investments: state.investments.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)) }
    case 'addAccount':
      return { ...state, accounts: [...state.accounts, action.account] }
    case 'removeAccount':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        transactions: state.transactions.filter((t) => t.accountId !== action.id),
      }
    case 'addTransactions': {
      const added: Transaction[] = []
      for (const t of action.transactions) {
        if (isDuplicate(t, [...state.transactions, ...added])) continue
        const s = suggestCategory(t.payee, state.rules, state.transactions)
        added.push({ ...t, id: newId(), categoryId: s.categoryId, approved: false })
      }
      return { ...state, transactions: [...state.transactions, ...added] }
    }
    case 'updateTransaction': {
      const target = state.transactions.find((t) => t.id === action.id)
      const learned = action.patch.categoryId && action.patch.approved && target ? payeeKey(target.payee) : ''
      return {
        ...state,
        transactions: state.transactions.map((t) => {
          if (t.id === action.id) return { ...t, ...action.patch }
          // Learn right away: other uncategorized transactions from the same payee get the same suggestion.
          if (learned && !t.approved && t.categoryId === null && payeeKey(t.payee) === learned)
            return { ...t, categoryId: action.patch.categoryId! }
          return t
        }),
      }
    }
    case 'removeTransaction':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }
    case 'approveAll':
      return { ...state, transactions: state.transactions.map((t) => (t.categoryId !== null ? { ...t, approved: true } : t)) }
    case 'addRule':
      return { ...state, rules: [...state.rules, { ...action.rule, id: newId() }] }
    case 'removeRule':
      return { ...state, rules: state.rules.filter((r) => r.id !== action.id) }
    case 'updateRetirement':
      return { ...state, retirement: { ...state.retirement, ...action.patch } }
  }
}

function load(): BudgetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetState
      if (parsed.version === 1) return parsed
    }
  } catch {
    // Private mode or corrupt data: start from the spreadsheet.
  }
  return seedState()
}

const Ctx = createContext<{ state: BudgetState; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or blocked; the app still works for this session.
    }
  }, [state])
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside StoreProvider')
  return ctx
}
