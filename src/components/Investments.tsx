import { useState, type ChangeEvent, type FormEvent } from 'react'
import { fmt, newId, portfolio } from '../lib/finance'
import type { AppData, Holding } from '../lib/types'
import { Card, StatTile } from './ui'

export function Investments({ data, setData }: { data: AppData; setData: (fn: (d: AppData) => AppData) => void }) {
  const p = portfolio(data.holdings)

  function update(id: string, patch: Partial<Holding>) {
    setData((d) => ({ ...d, holdings: d.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)) }))
  }
  function remove(id: string) {
    setData((d) => ({ ...d, holdings: d.holdings.filter((h) => h.id !== id) }))
  }

  return (
    <div className="stack">
      <div className="grid kpis">
        <StatTile label="Portfolio value" value={fmt.moneyWhole(p.value)} note={`${p.rows.length} holdings`} />
        <StatTile label="Total invested" value={fmt.moneyWhole(p.cost)} note="Shares × average cost" />
        <StatTile label="Unrealised gain" value={fmt.moneyWhole(p.gain)} tone={p.gain >= 0 ? 'pos' : 'neg'} note={fmt.pct(p.gainPct)} />
        <StatTile
          label="Largest position"
          value={p.rows[0]?.symbol ?? '—'}
          note={p.rows[0] ? `${fmt.pct(p.rows[0].weight)} of portfolio` : undefined}
        />
      </div>

      <div className="stack">
        <Card title="Holdings" sub="Edit price or shares inline — prices are entered manually">
          {p.rows.length === 0 ? (
            <div className="empty">No holdings yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Shares</th>
                    <th className="num">Avg cost</th>
                    <th className="num">Price</th>
                    <th className="num">Value</th>
                    <th className="num">Gain</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((h) => (
                    <tr key={h.id}>
                      <td title={h.name}>
                        <strong style={{ fontWeight: 600 }}>{h.symbol}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.78rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.name}
                        </div>
                      </td>
                      <td className="num">
                        <NumInput value={h.shares} label={`${h.symbol} shares`} onChange={(v) => update(h.id, { shares: v })} />
                      </td>
                      <td className="num">{fmt.money(h.costBasis)}</td>
                      <td className="num">
                        <NumInput value={h.price} label={`${h.symbol} price`} onChange={(v) => update(h.id, { price: v })} />
                      </td>
                      <td className="num">{fmt.money(h.value)}</td>
                      <td className={`num ${h.gain >= 0 ? 'pos' : 'neg'}`}>
                        {fmt.money(h.gain)}
                        <div style={{ fontSize: '0.75rem' }}>{fmt.pct(h.gainPct)}</div>
                      </td>
                      <td>
                        <button className="btn ghost danger" onClick={() => remove(h.id)} aria-label={`Remove ${h.symbol}`}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Allocation" sub="Share of portfolio value">
          <div style={{ display: 'grid', gap: 10 }}>
            {p.rows.map((h) => (
              <div key={h.id} title={`${h.symbol}: ${fmt.money(h.value)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>{h.symbol}</span>
                  <span style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmt.pct(h.weight)}</span>
                </div>
                <div className="meter">
                  <span style={{ width: `${h.weight * 100}%`, background: 'var(--series-1)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Add a holding">
        <AddHolding onAdd={(h) => setData((d) => ({ ...d, holdings: [...d.holdings, h] }))} />
      </Card>
    </div>
  )
}

function NumInput({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
  return (
    <input
      className="input"
      style={{ width: 96, padding: '3px 6px', textAlign: 'right' }}
      type="number"
      min="0"
      step="any"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
    />
  )
}

function AddHolding({ onAdd }: { onAdd: (h: Holding) => void }) {
  const [f, setF] = useState({ symbol: '', name: '', shares: '', costBasis: '', price: '' })
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  function submit(e: FormEvent) {
    e.preventDefault()
    const shares = Number(f.shares)
    const costBasis = Number(f.costBasis)
    const price = f.price ? Number(f.price) : costBasis
    if (!f.symbol.trim() || !(shares > 0) || !(costBasis >= 0) || !(price >= 0)) return
    onAdd({ id: newId(), symbol: f.symbol.trim().toUpperCase(), name: f.name.trim() || f.symbol.trim().toUpperCase(), shares, costBasis, price })
    setF({ symbol: '', name: '', shares: '', costBasis: '', price: '' })
  }

  return (
    <form className="toolbar" style={{ marginBottom: 0 }} onSubmit={submit}>
      <input className="input" placeholder="Symbol" value={f.symbol} onChange={set('symbol')} aria-label="Symbol" required style={{ width: 100 }} />
      <input className="input" placeholder="Name (optional)" value={f.name} onChange={set('name')} aria-label="Name" />
      <input className="input" type="number" step="any" min="0" placeholder="Shares" value={f.shares} onChange={set('shares')} aria-label="Shares" required style={{ width: 110 }} />
      <input className="input" type="number" step="any" min="0" placeholder="Avg cost" value={f.costBasis} onChange={set('costBasis')} aria-label="Average cost" required style={{ width: 110 }} />
      <input className="input" type="number" step="any" min="0" placeholder="Price" value={f.price} onChange={set('price')} aria-label="Current price" style={{ width: 110 }} />
      <button className="btn primary" type="submit">
        Add holding
      </button>
    </form>
  )
}
