import { useEffect, useState } from 'react'
import { Budgets } from './components/Budgets'
import { Dashboard } from './components/Dashboard'
import { Investments } from './components/Investments'
import { Transactions } from './components/Transactions'
import { download } from './lib/ui-helpers'
import { sampleData } from './lib/sampleData'
import { useAppData } from './lib/storage'
import type { Ledger } from './lib/types'

type Tab = 'dashboard' | 'transactions' | 'budgets' | 'investments'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'investments', label: 'Investments' },
]
type Theme = 'system' | 'light' | 'dark'

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export default function App() {
  const [data, setData] = useAppData()
  const [tab, setTab] = useState<Tab>(() => readPref<Tab>('fd:tab', 'dashboard'))
  const [ledger, setLedger] = useState<Ledger>(() => readPref<Ledger>('fd:ledger', 'personal'))
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>('fd:theme', 'system'))

  useEffect(() => writePref('fd:tab', tab), [tab])
  useEffect(() => writePref('fd:ledger', ledger), [ledger])
  useEffect(() => {
    writePref('fd:theme', theme)
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function exportAll() {
    download(`financial-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  }
  function resetSample() {
    if (confirm('Replace all your data with the sample data? Export a backup first if you want to keep it.')) setData(sampleData())
  }
  function clearAll() {
    if (confirm('Delete all transactions, budgets and holdings from this browser?')) setData({ transactions: [], budgets: [], holdings: [] })
  }
  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.transactions)) throw new Error('missing transactions')
      setData({ transactions: parsed.transactions, budgets: parsed.budgets ?? [], holdings: parsed.holdings ?? [] })
    } catch {
      alert('That file is not a Financial Dashboard backup.')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" />
          Financial Dashboard
        </div>
        {tab !== 'investments' && (
          <div className="segmented" role="group" aria-label="Ledger">
            <button aria-pressed={ledger === 'personal'} onClick={() => setLedger('personal')}>
              Personal
            </button>
            <button aria-pressed={ledger === 'business'} onClick={() => setLedger('business')}>
              Business
            </button>
          </div>
        )}
        <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Theme">
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'dashboard' && <Dashboard data={data} ledger={ledger} onGoTo={setTab} />}
        {tab === 'transactions' && <Transactions data={data} ledger={ledger} setData={setData} />}
        {tab === 'budgets' && <Budgets data={data} ledger={ledger} setData={setData} />}
        {tab === 'investments' && <Investments data={data} setData={setData} />}
      </main>

      <footer className="footer">
        <span>Data is stored only in this browser.</span>
        <button className="btn ghost" onClick={exportAll}>
          Back up (JSON)
        </button>
        <label className="btn ghost">
          Restore backup
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importBackup(f)
              e.target.value = ''
            }}
          />
        </label>
        <button className="btn ghost" onClick={resetSample}>
          Load sample data
        </button>
        <button className="btn ghost danger" onClick={clearAll}>
          Clear all data
        </button>
      </footer>
    </div>
  )
}
