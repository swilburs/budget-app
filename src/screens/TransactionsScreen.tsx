import { useMemo, useRef, useState } from 'react'
import { isDuplicate, payeeKey } from '../lib/categorize'
import { parseBankCsv } from '../lib/csv'
import { todayISO } from '../lib/dates'
import { formatMoney, parseMoney } from '../lib/money'
import { sampleTransactions } from '../lib/sample'
import { useStore } from '../lib/store'
import { INCOME, type BudgetState, type Transaction } from '../lib/types'

type Filter = 'review' | 'all'

export function TransactionsScreen({ initialFilter = 'all' }: { initialFilter?: Filter }) {
  const { state, dispatch } = useStore()
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [accountId, setAccountId] = useState<string>('all')
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      state.transactions
        .filter((t) => accountId === 'all' || t.accountId === accountId)
        .filter((t) => filter === 'all' || !t.approved)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions, accountId, filter],
  )
  const reviewCount = state.transactions.filter((t) => !t.approved).length
  const readyToApprove = state.transactions.filter((t) => !t.approved && t.categoryId !== null).length

  return (
    <section>
      <div className="screen-head">
        <div className="seg" role="tablist" aria-label="Transaction filter">
          <button role="tab" aria-selected={filter === 'review'} onClick={() => setFilter('review')}>
            To review {reviewCount > 0 && <span className="badge">{reviewCount}</span>}
          </button>
          <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </button>
        </div>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
          <option value="all">All accounts</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card-grid">
        <ImportCard
          onImported={(added, dupes, skipped) => {
            setNotice(
              `Imported ${added} transaction${added === 1 ? '' : 's'}` +
                (dupes ? `, skipped ${dupes} already imported` : '') +
                (skipped ? `, ignored ${skipped} non-transaction rows` : '') +
                '.',
            )
            setFilter('review')
          }}
          onError={setNotice}
        />
        <AddCard />
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {filter === 'review' && readyToApprove > 0 && (
        <div className="bulk">
          <span>{readyToApprove} already have a suggested category.</span>
          <button className="primary" onClick={() => dispatch({ type: 'approveAll' })}>
            Approve all suggested
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          {filter === 'review' && state.transactions.length > 0 ? (
            <p>Nothing to review.</p>
          ) : (
            <>
              <p>No transactions yet. Import a CSV from your bank to start, or try it with example data.</p>
              <button
                onClick={() => {
                  dispatch({ type: 'addTransactions', transactions: sampleTransactions(state.accounts[0]?.id ?? '') })
                  setFilter('review')
                }}
                disabled={state.accounts.length === 0}
              >
                Load example transactions
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="tx-list">
          {rows.map((t) => (
            <TxRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function CategorySelect({
  value,
  onChange,
  state,
  label,
}: {
  value: string | null
  onChange: (id: string | null) => void
  state: BudgetState
  label: string
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className={value ? '' : 'needs'}>
      <option value="">Choose category…</option>
      <option value={INCOME}>Income (Ready to Assign)</option>
      {state.groups.map((g) => (
        <optgroup key={g.id} label={g.name}>
          {state.categories
            .filter((c) => c.groupId === g.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

function TxRow({ t }: { t: Transaction }) {
  const { state, dispatch } = useStore()
  const account = state.accounts.find((a) => a.id === t.accountId)
  const hasRule = state.rules.some((r) => t.payee.toLowerCase().includes(r.match.toLowerCase()))
  return (
    <li className={`tx ${t.approved ? '' : 'unapproved'}`}>
      <div className="tx-main">
        <div className="tx-payee">{t.payee}</div>
        <div className="muted small">
          {t.date} · {account?.name ?? 'Unknown account'}
        </div>
      </div>
      <div className={`tx-amount num ${t.amount > 0 ? 'pos-text' : ''}`}>{formatMoney(t.amount, { exact: true })}</div>
      <div className="tx-actions">
        <CategorySelect
          state={state}
          label={`Category for ${t.payee}`}
          value={t.categoryId}
          onChange={(id) => dispatch({ type: 'updateTransaction', id: t.id, patch: { categoryId: id, approved: id !== null } })}
        />
        {!t.approved && t.categoryId && (
          <button onClick={() => dispatch({ type: 'updateTransaction', id: t.id, patch: { approved: true } })}>Approve</button>
        )}
        {t.categoryId && !hasRule && (
          <button
            className="link"
            title="Always use this category for this payee"
            onClick={() => dispatch({ type: 'addRule', rule: { match: payeeKey(t.payee) || t.payee, categoryId: t.categoryId! } })}
          >
            Make rule
          </button>
        )}
        <button className="link danger" aria-label={`Delete ${t.payee}`} onClick={() => dispatch({ type: 'removeTransaction', id: t.id })}>
          Delete
        </button>
      </div>
    </li>
  )
}

function ImportCard({ onImported, onError }: { onImported: (added: number, dupes: number, skipped: number) => void; onError: (m: string) => void }) {
  const { state, dispatch } = useStore()
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const [flip, setFlip] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handle = async (file: File) => {
    const result = parseBankCsv(await file.text(), { flipSign: flip })
    if (result.error) return onError(result.error)
    const incoming = result.transactions.map((t) => ({ ...t, accountId }))
    const seen: Transaction[] = [...state.transactions]
    let dupes = 0
    for (const t of incoming) {
      if (isDuplicate(t, seen)) dupes++
      else seen.push({ ...t, id: '', categoryId: null, approved: false })
    }
    dispatch({ type: 'addTransactions', transactions: incoming })
    onImported(incoming.length - dupes, dupes, result.skipped)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="card">
      <h3>Import from your bank</h3>
      <p className="muted small">Download a CSV from Chase or Bank of America and pick it here. Categories are filled in from your rules and past choices.</p>
      <label className="field">
        Account
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
        Purchases show as positive numbers (some credit card files)
      </label>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handle(f)
        }}
      />
    </div>
  )
}

function AddCard() {
  const { state, dispatch } = useStore()
  const [date, setDate] = useState(todayISO())
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [isInflow, setInflow] = useState(false)
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const cents = parseMoney(amount)

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault()
        if (!payee.trim() || cents === null) return
        dispatch({
          type: 'addTransactions',
          transactions: [{ date, payee: payee.trim(), amount: isInflow ? Math.abs(cents) : -Math.abs(cents), accountId }],
        })
        setPayee('')
        setAmount('')
      }}
    >
      <h3>Add a transaction</h3>
      <div className="field-row">
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          Amount
          <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
      </div>
      <label className="field">
        Payee
        <input value={payee} onChange={(e) => setPayee(e.target.value)} required />
      </label>
      <div className="field-row">
        <label className="field">
          Account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={isInflow} onChange={(e) => setInflow(e.target.checked)} />
          Money in
        </label>
      </div>
      <button className="primary" type="submit" disabled={!payee.trim() || cents === null}>
        Add
      </button>
    </form>
  )
}
