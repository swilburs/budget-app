import { useState } from 'react'
import { MoneyInput } from '../components/inputs'
import { buildMonthView, type GroupMonth } from '../lib/budget'
import { addMonths, formatMonth, monthOf } from '../lib/dates'
import { formatMoney, formatPct } from '../lib/money'
import { useStore } from '../lib/store'

export function BudgetScreen({ onReview }: { onReview: () => void }) {
  const { state, dispatch } = useStore()
  const [month, setMonth] = useState(monthOf(new Date()))
  const [mode, setMode] = useState<'month' | 'plan'>('month')
  const view = buildMonthView(state, month)
  const income = state.monthlyIncome

  // The sheet counts debt payments inside Fixed Costs' 60% target.
  const shareOf = (g: GroupMonth) => {
    const planned = g.group.kind === 'fixed' ? g.planned + (view.groups.find((x) => x.group.kind === 'debt')?.planned ?? 0) : g.planned
    return income > 0 ? planned / income : 0
  }

  const nothingAssigned = Object.values(state.assignments[month] ?? {}).every((v) => v === 0)

  return (
    <section>
      <div className="screen-head">
        <div className="seg" role="tablist" aria-label="Budget view">
          <button role="tab" aria-selected={mode === 'month'} onClick={() => setMode('month')}>
            This month
          </button>
          <button role="tab" aria-selected={mode === 'plan'} onClick={() => setMode('plan')}>
            Monthly plan
          </button>
        </div>
        {mode === 'month' && (
          <div className="month-nav">
            <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
              ‹
            </button>
            <strong>{formatMonth(month)}</strong>
            <button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
              ›
            </button>
          </div>
        )}
      </div>

      {mode === 'month' ? (
        <div className={`banner ${view.readyToAssign < 0 ? 'neg' : view.readyToAssign > 0 ? 'pos' : ''}`}>
          <div>
            <div className="banner-amount">{formatMoney(view.readyToAssign, { exact: true })}</div>
            <div className="muted">Ready to assign</div>
          </div>
          <div className="banner-actions">
            {view.uncategorizedCount > 0 && (
              <button className="link" onClick={onReview}>
                {view.uncategorizedCount} to categorize
              </button>
            )}
            {nothingAssigned && (
              <button className="primary" onClick={() => dispatch({ type: 'assignPlanned', month })}>
                Assign planned amounts
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`banner ${view.leftToPlan < 0 ? 'neg' : ''}`}>
          <div>
            <div className="muted">Monthly income</div>
            <div className="income-row">
              $<MoneyInput label="Monthly income" cents={income} onChange={(c) => dispatch({ type: 'setIncome', cents: c })} />
            </div>
          </div>
          <div className="right">
            <div className="banner-amount">{formatMoney(view.leftToPlan)}</div>
            <div className="muted">left to plan</div>
          </div>
        </div>
      )}

      {mode === 'month' && view.readyToAssign === 0 && view.incomeThisMonth === 0 && state.transactions.length === 0 && (
        <p className="hint">
          Ready to Assign fills up as income transactions come in. Import a bank CSV on the Transactions tab and mark your
          paycheck as Income.
        </p>
      )}

      {view.groups.map((g) => (
        <div className="group" key={g.group.id}>
          <div className="group-head">
            <h3>{g.group.name}</h3>
            {g.group.targetPct !== null && (
              <ShareBar actual={shareOf(g)} target={g.group.targetPct} label={g.group.kind === 'fixed' ? 'incl. debt' : ''} />
            )}
            <div className="cols muted">
              {mode === 'month' ? (
                <>
                  <span>Assigned</span>
                  <span className="hide-sm">Spent</span>
                  <span>Available</span>
                </>
              ) : (
                <span>Monthly</span>
              )}
            </div>
          </div>
          {g.rows.map((r) => (
            <div className="row" key={r.category.id}>
              <span className="name">{r.category.name}</span>
              <div className="cols">
                {mode === 'month' ? (
                  <>
                    <MoneyInput
                      label={`Assigned to ${r.category.name}`}
                      cents={r.assigned}
                      onChange={(c) => dispatch({ type: 'assign', month, categoryId: r.category.id, cents: c })}
                    />
                    <span className="hide-sm num">{formatMoney(-r.activity)}</span>
                    <span className={`pill ${r.available < 0 ? 'neg' : r.available > 0 ? 'pos' : ''}`}>{formatMoney(r.available)}</span>
                  </>
                ) : (
                  <MoneyInput
                    label={`Planned for ${r.category.name}`}
                    cents={r.category.planned}
                    onChange={(c) => dispatch({ type: 'updateCategory', id: r.category.id, patch: { planned: c } })}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="row total">
            <span className="name">Total</span>
            <div className="cols">
              {mode === 'month' ? (
                <>
                  <span className="num">{formatMoney(g.assigned)}</span>
                  <span className="hide-sm num">{formatMoney(-g.activity)}</span>
                  <span className="num">{formatMoney(g.available)}</span>
                </>
              ) : (
                <span className="num">{formatMoney(g.planned)}</span>
              )}
            </div>
          </div>
          {mode === 'plan' && (
            <AddCategory onAdd={(name) => dispatch({ type: 'addCategory', groupId: g.group.id, name })} />
          )}
        </div>
      ))}
    </section>
  )
}

function ShareBar({ actual, target, label }: { actual: number; target: number; label: string }) {
  const over = actual > target
  return (
    <div className="share" title={`${formatPct(actual)} of income planned, target ${formatPct(target)}`}>
      <div className="share-track">
        <div className={`share-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, (actual / Math.max(target, 0.0001)) * 100)}%` }} />
      </div>
      <span className={`share-text ${over ? 'neg-text' : ''}`}>
        {formatPct(actual)} of income · target {formatPct(target)} {label && <span className="muted">({label})</span>}
      </span>
    </div>
  )
}

function AddCategory({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form
      className="add-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onAdd(name.trim())
        setName('')
      }}
    >
      <input placeholder="Add a category" value={name} onChange={(e) => setName(e.target.value)} aria-label="New category name" />
      <button type="submit" disabled={!name.trim()}>
        Add
      </button>
    </form>
  )
}
