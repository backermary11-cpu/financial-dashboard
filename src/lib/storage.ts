import { useCallback, useEffect, useRef, useState } from 'react'
import { sampleData } from './sampleData'
import { supabase } from './supabase'
import { SupabaseSync, type SupabaseLike } from './supabaseSync'
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
 * - `local`: saved on this device only.
 * - `connecting`: checking for an account to sync with.
 * - `synced` / `saving`: data lives in the viewer's account (claude.ai or Supabase).
 * - `error`: sync failed (e.g. offline); changes are kept on this device and retried.
 */
export type SyncStatus = 'local' | 'connecting' | 'synced' | 'saving' | 'error'

interface SyncEngine {
  start(getLocal: () => AppData): Promise<void>
  stop(): void
  schedule(data: AppData): void
}

/**
 * App state. Always cached in localStorage, and synced to an account when one
 * is available: the viewer's claude.ai storage when running as an artifact,
 * otherwise the signed-in Supabase user (`supabaseUserId`).
 */
export function useAppData(supabaseUserId: string | null = null) {
  const [data, setDataState] = useState<AppData>(loadLocal)
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const syncing = hasClaudeRuntime() || !!(supabase && supabaseUserId)
  const syncRef = useRef<SyncEngine | null>(null)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
    saveLocal(data)
  }, [data])

  useEffect(() => {
    const claude = hasClaudeRuntime()
    if (!claude && !(supabase && supabaseUserId)) return
    let cancelled = false
    const cb = {
      onRemote: (remote: AppData) => {
        if (!cancelled) setDataState(remote)
      },
      onStatus: (s: SyncStatus) => {
        if (!cancelled) setStatus(s)
      },
    }
    const sync: SyncEngine = claude
      ? new AccountSync(cb)
      : new SupabaseSync(supabase as unknown as SupabaseLike, supabaseUserId!, cb)
    syncRef.current = sync
    void sync.start(() => dataRef.current)
    return () => {
      cancelled = true
      sync.stop()
      syncRef.current = null
      setStatus('connecting')
    }
  }, [supabaseUserId])

  const setData = useCallback((next: AppData | ((d: AppData) => AppData)) => {
    setDataState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      syncRef.current?.schedule(value)
      return value
    })
  }, [])

  return [data, setData, syncing ? status : ('local' as SyncStatus)] as const
}

export function hasClaudeRuntime(): boolean {
  return typeof window !== 'undefined' && typeof (window as { claude?: { use?: unknown } }).claude?.use === 'function'
}
