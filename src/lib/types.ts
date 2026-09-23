export type Ledger = 'personal' | 'business'

export interface Transaction {
  id: string
  ledger: Ledger
  /** ISO date, YYYY-MM-DD */
  date: string
  description: string
  category: string
  /** Positive = income, negative = expense */
  amount: number
}

export interface Budget {
  id: string
  ledger: Ledger
  category: string
  monthlyLimit: number
}

export interface Holding {
  id: string
  symbol: string
  name: string
  shares: number
  /** Average cost per share */
  costBasis: number
  /** Current price per share (entered manually) */
  price: number
}

export interface AppData {
  transactions: Transaction[]
  budgets: Budget[]
  holdings: Holding[]
}
