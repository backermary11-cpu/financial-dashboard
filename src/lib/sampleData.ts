import { currentMonthKey, lastMonths, newId, round2 } from './finance'
import type { AppData, Ledger, Transaction } from './types'

/** Small deterministic PRNG so sample data looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

interface Recurring {
  day: number
  description: string
  category: string
  base: number
  jitter: number
}

const PERSONAL: Recurring[] = [
  { day: 1, description: 'Paycheck', category: 'Salary', base: 3100, jitter: 0 },
  { day: 15, description: 'Paycheck', category: 'Salary', base: 3100, jitter: 0 },
  { day: 20, description: 'Side project client', category: 'Freelance', base: 650, jitter: 400 },
  { day: 2, description: 'Rent', category: 'Housing', base: -1850, jitter: 0 },
  { day: 5, description: 'Electric & water', category: 'Utilities', base: -160, jitter: 45 },
  { day: 6, description: 'Internet & phone', category: 'Utilities', base: -115, jitter: 0 },
  { day: 4, description: 'Supermarket', category: 'Groceries', base: -140, jitter: 40 },
  { day: 11, description: 'Supermarket', category: 'Groceries', base: -125, jitter: 45 },
  { day: 18, description: 'Supermarket', category: 'Groceries', base: -150, jitter: 40 },
  { day: 25, description: 'Farmers market', category: 'Groceries', base: -60, jitter: 25 },
  { day: 8, description: 'Restaurant', category: 'Dining', base: -70, jitter: 35 },
  { day: 22, description: 'Takeout', category: 'Dining', base: -45, jitter: 20 },
  { day: 3, description: 'Transit pass', category: 'Transport', base: -95, jitter: 0 },
  { day: 17, description: 'Gas', category: 'Transport', base: -55, jitter: 20 },
  { day: 12, description: 'Gym membership', category: 'Health', base: -49, jitter: 0 },
  { day: 14, description: 'Streaming services', category: 'Entertainment', base: -32, jitter: 0 },
  { day: 23, description: 'Concert tickets', category: 'Entertainment', base: -60, jitter: 55 },
  { day: 19, description: 'Online order', category: 'Shopping', base: -120, jitter: 90 },
]

const BUSINESS: Recurring[] = [
  { day: 3, description: 'Client retainer — Northwind', category: 'Services', base: 6500, jitter: 0 },
  { day: 10, description: 'Online store sales', category: 'Sales', base: 4200, jitter: 1800 },
  { day: 24, description: 'Online store sales', category: 'Sales', base: 3900, jitter: 1600 },
  { day: 28, description: 'Contractor payout', category: 'Payroll', base: -4800, jitter: 0 },
  { day: 1, description: 'Coworking desk', category: 'Office', base: -450, jitter: 0 },
  { day: 7, description: 'SaaS subscriptions', category: 'Software', base: -310, jitter: 30 },
  { day: 12, description: 'Ad campaign', category: 'Marketing', base: -900, jitter: 500 },
  { day: 16, description: 'Shipping & fulfilment', category: 'Transport', base: -620, jitter: 200 },
  { day: 26, description: 'Estimated tax set-aside', category: 'Taxes', base: -1500, jitter: 0 },
]

function generate(ledger: Ledger, plan: Recurring[], months: string[], seed: number): Transaction[] {
  const rand = rng(seed)
  const today = new Date().toISOString().slice(0, 10)
  const out: Transaction[] = []
  for (const month of months) {
    for (const r of plan) {
      const date = `${month}-${String(r.day).padStart(2, '0')}`
      if (date > today) continue
      out.push({
        id: newId(),
        ledger,
        date,
        description: r.description,
        category: r.category,
        amount: round2(r.base + (rand() * 2 - 1) * r.jitter * Math.sign(r.base || 1)),
      })
    }
  }
  return out
}

export function sampleData(): AppData {
  const months = lastMonths(currentMonthKey(), 12)
  return {
    transactions: [...generate('personal', PERSONAL, months, 42), ...generate('business', BUSINESS, months, 7)],
    budgets: [
      { id: newId(), ledger: 'personal', category: 'Groceries', monthlyLimit: 500 },
      { id: newId(), ledger: 'personal', category: 'Dining', monthlyLimit: 150 },
      { id: newId(), ledger: 'personal', category: 'Entertainment', monthlyLimit: 100 },
      { id: newId(), ledger: 'personal', category: 'Shopping', monthlyLimit: 200 },
      { id: newId(), ledger: 'personal', category: 'Transport', monthlyLimit: 160 },
      { id: newId(), ledger: 'business', category: 'Marketing', monthlyLimit: 1200 },
      { id: newId(), ledger: 'business', category: 'Software', monthlyLimit: 350 },
      { id: newId(), ledger: 'business', category: 'Transport', monthlyLimit: 700 },
    ],
    holdings: [
      { id: newId(), symbol: 'VTI', name: 'Total US Stock Market ETF', shares: 42, costBasis: 228.4, price: 301.15 },
      { id: newId(), symbol: 'VXUS', name: 'Total International Stock ETF', shares: 60, costBasis: 57.9, price: 68.2 },
      { id: newId(), symbol: 'BND', name: 'Total Bond Market ETF', shares: 55, costBasis: 74.1, price: 73.45 },
      { id: newId(), symbol: 'AAPL', name: 'Apple Inc.', shares: 12, costBasis: 168.0, price: 231.4 },
      { id: newId(), symbol: 'CASH', name: 'High-yield savings', shares: 1, costBasis: 8000, price: 8000 },
    ],
  }
}
