import { useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { BudgetScreen } from './screens/BudgetScreen'
import { DebtScreen } from './screens/DebtScreen'
import { RetirementScreen } from './screens/RetirementScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TransactionsScreen } from './screens/TransactionsScreen'
import { WhatIfScreen } from './screens/WhatIfScreen'

type Tab = 'budget' | 'transactions' | 'debt' | 'retirement' | 'whatif' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'budget', label: 'Budget', icon: '▤' },
  { id: 'transactions', label: 'Transactions', icon: '⇄' },
  { id: 'debt', label: 'Debt', icon: '↘' },
  { id: 'retirement', label: 'Retirement', icon: '↗' },
  { id: 'whatif', label: 'What-if', icon: '?' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

function Shell() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('budget')
  const [txFilter, setTxFilter] = useState<'review' | 'all'>('all')
  const review = state.transactions.filter((t) => !t.approved).length

  return (
    <div className="app">
      <header className="top">
        <h1>Budget</h1>
        <nav aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <span className="icon" aria-hidden>
                {t.icon}
              </span>
              <span className="label">{t.label}</span>
              {t.id === 'transactions' && review > 0 && <span className="badge">{review}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main>
        <h2 className="screen-title">{TABS.find((t) => t.id === tab)!.label}</h2>
        {tab === 'budget' && (
          <BudgetScreen
            onReview={() => {
              setTxFilter('review')
              setTab('transactions')
            }}
          />
        )}
        {tab === 'transactions' && <TransactionsScreen key={txFilter} initialFilter={txFilter} />}
        {tab === 'debt' && <DebtScreen />}
        {tab === 'retirement' && <RetirementScreen />}
        {tab === 'whatif' && <WhatIfScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
