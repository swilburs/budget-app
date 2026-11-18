import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MoneyInput } from '../components/inputs'
import { linkedAmounts } from '../lib/budget'
import { formatMonth, monthOf } from '../lib/dates'
import { simulatePlan, type PlanResult } from '../lib/finance'
import { formatCompact, formatMoney } from '../lib/money'
import { useStore } from '../lib/store'
import type { Category } from '../lib/types'

const HORIZON_YEARS = 30

export function WhatIfScreen() {
  const { state, dispatch } = useStore()
  const [changes, setChanges] = useState<Record<string, number>>({})
  const [rollover, setRollover] = useState(false)
  const [rolloverTo, setRolloverTo] = useState<string>('')
  const start = monthOf(new Date())

  const scenarioCats: Category[] = state.categories.map((c) => (c.id in changes ? { ...c, planned: changes[c.id] } : c))
  const run = (cats: Category[], roll: boolean): PlanResult => {
    const { debtPayments, contributions } = linkedAmounts(cats)
    return simulatePlan({
      debts: state.debts,
      debtPayments,
      investments: state.investments,
      contributions,
      rollover: roll,
      rolloverInvestmentId: roll && rolloverTo ? rolloverTo : undefined,
      months: HORIZON_YEARS * 12,
      startMonth: start,
    })
  }
  // Baseline is your current plan exactly as it stands (no rollover).
  const baseline = useMemo(() => run(state.categories, false), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const scenario = run(scenarioCats, rollover)

  const plannedTotal = (cats: Category[]) => cats.reduce((a, c) => a + c.planned, 0)
  const leftBase = state.monthlyIncome - plannedTotal(state.categories)
  const leftScenario = state.monthlyIncome - plannedTotal(scenarioCats)
  const retireBase = Object.values(baseline.balanceAtTarget).reduce((a, b) => a + b, 0)
  const retireScenario = Object.values(scenario.balanceAtTarget).reduce((a, b) => a + b, 0)
  const at = (r: PlanResult, years: number) => r.timeline[Math.min(r.timeline.length - 1, years * 12)].netWorth
  const changed = Object.keys(changes).length > 0 || rollover

  const chart = baseline.timeline
    .filter((_, i) => i % 12 === 0)
    .map((p, i) => ({ year: Number(p.month.slice(0, 4)), 'Current plan': Math.round(p.netWorth / 100), 'What-if': Math.round(scenario.timeline[i * 12].netWorth / 100) }))

  const rows: { label: string; base: string; next: string; better: boolean | null }[] = [
    { label: 'Left to plan each month', base: formatMoney(leftBase), next: formatMoney(leftScenario), better: cmp(leftScenario, leftBase) },
    {
      label: 'Debt-free',
      base: baseline.debtFreeMonth ? formatMonth(baseline.debtFreeMonth) : `After ${HORIZON_YEARS} yrs`,
      next: scenario.debtFreeMonth ? formatMonth(scenario.debtFreeMonth) : `After ${HORIZON_YEARS} yrs`,
      better: cmp(-(monthIndex(scenario.debtFreeMonth)), -(monthIndex(baseline.debtFreeMonth))),
    },
    { label: `Interest paid (${HORIZON_YEARS} yrs)`, base: formatMoney(baseline.totalInterest), next: formatMoney(scenario.totalInterest), better: cmp(-scenario.totalInterest, -baseline.totalInterest) },
    { label: 'Retirement savings at target', base: formatMoney(retireBase), next: formatMoney(retireScenario), better: cmp(retireScenario, retireBase) },
    ...[10, 20, 30].map((y) => ({ label: `Net worth in ${y} yrs`, base: formatMoney(at(baseline, y)), next: formatMoney(at(scenario, y)), better: cmp(at(scenario, y), at(baseline, y)) })),
  ]

  return (
    <section>
      <p className="lead">Change any monthly amount below and see how it plays out over {HORIZON_YEARS} years. Nothing changes in your budget until you apply it.</p>

      <div className="whatif">
        <div className="whatif-results">
          <div className="table-wrap">
            <table className="data compare">
              <thead>
                <tr>
                  <th />
                  <th>Current plan</th>
                  <th>What-if</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td className="num">{r.base}</td>
                    <td className={`num ${r.better === true ? 'pos-text' : r.better === false ? 'neg-text' : ''}`}>{r.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3>Net worth (investments minus debt)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--muted)" tickLine={false} />
                <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} width={64} tickFormatter={formatCompact} />
                <Tooltip formatter={(v) => formatMoney(Number(v) * 100)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <Legend />
                <Line type="monotone" dataKey="Current plan" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="What-if" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} strokeDasharray={changed ? undefined : '4 4'} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="actions">
            <button
              className="primary"
              disabled={Object.keys(changes).length === 0}
              onClick={() => {
                for (const [id, planned] of Object.entries(changes)) dispatch({ type: 'updateCategory', id, patch: { planned } })
                setChanges({})
              }}
            >
              Apply to my plan
            </button>
            <button disabled={!changed} onClick={() => { setChanges({}); setRollover(false) }}>
              Reset
            </button>
          </div>
        </div>

        <div className="whatif-inputs">
          <label className="check card-check">
            <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
            <span>When a debt is paid off, put its payment toward the next debt</span>
          </label>
          {rollover && (
            <label className="field">
              Once debt-free, invest those payments in
              <select value={rolloverTo} onChange={(e) => setRolloverTo(e.target.value)}>
                <option value="">Nothing (keep as spending money)</option>
                {state.investments.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {state.groups.map((g) => (
            <div className="group" key={g.id}>
              <h3>{g.name}</h3>
              {scenarioCats
                .filter((c) => c.groupId === g.id)
                .map((c) => {
                  const original = state.categories.find((x) => x.id === c.id)!.planned
                  return (
                    <div className={`row ${c.planned !== original ? 'edited' : ''}`} key={c.id}>
                      <span className="name">{c.name}</span>
                      <div className="cols">
                        {c.planned !== original && <span className="muted small strike">{formatMoney(original)}</span>}
                        <MoneyInput
                          label={`What-if amount for ${c.name}`}
                          cents={c.planned}
                          onChange={(v) =>
                            setChanges((prev) => {
                              const next = { ...prev }
                              if (v === original) delete next[c.id]
                              else next[c.id] = v
                              return next
                            })
                          }
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function cmp(next: number, base: number): boolean | null {
  if (next === base) return null
  return next > base
}

function monthIndex(month: string | null): number {
  if (!month) return Number.MAX_SAFE_INTEGER
  const [y, m] = month.split('-').map(Number)
  return y * 12 + m
}
