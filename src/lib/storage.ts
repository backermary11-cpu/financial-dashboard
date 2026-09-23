import { useEffect, useState } from 'react'
import { sampleData } from './sampleData'
import type { AppData } from './types'

const KEY = 'financial-dashboard:v1'

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<AppData>
      return { transactions: data.transactions ?? [], budgets: data.budgets ?? [], holdings: data.holdings ?? [] }
    }
  } catch {
    // Storage unavailable or corrupt: fall through to sample data.
  }
  return sampleData()
}

/** App state persisted to this browser's localStorage. */
export function useAppData() {
  const [data, setData] = useState<AppData>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // Private mode / quota: keep working in memory.
    }
  }, [data])
  return [data, setData] as const
}
