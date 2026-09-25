import { afterEach, describe, expect, it, vi } from 'vitest'
import { SupabaseSync, type SupabaseLike } from './supabaseSync'
import type { AppData } from './types'

/** Fake Supabase client: one table, a realtime channel we can fire, optional failing writes. */
function fakeClient(initial?: unknown) {
  const rows = new Map<string, unknown>()
  if (initial !== undefined) rows.set('u1', initial)
  const upserts: unknown[] = []
  let realtime: ((p: { new?: { data?: unknown } }) => void) | null = null
  const state = { failWrites: false }
  const client: SupabaseLike = {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: rows.has(id) ? { data: rows.get(id) } : null, error: null }),
        }),
      }),
      upsert: async (row) => {
        if (state.failWrites) return { error: new Error('offline') }
        upserts.push(row.data)
        rows.set(row.user_id as string, JSON.parse(JSON.stringify(row.data)))
        return { error: null }
      },
    }),
    channel: () => {
      const ch = {
        on: (_t: string, _f: Record<string, string>, cb: typeof realtime) => {
          realtime = cb
          return ch
        },
        subscribe: () => ch,
      }
      return ch as never
    },
    removeChannel: () => {},
  }
  return { client, rows, upserts, state, fire: (data: unknown) => realtime?.({ new: { data } }) }
}

const local: AppData = {
  transactions: [{ id: 't', ledger: 'personal', date: '2026-09-01', description: 'Pay', category: 'Salary', amount: 100 }],
  budgets: [],
  holdings: [],
}

async function start(fake: ReturnType<typeof fakeClient>) {
  const remote: AppData[] = []
  const statuses: string[] = []
  const sync = new SupabaseSync(fake.client, 'u1', { onRemote: (d) => remote.push(d), onStatus: (s) => statuses.push(s) })
  await sync.start(() => local)
  return { sync, remote, statuses }
}

afterEach(() => vi.useRealTimers())

describe('SupabaseSync', () => {
  it('uploads this device’s data on first sign-in', async () => {
    const fake = fakeClient()
    const { statuses } = await start(fake)
    expect(fake.upserts).toEqual([local])
    expect(statuses.at(-1)).toBe('synced')
  })

  it('loads the account’s data when it already exists', async () => {
    const fake = fakeClient({ transactions: [], budgets: [{ id: 'b', ledger: 'personal', category: 'Dining', monthlyLimit: 5 }] })
    const { remote } = await start(fake)
    expect(fake.upserts).toEqual([])
    expect(remote.at(-1)?.budgets).toHaveLength(1)
    expect(remote.at(-1)?.holdings).toEqual([])
  })

  it('debounces saves into one write', async () => {
    vi.useFakeTimers()
    const fake = fakeClient({ transactions: [], budgets: [], holdings: [] })
    const { sync } = await start(fake)
    sync.schedule({ ...local, budgets: [] })
    sync.schedule(local)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fake.upserts).toEqual([local])
  })

  it('applies changes from another device, but not over unsaved local edits', async () => {
    vi.useFakeTimers()
    const fake = fakeClient({ transactions: [], budgets: [], holdings: [] })
    const { sync, remote } = await start(fake)
    fake.fire({ transactions: local.transactions, budgets: [], holdings: [] })
    expect(remote.at(-1)?.transactions).toHaveLength(1)

    const n = remote.length
    sync.schedule(local)
    fake.fire({ transactions: [], budgets: [], holdings: [] })
    expect(remote.length).toBe(n)
  })

  it('keeps failed saves and retries them', async () => {
    vi.useFakeTimers()
    const fake = fakeClient({ transactions: [], budgets: [], holdings: [] })
    const { sync, statuses } = await start(fake)
    fake.state.failWrites = true
    sync.schedule(local)
    await vi.advanceTimersByTimeAsync(1000)
    expect(statuses.at(-1)).toBe('error')

    fake.state.failWrites = false
    await sync.flush()
    expect(fake.upserts).toEqual([local])
    expect(statuses.at(-1)).toBe('synced')
  })
})
