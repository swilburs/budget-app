import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MoneyInput, PctInput } from '../components/inputs'
import { linkedAmounts } from '../lib/budget'
import { monthOf, monthsBetween, todayISO } from '../lib/dates'
import { employerMatch, futureValue, projectedAtTarget } from '../lib/finance'
import { formatCompact, formatMoney } from '../lib/money'
import { useStore } from '../lib/store'
import { Stat } from './DebtScreen'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

export function RetirementScreen() {
  const { state, dispatch } = useStore()
  const today = todayISO()
  const { contributions } = linkedAmounts(state.categories)
  const { withdrawalRate, inflationRate } = state.retirement
  const categoryFor = (id: string) => state.categories.find((c) => c.investmentId === id)

  const projections = state.investments.map((inv) => {
    const own = contributions[inv.id] ?? 0
    return { inv, own, match: employerMatch(inv, own), atTarget: projectedAtTarget(inv, own, today), months: monthsBetween(today, inv.targetDate) }
  })
  const total = projections.reduce((a, p) => a + p.atTarget, 0)
  const lastMonths = Math.max(0, ...projections.map((p) => p.months))
  const years = lastMonths / 12
  const deflator = Math.pow(1 + inflationRate, years)
  const monthlyIncome = (total * withdrawalRate) / 12

  // One point per year to the latest target date; each account stops growing contributions at its own target.
  const active = projections.filter((p) => p.own + p.match > 0 || p.inv.balance > 0)
  const chart = Array.from({ length: Math.ceil(years) + 1 }, (_, y) => {
    const m = Math.min(y * 12, lastMonths)
    const row: Record<string, number | string> = { year: new Date().getFullYear() + y }
    for (const p of active) {
      const contribMonths = Math.min(m, p.months)
      const atStop = futureValue(p.inv.annualReturn, contribMonths, p.own + p.match, p.inv.balance)
      row[p.inv.name] = Math.round(futureValue(p.inv.annualReturn, m - contribMonths, 0, atStop) / 100)
    }
    return row
  })

  return (
    <section>
      <div className="stat-row">
        <Stat label="Projected at target" value={formatMoney(total)} sub={`${formatMoney(total / deflator)} in today's dollars`} />
        <Stat
          label={`Monthly income at ${(withdrawalRate * 100).toFixed(1)}% withdrawal`}
          value={formatMoney(monthlyIncome)}
          sub={`${formatMoney(monthlyIncome / deflator)} in today's dollars`}
        />
        <Stat label="Saving each month" value={formatMoney(projections.reduce((a, p) => a + p.own + p.match, 0))} sub="including employer match" />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th>Balance</th>
              <th>You add / mo</th>
              <th>Employer match</th>
              <th>Return / yr</th>
              <th>Target date</th>
              <th>At target</th>
            </tr>
          </thead>
          <tbody>
            {projections.map(({ inv, own, match, atTarget }) => {
              const cat = categoryFor(inv.id)
              const patch = (p: Partial<typeof inv>) => dispatch({ type: 'updateInvestment', id: inv.id, patch: p })
              return (
                <tr key={inv.id}>
                  <th scope="row">{inv.name}</th>
                  <td>
                    <MoneyInput label={`${inv.name} balance`} cents={inv.balance} onChange={(c) => patch({ balance: c })} />
                  </td>
                  <td>
                    {cat ? (
                      <MoneyInput label={`${inv.name} monthly contribution`} cents={own} onChange={(c) => dispatch({ type: 'updateCategory', id: cat.id, patch: { planned: c } })} />
                    ) : (
                      formatMoney(own)
                    )}
                  </td>
                  <td>
                    <label className="check inline">
                      <input type="checkbox" checked={inv.employerMatch} onChange={(e) => patch({ employerMatch: e.target.checked })} aria-label={`${inv.name} has employer match`} />
                      {inv.employerMatch && (
                        <>
                          <PctInput label={`${inv.name} match percent`} value={inv.matchPct} onChange={(v) => patch({ matchPct: v })} />%
                        </>
                      )}
                    </label>
                    {match > 0 && <div className="muted small">+{formatMoney(match)}/mo</div>}
                  </td>
                  <td>
                    <PctInput label={`${inv.name} expected return`} value={inv.annualReturn} onChange={(v) => patch({ annualReturn: v })} />%
                  </td>
                  <td>
                    <input type="date" aria-label={`${inv.name} target date`} value={inv.targetDate} min={`${monthOf(new Date())}-01`} onChange={(e) => e.target.value && patch({ targetDate: e.target.value })} />
                  </td>
                  <td className="num">{formatMoney(atTarget)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {active.length > 0 && (
        <div className="chart-card">
          <h3>Growth to your target date</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="year" stroke="var(--muted)" tickLine={false} />
              <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={formatCompact} width={56} />
              <Tooltip
                formatter={(v) => formatMoney(Number(v) * 100)}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              {active.length > 1 && <Legend />}
              {active.map((p, i) => (
                <Area
                  key={p.inv.id}
                  type="monotone"
                  dataKey={p.inv.name}
                  stackId="1"
                  stroke={SERIES[i % SERIES.length]}
                  fill={SERIES[i % SERIES.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card settings-inline">
        <label className="field">
          Withdrawal rate in retirement
          <span>
            <PctInput label="Withdrawal rate" value={withdrawalRate} onChange={(v) => dispatch({ type: 'updateRetirement', patch: { withdrawalRate: v } })} />%
          </span>
        </label>
        <label className="field">
          Expected inflation
          <span>
            <PctInput label="Inflation" value={inflationRate} onChange={(v) => dispatch({ type: 'updateRetirement', patch: { inflationRate: v } })} />%
          </span>
        </label>
        <p className="muted small">
          Projections assume steady returns and monthly compounding, like your spreadsheet. The 4% withdrawal rate is a common rule of thumb, not advice.
        </p>
      </div>
    </section>
  )
}
