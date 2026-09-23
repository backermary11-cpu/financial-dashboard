import type { ReactNode } from 'react'
import type { BudgetState } from '../lib/finance'
import { fmt } from '../lib/finance'
import { STATUS_COLOR } from '../lib/ui-helpers'

export function StatTile({ label, value, note, tone }: { label: string; value: string; note?: ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  )
}

export function Card({ title, sub, children, actions }: { title: string; sub?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
}

/** Shared hover tooltip for Recharts charts. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = fmt.money,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  format?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="t">{label}</div>
      {payload.map((p) => (
        <div className="r" key={String(p.dataKey)}>
          <span>
            <span className="swatch" style={{ background: p.color }} />
            {p.name}
          </span>
          <span>{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

const STATUS_LABEL: Record<BudgetState, string> = { good: 'On track', warning: 'Near limit', critical: 'Over budget' }

/** Status is always icon + label, never color alone. */
export function StatusBadge({ state }: { state: BudgetState }) {
  return (
    <span className="status">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill={STATUS_COLOR[state]} />
        {state === 'good' && <path d="M4.8 8.2l2.1 2.1 4.3-4.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
        {state === 'warning' && <path d="M8 4.2v4.6M8 11.2v.4" stroke="#1a1a19" strokeWidth="1.9" strokeLinecap="round" />}
        {state === 'critical' && <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
      {STATUS_LABEL[state]}
    </span>
  )
}
