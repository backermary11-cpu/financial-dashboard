import { monthKey } from './finance'
import type { AppData, Budget, Holding, Transaction } from './types'

// Minimal shapes of the claude.ai artifact runtime we use (db + user capabilities).
interface DocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface QuerySnap {
  docs: DocSnap[]
}
interface DocRef {
  get(): Promise<DocSnap>
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (s: DocSnap) => void, error?: (e: { code: string }) => void): () => void
  collection(path: string): CollRef
}
interface CollRef {
  doc(id: string): DocRef
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string }) => void): () => void
}
interface Db {
  doc(path: string): DocRef
}
interface User {
  id(): Promise<string | null>
}
interface ClaudeRuntime {
  use(name: 'db'): Promise<Db | null>
  use(name: 'user'): Promise<User | null>
}

type Status = 'local' | 'synced' | 'saving' | 'error'

const DEBOUNCE_MS = 600

/** Groups transactions into per-month buckets, the unit stored remotely. */
export function bucketByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const out = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const k = monthKey(t.date)
    const list = out.get(k)
    if (list) list.push(t)
    else out.set(k, [t])
  }
  return out
}

/**
 * Syncs app data to the viewer's private account storage:
 *   data/users/<id>/finance                 -> { budgets, holdings }
 *   data/users/<id>/finance/months/<YYYY-MM> -> { transactions }
 * Only documents that changed are written. Local edits win until they are saved;
 * after that, remote snapshots (e.g. from another device) replace local state.
 */
export class AccountSync {
  private meta: DocRef | null = null
  private months: CollRef | null = null
  /** Last known remote body per document key ("meta" or "m:<month>"), as JSON. */
  private remote = new Map<string, string>()
  private remoteMeta: { budgets: Budget[]; holdings: Holding[] } | null = null
  private remoteMonths = new Map<string, Transaction[]>()
  private pending: AppData | null = null
  private writing = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private unsubs: (() => void)[] = []
  private stopped = false
  private readonly onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush()
  }

  private cb: { onRemote: (d: AppData) => void; onStatus: (s: Status) => void }

  constructor(cb: { onRemote: (d: AppData) => void; onStatus: (s: Status) => void }) {
    this.cb = cb
  }

  async start(getLocal: () => AppData) {
    const claude = (window as unknown as { claude: ClaudeRuntime }).claude
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')])
    const uid = user ? await user.id() : null
    if (this.stopped) return
    if (!db || !uid) return this.cb.onStatus('local')

    this.meta = db.doc(`data/users/${uid}/finance`)
    this.months = this.meta.collection('months')
    try {
      const existing = await this.meta.get()
      if (this.stopped) return
      if (!existing.exists) {
        // First time on this account: upload what this browser has.
        this.pending = getLocal()
        await this.flush()
      }
      this.subscribe()
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onHide)
      this.cb.onStatus('synced')
    } catch {
      this.cb.onStatus('error')
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onHide)
  }

  /** Queue a save of the full app state; writes are debounced and diffed. */
  schedule(data: AppData) {
    if (!this.meta) return
    this.pending = data
    this.cb.onStatus('saving')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  private subscribe() {
    const onError = () => this.cb.onStatus('error')
    this.unsubs.push(
      this.meta!.onSnapshot((snap) => {
        if (!snap.exists) return
        const body = clone(snap.data()) as { budgets?: Budget[]; holdings?: Holding[] }
        this.remoteMeta = { budgets: body.budgets ?? [], holdings: body.holdings ?? [] }
        this.remote.set('meta', JSON.stringify(this.remoteMeta))
        this.emit()
      }, onError),
      this.months!.onSnapshot((snap) => {
        const next = new Map<string, Transaction[]>()
        for (const d of snap.docs) {
          const txns = ((clone(d.data()) as { transactions?: Transaction[] }).transactions ?? [])
          next.set(d.id, txns)
        }
        for (const key of [...this.remote.keys()]) if (key.startsWith('m:') && !next.has(key.slice(2))) this.remote.delete(key)
        for (const [k, txns] of next) this.remote.set(`m:${k}`, JSON.stringify({ transactions: txns }))
        this.remoteMonths = next
        this.emit()
      }, onError),
    )
  }

  /** Push remote state into the app unless local edits are still unsaved. */
  private emit() {
    if (this.pending || this.writing || !this.remoteMeta) return
    const transactions = [...this.remoteMonths.values()].flat().sort((a, b) => a.date.localeCompare(b.date))
    this.cb.onRemote({ transactions, budgets: this.remoteMeta.budgets, holdings: this.remoteMeta.holdings })
  }

  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writing || !this.pending || !this.meta || !this.months) return
    this.writing = true
    const target = this.pending
    this.pending = null
    try {
      const buckets = bucketByMonth(target.transactions)
      for (const [k, transactions] of buckets) {
        const json = JSON.stringify({ transactions })
        if (this.remote.get(`m:${k}`) === json) continue
        await this.months.doc(k).set({ transactions })
        this.remote.set(`m:${k}`, json)
      }
      for (const key of [...this.remote.keys()]) {
        if (!key.startsWith('m:') || buckets.has(key.slice(2))) continue
        await this.months.doc(key.slice(2)).delete()
        this.remote.delete(key)
      }
      const meta = { budgets: target.budgets, holdings: target.holdings }
      const metaJson = JSON.stringify(meta)
      if (this.remote.get('meta') !== metaJson) {
        await this.meta.set(meta)
        this.remote.set('meta', metaJson)
      }
      this.writing = false
      if (this.pending) return void this.flush()
      this.cb.onStatus('synced')
    } catch {
      this.writing = false
      // Keep the unsaved state so the next edit retries it.
      this.pending = this.pending ?? target
      this.cb.onStatus('error')
    }
  }
}

function clone(v: unknown): Record<string, unknown> {
  return v ? (JSON.parse(JSON.stringify(v)) as Record<string, unknown>) : {}
}
