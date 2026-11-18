import { useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import { useStore } from '../lib/store'
import type { AccountType, BudgetState } from '../lib/types'
import { CategorySelect } from './TransactionsScreen'

export function SettingsScreen() {
  const { state, dispatch } = useStore()
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('checking')
  const [ruleText, setRuleText] = useState('')
  const [ruleCat, setRuleCat] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const catName = (id: string) => (id === 'income' ? 'Income' : (state.categories.find((c) => c.id === id)?.name ?? 'Deleted category'))

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="settings">
      <div className="card">
        <h3>Accounts</h3>
        <ul className="plain-list">
          {state.accounts.map((a) => (
            <li key={a.id}>
              <span>
                {a.name} <span className="muted small">{a.type}</span>
              </span>
              <ConfirmButton
                className="link danger"
                skip={!state.transactions.some((t) => t.accountId === a.id)}
                confirmLabel={`Delete it and its ${state.transactions.filter((t) => t.accountId === a.id).length} transactions`}
                onConfirm={() => dispatch({ type: 'removeAccount', id: a.id })}
              >
                Remove
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!accountName.trim()) return
            dispatch({ type: 'addAccount', account: { id: crypto.randomUUID(), name: accountName.trim(), type: accountType } })
            setAccountName('')
          }}
        >
          <input placeholder="e.g. Chase Sapphire" value={accountName} onChange={(e) => setAccountName(e.target.value)} aria-label="Account name" />
          <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} aria-label="Account type">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit card</option>
          </select>
          <button type="submit" disabled={!accountName.trim()}>
            Add
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Categorization rules</h3>
        <p className="muted small">When a payee contains this text, new transactions get this category. Without a rule, the app reuses the category you picked last time for the same payee.</p>
        {state.rules.length === 0 ? (
          <p className="muted">No rules yet. Use “Make rule” on a transaction, or add one here.</p>
        ) : (
          <ul className="plain-list">
            {state.rules.map((r) => (
              <li key={r.id}>
                <span>
                  “{r.match}” → {catName(r.categoryId)}
                </span>
                <button className="link danger" onClick={() => dispatch({ type: 'removeRule', id: r.id })}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ruleText.trim() || !ruleCat) return
            dispatch({ type: 'addRule', rule: { match: ruleText.trim(), categoryId: ruleCat } })
            setRuleText('')
          }}
        >
          <input placeholder="Payee contains…" value={ruleText} onChange={(e) => setRuleText(e.target.value)} aria-label="Payee text" />
          <CategorySelect state={state} value={ruleCat} onChange={setRuleCat} label="Rule category" />
          <button type="submit" disabled={!ruleText.trim() || !ruleCat}>
            Add
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p className="muted small">Everything is saved in this browser only, for now. Download a backup before clearing your browser or switching devices.</p>
        <div className="actions">
          <button onClick={exportData}>Download backup</button>
          <label className="button">
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  const parsed = JSON.parse(await f.text()) as BudgetState
                  if (parsed.version !== 1 || !Array.isArray(parsed.categories)) throw new Error()
                  dispatch({ type: 'replace', state: parsed })
                  setMessage('Backup restored.')
                } catch {
                  setMessage('That file is not a budget backup.')
                }
              }}
            />
          </label>
          <ConfirmButton className="danger" confirmLabel="Delete everything and start over" onConfirm={() => dispatch({ type: 'reset' })}>
            Start over
          </ConfirmButton>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  )
}
