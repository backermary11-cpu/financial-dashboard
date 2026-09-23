import { describe, expect, it } from 'vitest'
import {
  budgetStatus,
  lastMonths,
  monthlySeries,
  normalizeDate,
  parseAmount,
  parseTransactionsCsv,
  portfolio,
  spendingByCategory,
  totals,
  transactionsToCsv,
} from './finance'
import type { Transaction } from './types'

const tx = (date: string, amount: number, category = 'Other', ledger: Transaction['ledger'] = 'personal'): Transaction => ({
  id: `${date}-${amount}-${category}`,
  ledger,
  date,
  description: category,
  category,
  amount,
})

describe('lastMonths', () => {
  it('walks back across a year boundary', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('totals', () => {
  it('splits income and expenses and computes savings rate', () => {
    const t = totals([tx('2026-01-01', 1000), tx('2026-01-02', -250), tx('2026-01-03', -150)])
    expect(t).toEqual({ income: 1000, expenses: 400, net: 600, savingsRate: 0.6 })
  })
  it('has no savings rate without income', () => {
    expect(totals([tx('2026-01-02', -10)]).savingsRate).toBeNull()
  })
})

describe('monthlySeries', () => {
  it('buckets by month, fills empty months, and accumulates net', () => {
    const rows = monthlySeries([tx('2026-01-05', 100), tx('2026-01-09', -40), tx('2026-03-01', -10)], ['2026-01', '2026-02', '2026-03'])
    expect(rows.map((r) => [r.month, r.income, r.expenses, r.net, r.cumulative])).toEqual([
      ['2026-01', 100, 40, 60, 60],
      ['2026-02', 0, 0, 0, 60],
      ['2026-03', 0, 10, -10, 50],
    ])
  })
})

describe('spendingByCategory', () => {
  it('ranks expense categories and folds the tail', () => {
    const rows = spendingByCategory([tx('2026-01-01', -50, 'A'), tx('2026-01-01', -30, 'B'), tx('2026-01-01', -15, 'C'), tx('2026-01-01', -5, 'D'), tx('2026-01-01', 999, 'Salary')], 3)
    expect(rows.map((r) => [r.category, r.amount])).toEqual([
      ['A', 50],
      ['B', 30],
      ['Everything else', 20],
    ])
    expect(rows[0].share).toBeCloseTo(0.5)
  })
})

describe('budgetStatus', () => {
  it('flags near-limit and over-budget categories for the chosen ledger and month', () => {
    const budgets = [
      { id: '1', ledger: 'personal' as const, category: 'Dining', monthlyLimit: 100 },
      { id: '2', ledger: 'personal' as const, category: 'Groceries', monthlyLimit: 100 },
      { id: '3', ledger: 'personal' as const, category: 'Fun', monthlyLimit: 100 },
      { id: '4', ledger: 'business' as const, category: 'Dining', monthlyLimit: 100 },
    ]
    const txns = [
      tx('2026-05-02', -120, 'Dining'),
      tx('2026-05-03', -85, 'Groceries'),
      tx('2026-05-03', -10, 'Fun'),
      tx('2026-04-03', -500, 'Fun'),
      tx('2026-05-03', -500, 'Fun', 'business'),
    ]
    const rows = budgetStatus(budgets, txns, 'personal', '2026-05')
    expect(rows.map((r) => [r.budget.category, r.spent, r.state])).toEqual([
      ['Dining', 120, 'critical'],
      ['Groceries', 85, 'warning'],
      ['Fun', 10, 'good'],
    ])
  })
})

describe('portfolio', () => {
  it('computes value, gain and weights', () => {
    const p = portfolio([
      { id: 'a', symbol: 'A', name: 'A', shares: 10, costBasis: 10, price: 15 },
      { id: 'b', symbol: 'B', name: 'B', shares: 5, costBasis: 10, price: 10 },
    ])
    expect(p.value).toBe(200)
    expect(p.cost).toBe(150)
    expect(p.gain).toBe(50)
    expect(p.rows[0].symbol).toBe('A')
    expect(p.rows[0].weight).toBeCloseTo(0.75)
  })
})

describe('CSV', () => {
  it('parses amounts in common formats', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5)
    expect(parseAmount('(42.10)')).toBe(-42.1)
    expect(parseAmount('-7')).toBe(-7)
    expect(parseAmount('abc')).toBeNull()
  })
  it('normalises dates', () => {
    expect(normalizeDate('2026-3-7')).toBe('2026-03-07')
    expect(normalizeDate('03/07/2026')).toBe('2026-03-07')
    expect(normalizeDate('7 March')).toBeNull()
  })
  it('imports rows, including debit/credit files, and reports bad rows', () => {
    const csv = 'Date,Description,Category,Amount\n2026-01-02,Coffee,Dining,-4.50\nnot a date,Oops,Dining,-1\n01/15/2026,Pay,Salary,"$2,000"'
    const { transactions, errors } = parseTransactionsCsv(csv, 'business')
    expect(transactions.map((t) => [t.date, t.description, t.category, t.amount, t.ledger])).toEqual([
      ['2026-01-02', 'Coffee', 'Dining', -4.5, 'business'],
      ['2026-01-15', 'Pay', 'Salary', 2000, 'business'],
    ])
    expect(errors).toHaveLength(1)

    const bank = parseTransactionsCsv('date,payee,debit,credit\n2026-02-01,Store,12.00,\n2026-02-02,Refund,,5', 'personal')
    expect(bank.transactions.map((t) => [t.description, t.amount, t.category])).toEqual([
      ['Store', -12, 'Other'],
      ['Refund', 5, 'Other income'],
    ])
  })
  it('round-trips through export', () => {
    const original = [tx('2026-01-02', -4.5, 'Dining'), tx('2026-01-01', 100, 'Salary')]
    const { transactions } = parseTransactionsCsv(transactionsToCsv(original), 'personal')
    expect(transactions.map((t) => [t.date, t.category, t.amount])).toEqual([
      ['2026-01-01', 'Salary', 100],
      ['2026-01-02', 'Dining', -4.5],
    ])
  })
})
