import Papa from 'papaparse'
import type { Budget, Holding, Ledger, Transaction } from './types'

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Sales', 'Services', 'Interest', 'Other income']
export const EXPENSE_CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Software',
  'Payroll',
  'Marketing',
  'Office',
  'Taxes',
  'Other',
]

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/** "2026-09-14" -> "2026-09" */
export function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** "2026-09" -> "Sep 2026" (or "Sep" when short) */
export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleString('en-US', { month: 'short', year: short ? undefined : 'numeric', timeZone: 'UTC' })
}

/** The last `count` month keys ending at `end` (inclusive), oldest first. */
export function lastMonths(end: string, count: number): string[] {
  const [y, m] = end.split('-').map(Number)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function filterTransactions(txns: Transaction[], ledger: Ledger, months?: string[]): Transaction[] {
  const set = months ? new Set(months) : null
  return txns.filter((t) => t.ledger === ledger && (!set || set.has(monthKey(t.date))))
}

export interface Totals {
  income: number
  expenses: number
  net: number
  /** Share of income kept, 0-1; null when there is no income */
  savingsRate: number | null
}

export function totals(txns: Transaction[]): Totals {
  let income = 0
  let expenses = 0
  for (const t of txns) {
    if (t.amount >= 0) income += t.amount
    else expenses += -t.amount
  }
  const net = income - expenses
  return { income, expenses, net, savingsRate: income > 0 ? net / income : null }
}

export interface MonthRow {
  month: string
  label: string
  income: number
  expenses: number
  net: number
  /** Running total of net across the rows */
  cumulative: number
}

export function monthlySeries(txns: Transaction[], months: string[]): MonthRow[] {
  const byMonth = new Map(months.map((m) => [m, { income: 0, expenses: 0 }]))
  for (const t of txns) {
    const row = byMonth.get(monthKey(t.date))
    if (!row) continue
    if (t.amount >= 0) row.income += t.amount
    else row.expenses += -t.amount
  }
  let running = 0
  return months.map((m) => {
    const { income, expenses } = byMonth.get(m)!
    running += income - expenses
    return {
      month: m,
      label: monthLabel(m, true),
      income: round2(income),
      expenses: round2(expenses),
      net: round2(income - expenses),
      cumulative: round2(running),
    }
  })
}

export interface CategoryRow {
  category: string
  amount: number
  share: number
}

/** Expense totals per category, largest first. Categories past `maxRows` fold into "Everything else". */
export function spendingByCategory(txns: Transaction[], maxRows = 8): CategoryRow[] {
  const map = new Map<string, number>()
  for (const t of txns) {
    if (t.amount < 0) map.set(t.category, (map.get(t.category) ?? 0) - t.amount)
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  let rows = [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  if (rows.length > maxRows) {
    const rest = rows.slice(maxRows - 1).reduce((a, r) => a + r.amount, 0)
    rows = [...rows.slice(0, maxRows - 1), { category: 'Everything else', amount: rest }]
  }
  return rows.map((r) => ({ ...r, amount: round2(r.amount), share: total ? r.amount / total : 0 }))
}

export type BudgetState = 'good' | 'warning' | 'critical'

export interface BudgetStatus {
  budget: Budget
  spent: number
  remaining: number
  /** spent / limit (can exceed 1) */
  ratio: number
  state: BudgetState
}

export function budgetStatus(budgets: Budget[], txns: Transaction[], ledger: Ledger, month: string): BudgetStatus[] {
  const monthTxns = filterTransactions(txns, ledger, [month])
  return budgets
    .filter((b) => b.ledger === ledger)
    .map((budget) => {
      const spent = round2(
        monthTxns.filter((t) => t.amount < 0 && t.category === budget.category).reduce((a, t) => a - t.amount, 0),
      )
      const ratio = budget.monthlyLimit > 0 ? spent / budget.monthlyLimit : spent > 0 ? Infinity : 0
      const state: BudgetState = ratio > 1 ? 'critical' : ratio >= 0.8 ? 'warning' : 'good'
      return { budget, spent, remaining: round2(budget.monthlyLimit - spent), ratio, state }
    })
    .sort((a, b) => b.ratio - a.ratio)
}

export interface HoldingRow extends Holding {
  value: number
  cost: number
  gain: number
  gainPct: number | null
  weight: number
}

export interface PortfolioSummary {
  rows: HoldingRow[]
  value: number
  cost: number
  gain: number
  gainPct: number | null
}

export function portfolio(holdings: Holding[]): PortfolioSummary {
  const base = holdings.map((h) => {
    const value = h.shares * h.price
    const cost = h.shares * h.costBasis
    return { ...h, value, cost, gain: value - cost, gainPct: cost > 0 ? (value - cost) / cost : null }
  })
  const value = base.reduce((a, r) => a + r.value, 0)
  const cost = base.reduce((a, r) => a + r.cost, 0)
  const rows = base.map((r) => ({ ...r, weight: value > 0 ? r.value / value : 0 })).sort((a, b) => b.value - a.value)
  return { rows, value, cost, gain: value - cost, gainPct: cost > 0 ? (value - cost) / cost : null }
}

// ---------- CSV ----------

export interface CsvImportResult {
  transactions: Transaction[]
  errors: string[]
}

const HEADER_ALIASES: Record<string, keyof Transaction> = {
  date: 'date',
  description: 'description',
  memo: 'description',
  payee: 'description',
  name: 'description',
  category: 'category',
  amount: 'amount',
  value: 'amount',
}

/**
 * Parses a CSV with columns date, description, category, amount
 * (common aliases accepted; debit/credit columns are also supported).
 */
export function parseTransactionsCsv(text: string, ledger: Ledger): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  const errors: string[] = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`)
  const transactions: Transaction[] = []

  parsed.data.forEach((raw, i) => {
    const rowNo = i + 2
    const row: Partial<Record<keyof Transaction, string>> = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_ALIASES[k]
      if (key && row[key] === undefined) row[key] = v
    }
    let amount = parseAmount(row.amount)
    if (amount === null && ('debit' in raw || 'credit' in raw)) {
      const credit = parseAmount(raw.credit) ?? 0
      const debit = parseAmount(raw.debit) ?? 0
      amount = credit - Math.abs(debit)
    }
    const date = normalizeDate(row.date)
    if (!date) return errors.push(`Row ${rowNo}: unrecognised date "${row.date ?? ''}"`)
    if (amount === null) return errors.push(`Row ${rowNo}: unrecognised amount "${row.amount ?? ''}"`)
    transactions.push({
      id: newId(),
      ledger,
      date,
      description: (row.description ?? '').trim() || '(no description)',
      category: (row.category ?? '').trim() || (amount >= 0 ? 'Other income' : 'Other'),
      amount: round2(amount),
    })
  })
  return { transactions, errors }
}

export function transactionsToCsv(txns: Transaction[]): string {
  return Papa.unparse(
    [...txns]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ ledger, date, description, category, amount }) => ({ date, description, category, amount, ledger })),
  )
}

export function parseAmount(v: string | undefined): number | null {
  if (v === undefined) return null
  let s = v.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[$€£\s,]/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -Math.abs(n) : n
}

/** Accepts YYYY-MM-DD, YYYY/MM/DD and MM/DD/YYYY. */
export function normalizeDate(v: string | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return ymd(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return ymd(+m[3], +m[1], +m[2])
  return null
}

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------- formatting ----------

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const currencyWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' })

export const fmt = {
  money: (n: number) => currency.format(n),
  moneyWhole: (n: number) => currencyWhole.format(n),
  compact: (n: number) => compact.format(n),
  pct: (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`),
}
