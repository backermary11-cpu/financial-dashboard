import { useState, type FormEvent } from 'react'
import { EXPENSE_CATEGORIES, budgetStatus, currentMonthKey, fmt, lastMonths, monthLabel, newId } from '../lib/finance'
import type { AppData, Ledger } from '../lib/types'
import { Card, StatusBadge } from './ui'
import { statusColor } from '../lib/ui-helpers'

export function Budgets({
  data,
  ledger,
  setData,
}: {
  data: AppData
  ledger: Ledger
  setData: (fn: (d: AppData) => AppData) => void
}) {
  const months = lastMonths(currentMonthKey(), 12).reverse()
  const [month, setMonth] = useState(months[0])
  const rows = budgetStatus(data.budgets, data.transactions, ledger, month)
  const totalLimit = rows.reduce((a, r) => a + r.budget.monthlyLimit, 0)
  const totalSpent = rows.reduce((a, r) => a + r.spent, 0)
  const used = new Set(rows.map((r) => r.budget.category))
  const available = EXPENSE_CATEGORIES.filter((c) => !used.has(c))

  function update(id: string, monthlyLimit: number) {
    setData((d) => ({ ...d, budgets: d.budgets.map((b) => (b.id === id ? { ...b, monthlyLimit } : b)) }))
  }
  function remove(id: string) {
    setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }))
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
          {fmt.moneyWhole(totalSpent)} spent of {fmt.moneyWhole(totalLimit)} budgeted
        </span>
      </div>

      <Card title="Monthly budgets" sub="Near limit at 80%, over budget past 100%">
        {rows.length === 0 && <div className="empty">No budgets yet — add one below.</div>}
        {rows.map((r) => (
          <div className="budget" key={r.budget.id}>
            <div className="budget-head">
              <strong style={{ fontWeight: 600 }}>{r.budget.category}</strong>
              <span className="amounts">
                {fmt.money(r.spent)} of{' '}
                <input
                  className="input"
                  style={{ width: 100, padding: '3px 6px' }}
                  type="number"
                  min="0"
                  step="10"
                  value={r.budget.monthlyLimit}
                  aria-label={`${r.budget.category} monthly limit`}
                  onChange={(e) => update(r.budget.id, Math.max(0, Number(e.target.value) || 0))}
                />
              </span>
            </div>
            <div className="meter">
              <span style={{ width: `${Math.min(r.ratio, 1) * 100}%`, background: statusColor(r.state) }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <StatusBadge state={r.state} />
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {r.remaining >= 0 ? `${fmt.money(r.remaining)} left` : `${fmt.money(-r.remaining)} over`}
                </span>
              </span>
              <button className="btn ghost danger" onClick={() => remove(r.budget.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </Card>

      {available.length > 0 && (
        <Card title="Add a budget">
          <AddBudget
            categories={available}
            onAdd={(category, monthlyLimit) =>
              setData((d) => ({ ...d, budgets: [...d.budgets, { id: newId(), ledger, category, monthlyLimit }] }))
            }
          />
        </Card>
      )}
    </div>
  )
}

function AddBudget({ categories, onAdd }: { categories: string[]; onAdd: (category: string, limit: number) => void }) {
  const [category, setCategory] = useState(categories[0])
  const [limit, setLimit] = useState('')
  const selected = categories.includes(category) ? category : categories[0]

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(limit)
    if (!Number.isFinite(n) || n <= 0) return
    onAdd(selected, n)
    setLimit('')
  }

  return (
    <form className="toolbar" style={{ marginBottom: 0 }} onSubmit={submit}>
      <select className="input" value={selected} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
        {categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        min="1"
        step="10"
        placeholder="Monthly limit"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        aria-label="Monthly limit"
        required
      />
      <button className="btn primary" type="submit">
        Add budget
      </button>
    </form>
  )
}
