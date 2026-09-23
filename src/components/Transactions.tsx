import { useMemo, useRef, useState, type FormEvent } from 'react'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  fmt,
  newId,
  parseTransactionsCsv,
  round2,
  transactionsToCsv,
} from '../lib/finance'
import type { AppData, Ledger, Transaction } from '../lib/types'
import { download } from '../lib/ui-helpers'
import { Card } from './ui'

const PAGE = 50

export function Transactions({
  data,
  ledger,
  setData,
}: {
  data: AppData
  ledger: Ledger
  setData: (fn: (d: AppData) => AppData) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ledgerTxns = useMemo(() => data.transactions.filter((t) => t.ledger === ledger), [data.transactions, ledger])
  const categories = useMemo(
    () => [...new Set([...ledgerTxns.map((t) => t.category), ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])].sort(),
    [ledgerTxns],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ledgerTxns
      .filter((t) => (!category || t.category === category) && (!q || t.description.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [ledgerTxns, query, category])

  function add(t: Transaction) {
    setData((d) => ({ ...d, transactions: [...d.transactions, t] }))
  }
  function remove(id: string) {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }))
  }

  async function onImport(file: File) {
    const { transactions, errors } = parseTransactionsCsv(await file.text(), ledger)
    setData((d) => ({ ...d, transactions: [...d.transactions, ...transactions] }))
    setMessage(
      `Imported ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}` +
        (errors.length ? `; skipped ${errors.length} row(s): ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}` : '.'),
    )
  }

  return (
    <div className="stack">
      <Card title="Add a transaction" sub="Use a negative amount or pick Expense for money going out">
        <AddForm ledger={ledger} categories={categories} onAdd={add} />
      </Card>

      <Card title={`Transactions (${filtered.length})`}>
        {message && (
          <div className="notice" role="status">
            {message}{' '}
            <button className="btn ghost" onClick={() => setMessage(null)}>
              Dismiss
            </button>
          </div>
        )}
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search descriptions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search descriptions"
          />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="spacer" />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import CSV
          </button>
          <button className="btn" onClick={() => download(`${ledger}-transactions.csv`, transactionsToCsv(filtered))}>
            Export CSV
          </button>
        </div>
        <p className="sub" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          CSV columns: <code>date, description, category, amount</code> (or <code>debit</code>/<code>credit</code>). Dates as
          YYYY-MM-DD or MM/DD/YYYY.
        </p>

        {filtered.length === 0 ? (
          <div className="empty">No transactions match.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td className="desc">{t.description}</td>
                    <td>
                      <span className="chip">{t.category}</span>
                    </td>
                    <td className={`num ${t.amount >= 0 ? 'pos' : ''}`}>{fmt.money(t.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost danger" onClick={() => remove(t.id)} aria-label={`Delete ${t.description}`}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > shown && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn" onClick={() => setShown((s) => s + PAGE)}>
              Show more ({filtered.length - shown} left)
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

function AddForm({ ledger, categories, onAdd }: { ledger: Ledger; categories: string[]; onAdd: (t: Transaction) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Groceries')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!description.trim() || !Number.isFinite(n) || n === 0) return
    onAdd({
      id: newId(),
      ledger,
      date,
      description: description.trim(),
      category,
      amount: round2(kind === 'expense' ? -Math.abs(n) : Math.abs(n)),
    })
    setDescription('')
    setAmount('')
  }

  return (
    <form className="form-row" onSubmit={submit}>
      <label>
        Date
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="wide">
        Description
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Coffee beans" required />
      </label>
      <label>
        Category
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Amount
        <input className="input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="segmented" role="group" aria-label="Type">
          <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>
            Expense
          </button>
          <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>
            Income
          </button>
        </div>
        <button className="btn primary" type="submit">
          Add
        </button>
      </div>
    </form>
  )
}
