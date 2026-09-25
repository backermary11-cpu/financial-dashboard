import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountSync } from './sync'
import type { AppData, Transaction } from './types'

/** In-memory stand-in for the artifact `db` capability. */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>()
  const writes: string[] = []
  const docListeners = new Map<string, Set<() => void>>()
  const collListeners = new Map<string, Set<() => void>>()
  const notify = (path: string) => {
    docListeners.get(path)?.forEach((f) => f())
    collListeners.get(path.slice(0, path.lastIndexOf('/')))?.forEach((f) => f())
  }
  const snap = (path: string) => ({
    id: path.split('/').pop()!,
    exists: docs.has(path),
    data: () => docs.get(path),
  })
  const doc = (path: string): unknown => ({
    get: async () => snap(path),
    set: async (d: Record<string, unknown>) => {
      writes.push(`set ${path}`)
      docs.set(path, JSON.parse(JSON.stringify(d)))
      notify(path)
    },
    delete: async () => {
      writes.push(`delete ${path}`)
      docs.delete(path)
      notify(path)
    },
    onSnapshot: (next: (s: unknown) => void) => {
      const f = () => next(snap(path))
      if (!docListeners.has(path)) docListeners.set(path, new Set())
      docListeners.get(path)!.add(f)
      f()
      return () => docListeners.get(path)!.delete(f)
    },
    collection: (sub: string) => coll(`${path}/${sub}`),
  })
  const coll = (path: string) => ({
    doc: (id: string) => doc(`${path}/${id}`),
    onSnapshot: (next: (s: unknown) => void) => {
      const f = () =>
        next({ docs: [...docs.keys()].filter((k) => k.slice(0, k.lastIndexOf('/')) === path).sort().map(snap) })
      if (!collListeners.has(path)) collListeners.set(path, new Set())
      collListeners.get(path)!.add(f)
      f()
      return () => collListeners.get(path)!.delete(f)
    },
  })
  return { docs, writes, db: { doc } }
}

const tx = (id: string, date: string, amount: number): Transaction => ({
  id,
  ledger: 'personal',
  date,
  description: id,
  category: 'Other',
  amount,
})

async function setup(local: AppData, store = fakeDb()) {
  vi.stubGlobal('window', {
    claude: {
      use: async (name: string) => (name === 'db' ? store.db : { id: async () => 'u_me' }),
    },
  })
  const remote: AppData[] = []
  const statuses: string[] = []
  const sync = new AccountSync({ onRemote: (d) => remote.push(d), onStatus: (s) => statuses.push(s) })
  await sync.start(() => local)
  return { sync, store, remote, statuses }
}

const flushTimers = async () => {
  await vi.advanceTimersByTimeAsync(1000)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AccountSync', () => {
  const local: AppData = {
    transactions: [tx('a', '2026-08-03', -10), tx('b', '2026-09-01', 100)],
    budgets: [{ id: 'b1', ledger: 'personal', category: 'Dining', monthlyLimit: 100 }],
    holdings: [],
  }

  it('uploads browser data on first use, one document per month', async () => {
    const { store, statuses, remote } = await setup(local)
    expect(store.writes).toEqual([
      'set data/users/u_me/finance/months/2026-08',
      'set data/users/u_me/finance/months/2026-09',
      'set data/users/u_me/finance',
    ])
    expect(statuses.at(-1)).toBe('synced')
    expect(remote.at(-1)?.transactions.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('loads existing account data instead of uploading', async () => {
    const store = fakeDb()
    store.docs.set('data/users/u_me/finance', { budgets: [], holdings: [] })
    store.docs.set('data/users/u_me/finance/months/2026-01', { transactions: [tx('z', '2026-01-05', 5)] })
    const { remote } = await setup(local, store)
    expect(store.writes).toEqual([])
    expect(remote.at(-1)?.transactions.map((t) => t.id)).toEqual(['z'])
  })

  it('writes only the months that changed, and deletes emptied months', async () => {
    vi.useFakeTimers()
    const { sync, store } = await setup(local)
    store.writes.length = 0

    sync.schedule({ ...local, transactions: [local.transactions[0], tx('b', '2026-09-01', 150)] })
    await flushTimers()
    expect(store.writes).toEqual(['set data/users/u_me/finance/months/2026-09'])

    store.writes.length = 0
    sync.schedule({ ...local, transactions: [tx('b', '2026-09-01', 150)] })
    await flushTimers()
    expect(store.writes).toEqual(['delete data/users/u_me/finance/months/2026-08'])
  })

  it('applies changes made on another device', async () => {
    const { store, remote } = await setup(local)
    await (store.db.doc('data/users/u_me/finance/months/2026-10') as { set: (d: unknown) => Promise<void> }).set({
      transactions: [tx('c', '2026-10-02', -3)],
    })
    expect(remote.at(-1)?.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps unsaved local edits when a remote update arrives mid-debounce', async () => {
    vi.useFakeTimers()
    const { sync, store, remote } = await setup(local)
    const before = remote.length
    sync.schedule({ ...local, holdings: [{ id: 'h', symbol: 'X', name: 'X', shares: 1, costBasis: 1, price: 1 }] })
    await (store.db.doc('data/users/u_me/finance/months/2026-10') as { set: (d: unknown) => Promise<void> }).set({
      transactions: [],
    })
    expect(remote.length).toBe(before)
    await flushTimers()
    expect((store.docs.get('data/users/u_me/finance') as { holdings: unknown[] }).holdings).toHaveLength(1)
  })

  it('stays local-only without an account', async () => {
    vi.stubGlobal('window', { claude: { use: async () => null } })
    const statuses: string[] = []
    await new AccountSync({ onRemote: () => {}, onStatus: (s) => statuses.push(s) }).start(() => local)
    expect(statuses).toEqual(['local'])
  })
})
