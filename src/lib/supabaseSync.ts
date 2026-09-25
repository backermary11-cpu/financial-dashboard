import type { AppData } from './types'

type Status = 'synced' | 'saving' | 'error'

/** The slice of the Supabase client this module uses (kept small so tests can fake it). */
export interface SupabaseLike {
  from(table: string): {
    select(cols: string): {
      eq(col: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { data: unknown } | null; error: unknown }>
      }
    }
    upsert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>
  }
  channel(name: string): RealtimeChannelLike
  removeChannel(channel: RealtimeChannelLike): unknown
}
interface RealtimeChannelLike {
  on(
    type: 'postgres_changes',
    filter: Record<string, string>,
    callback: (payload: { new?: { data?: unknown } }) => void,
  ): RealtimeChannelLike
  subscribe(): RealtimeChannelLike
}

export const TABLE = 'finance_data'
const DEBOUNCE_MS = 800

function normalize(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>
  return { transactions: d.transactions ?? [], budgets: d.budgets ?? [], holdings: d.holdings ?? [] }
}

/**
 * Syncs the whole app state as one JSON row per user in `finance_data`
 * (row-level security limits each user to their own row). Unsaved local
 * edits win over incoming changes; failed saves (e.g. offline) are retried
 * when the connection comes back or on the next edit.
 */
export class SupabaseSync {
  private client: SupabaseLike
  private userId: string
  private cb: { onRemote: (d: AppData) => void; onStatus: (s: Status) => void }
  private lastJson: string | null = null
  private pending: AppData | null = null
  private writing = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private channel: RealtimeChannelLike | null = null
  private stopped = false
  private readonly onOnline = () => void this.flush()
  private readonly onFocus = () => void this.refresh()
  private readonly onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush()
    else void this.refresh()
  }

  constructor(client: SupabaseLike, userId: string, cb: SupabaseSync['cb']) {
    this.client = client
    this.userId = userId
    this.cb = cb
  }

  async start(getLocal: () => AppData) {
    const { data, error } = await this.fetch()
    if (this.stopped) return
    if (error) return this.cb.onStatus('error')
    if (!data) {
      // First sign-in: upload what this device has.
      this.pending = getLocal()
      await this.flush()
    } else {
      this.lastJson = JSON.stringify(data.data)
      this.cb.onRemote(normalize(data.data))
      this.cb.onStatus('synced')
    }
    if (this.stopped) return
    this.channel = this.client
      .channel(`finance-${this.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${this.userId}` }, (payload) =>
        this.apply(payload.new?.data),
      )
      .subscribe()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline)
      window.addEventListener('focus', this.onFocus)
      document.addEventListener('visibilitychange', this.onHide)
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    if (this.channel) this.client.removeChannel(this.channel)
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline)
      window.removeEventListener('focus', this.onFocus)
      document.removeEventListener('visibilitychange', this.onHide)
    }
  }

  schedule(data: AppData) {
    this.pending = data
    this.cb.onStatus('saving')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  /** Re-read the row (covers projects where realtime is not enabled). */
  async refresh() {
    if (this.pending || this.writing || this.stopped) return
    const { data, error } = await this.fetch()
    if (!error && data) this.apply(data.data)
  }

  private fetch() {
    return this.client.from(TABLE).select('data').eq('user_id', this.userId).maybeSingle()
  }

  private apply(raw: unknown) {
    if (raw === undefined || this.stopped) return
    const json = JSON.stringify(raw)
    if (json === this.lastJson) return
    this.lastJson = json
    if (!this.pending && !this.writing) this.cb.onRemote(normalize(raw))
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writing || !this.pending || this.stopped) return
    this.writing = true
    const target = this.pending
    this.pending = null
    const json = JSON.stringify(target)
    const { error } = await this.client
      .from(TABLE)
      .upsert({ user_id: this.userId, data: target, updated_at: new Date().toISOString() })
    this.writing = false
    if (error) {
      this.pending = this.pending ?? target
      this.cb.onStatus('error')
      return
    }
    this.lastJson = json
    if (this.pending) return void this.flush()
    this.cb.onStatus('synced')
  }
}
