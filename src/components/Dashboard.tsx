import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  budgetStatus,
  currentMonthKey,
  filterTransactions,
  fmt,
  lastMonths,
  monthLabel,
  monthlySeries,
  spendingByCategory,
  totals,
} from '../lib/finance'
import type { AppData, Ledger } from '../lib/types'
import { Card, ChartTooltip, StatTile, StatusBadge } from './ui'
import { statusColor } from '../lib/ui-helpers'

const RANGES = [3, 6, 12] as const
const axisTick = { fill: 'var(--muted)', fontSize: 12 }

export function Dashboard({ data, ledger, onGoTo }: { data: AppData; ledger: Ledger; onGoTo: (tab: 'budgets') => void }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(6)
  const month = currentMonthKey()
  const months = useMemo(() => lastMonths(month, range), [month, range])

  const txns = useMemo(() => filterTransactions(data.transactions, ledger, months), [data.transactions, ledger, months])
  const sum = totals(txns)
  const series = monthlySeries(txns, months)
  const categories = spendingByCategory(txns)
  const budgets = budgetStatus(data.budgets, data.transactions, ledger, month).slice(0, 5)
  const avgMonthlySpend = sum.expenses / range

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
              {r} months
            </button>
          ))}
        </div>
        <span className="sub" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          {monthLabel(months[0])} – {monthLabel(months[months.length - 1])}
        </span>
      </div>

      <div className="grid kpis">
        <StatTile label="Income" value={fmt.moneyWhole(sum.income)} note={`${fmt.moneyWhole(sum.income / range)} / month avg`} />
        <StatTile label="Expenses" value={fmt.moneyWhole(sum.expenses)} note={`${fmt.moneyWhole(avgMonthlySpend)} / month avg`} />
        <StatTile
          label="Net cash flow"
          value={fmt.moneyWhole(sum.net)}
          tone={sum.net >= 0 ? 'pos' : 'neg'}
          note={sum.net >= 0 ? 'More in than out' : 'Spending exceeds income'}
        />
        <StatTile label={ledger === 'business' ? 'Profit margin' : 'Savings rate'} value={fmt.pct(sum.savingsRate)} note="Net ÷ income" />
      </div>

      <div className="grid two-col">
        <Card title="Income vs. expenses" sub="Per month">
          <div className="legend" aria-hidden="true">
            <span>
              <span className="swatch" style={{ background: 'var(--series-1)' }} />
              Income
            </span>
            <span>
              <span className="swatch" style={{ background: 'var(--series-2)' }} />
              Expenses
            </span>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={series} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmt.compact} width={56} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="income" name="Income" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>Show as table</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Income</th>
                    <th className="num">Expenses</th>
                    <th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((r) => (
                    <tr key={r.month}>
                      <td>{monthLabel(r.month)}</td>
                      <td className="num">{fmt.money(r.income)}</td>
                      <td className="num">{fmt.money(r.expenses)}</td>
                      <td className={`num ${r.net >= 0 ? 'pos' : 'neg'}`}>{fmt.money(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>

        <Card title="Where the money goes" sub="Expenses by category">
          {categories.length === 0 ? (
            <div className="empty">No expenses in this period.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {categories.map((c) => (
                <div key={c.category} title={`${c.category}: ${fmt.money(c.amount)} (${fmt.pct(c.share)})`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span>{c.category}</span>
                    <span style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt.moneyWhole(c.amount)} · {fmt.pct(c.share)}
                    </span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${(c.amount / categories[0].amount) * 100}%`, background: 'var(--series-1)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid two-col">
        <Card title="Cumulative net cash flow" sub="Running total of income minus expenses">
          <div className="chart" style={{ height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmt.compact} width={56} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--axis)' }} />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative net"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Budgets this month"
          sub={monthLabel(month)}
          actions={
            <button className="btn ghost" onClick={() => onGoTo('budgets')}>
              Manage
            </button>
          }
        >
          {budgets.length === 0 ? (
            <div className="empty">No budgets yet for this ledger.</div>
          ) : (
            budgets.map((b) => (
              <div className="budget" key={b.budget.id}>
                <div className="budget-head">
                  <span>{b.budget.category}</span>
                  <span className="amounts">
                    {fmt.money(b.spent)} / {fmt.moneyWhole(b.budget.monthlyLimit)}
                  </span>
                </div>
                <div className="meter">
                  <span style={{ width: `${Math.min(b.ratio, 1) * 100}%`, background: statusColor(b.state) }} />
                </div>
                <StatusBadge state={b.state} />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
