import { useState } from 'react'
import { MoneyInput, PctInput } from '../components/inputs'
import { linkedAmounts } from '../lib/budget'
import { addMonths, formatDuration, formatMonth, monthOf } from '../lib/dates'
import { monthsToPayoff, simulatePlan } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { useStore } from '../lib/store'

export function DebtScreen() {
  const { state, dispatch } = useStore()
  const [rollover, setRollover] = useState(false)
  const start = monthOf(new Date())
  const { debtPayments } = linkedAmounts(state.categories)
  const common = { debts: state.debts, debtPayments, investments: [], contributions: {}, months: 1200, startMonth: start }
  const plain = simulatePlan({ ...common, rollover: false })
  const avalanche = simulatePlan({ ...common, rollover: true })
  const shown = rollover ? avalanche : plain
  const totalBalance = state.debts.reduce((a, d) => a + d.balance, 0)
  const categoryFor = (debtId: string) => state.categories.find((c) => c.debtId === debtId)

  return (
    <section>
      <div className="stat-row">
        <Stat label="Total owed" value={formatMoney(totalBalance)} />
        <Stat label="Monthly payments" value={formatMoney(Object.values(debtPayments).reduce((a, b) => a + b, 0))} />
        <Stat label="Debt-free" value={shown.debtFreeMonth ? formatMonth(shown.debtFreeMonth) : 'Not with these payments'} />
        <Stat label="Interest still to pay" value={formatMoney(shown.totalInterest)} />
      </div>

      <label className="check card-check">
        <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
        <span>
          <strong>Roll paid-off payments into the next debt</strong> (highest interest first). Debt-free{' '}
          {avalanche.debtFreeMonth ? formatMonth(avalanche.debtFreeMonth) : 'never'} instead of{' '}
          {plain.debtFreeMonth ? formatMonth(plain.debtFreeMonth) : 'never'}, saving{' '}
          {formatMoney(plain.totalInterest - avalanche.totalInterest)} in interest.
        </span>
      </label>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Debt</th>
              <th>Balance</th>
              <th>APR</th>
              <th>Monthly payment</th>
              <th>Payoff</th>
              <th>Interest left</th>
            </tr>
          </thead>
          <tbody>
            {state.debts.map((d) => {
              const cat = categoryFor(d.id)
              const payment = debtPayments[d.id] ?? 0
              const closed = monthsToPayoff(d.balance, d.apr, payment)
              const sim = shown.debts.find((x) => x.id === d.id)!
              const months = rollover ? sim.payoffMonths : closed
              const interestOnly = Math.round((d.balance * d.apr) / 12)
              return (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  <td>
                    <MoneyInput label={`${d.name} balance`} cents={d.balance} onChange={(c) => dispatch({ type: 'updateDebt', id: d.id, patch: { balance: c } })} />
                  </td>
                  <td>
                    <PctInput label={`${d.name} APR`} value={d.apr} onChange={(v) => dispatch({ type: 'updateDebt', id: d.id, patch: { apr: v } })} />%
                  </td>
                  <td>
                    {cat ? (
                      <MoneyInput
                        label={`${d.name} monthly payment`}
                        cents={payment}
                        onChange={(c) => dispatch({ type: 'updateCategory', id: cat.id, patch: { planned: c } })}
                      />
                    ) : (
                      formatMoney(payment)
                    )}
                  </td>
                  <td>
                    {d.balance <= 0 ? (
                      <span className="muted">Paid off</span>
                    ) : Number.isFinite(months) ? (
                      <>
                        {formatMonth(addMonths(start, months))}
                        <div className="muted small">{formatDuration(months)}</div>
                      </>
                    ) : (
                      <span className="neg-text">Payment too low</span>
                    )}
                    {d.balance > 0 && payment > 0 && payment < interestOnly * 1.25 && (
                      <div className="warn small">⚠ {formatMoney(interestOnly)} of each payment is interest</div>
                    )}
                  </td>
                  <td className="num">{d.balance > 0 ? formatMoney(sim.interestPaid) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Payments here are the same numbers as the Debt Payments group on your budget; changing one changes the other.</p>
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="muted small">{label}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  )
}
