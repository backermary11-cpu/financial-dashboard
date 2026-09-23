import type { BudgetState } from './finance'

export const STATUS_COLOR: Record<BudgetState, string> = { good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)' }

export function statusColor(state: BudgetState) {
  return STATUS_COLOR[state]
}

export function download(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
