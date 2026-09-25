import { useCallback, useEffect, useRef, useState } from 'react'
import { sampleData } from './sampleData'
import { AccountSync } from './sync'
import type { AppData } from './types'

const KEY = 'financial-dashboard:v1'

function loadLocal(): AppData {
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

function saveLocal(data: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Private mode / quota: keep working in memory.
  }
}

/**
 * - `local`: saved in this browser only (e.g. when self-hosted).
 * - `connecting`: checking for an account to sync with.
 * - `synced` / `saving`: data lives in the viewer's claude.ai account.
 * - `error`: account sync failed; changes are kept in this browser.
 */
export type SyncStatus = 'local' | 'connecting' | 'synced' | 'saving' | 'error'

/**
 * App state. Always cached in localStorage; when the page runs as a claude.ai
 * artifact it is also synced to the viewer's private account storage so it
 * follows them across browsers and devices.
 */
export function useAppData() {
  const [data, setDataState] = useState<AppData>(loadLocal)
  const [status, setStatus] = useState<SyncStatus>(() => (hasClaudeRuntime() ? 'connecting' : 'local'))
  const syncRef = useRef<AccountSync | null>(null)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
    saveLocal(data)
  }, [data])

  useEffect(() => {
    if (!hasClaudeRuntime()) return
    let cancelled = false
    const sync = new AccountSync({
      onRemote: (remote) => {
        if (!cancelled) setDataState(remote)
      },
      onStatus: (s) => {
        if (!cancelled) setStatus(s)
      },
    })
    syncRef.current = sync
    void sync.start(() => dataRef.current)
    return () => {
      cancelled = true
      sync.stop()
      syncRef.current = null
    }
  }, [])

  const setData = useCallback((next: AppData | ((d: AppData) => AppData)) => {
    setDataState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      syncRef.current?.schedule(value)
      return value
    })
  }, [])

  return [data, setData, status] as const
}

function hasClaudeRuntime(): boolean {
  return typeof window !== 'undefined' && typeof (window as { claude?: { use?: unknown } }).claude?.use === 'function'
}
