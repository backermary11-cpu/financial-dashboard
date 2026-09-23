import type { BudgetState } from './finance'

export const STATUS_COLOR: Record<BudgetState, string> = { good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)' }

export function statusColor(state: BudgetState) {
  return STATUS_COLOR[state]
}

/** False in the claude.ai preview build, where the host blocks file downloads. */
export const canDownload = import.meta.env.VITE_NO_DOWNLOADS !== '1'

export function download(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
