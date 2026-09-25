import { useEffect, useState } from 'react'
import { Budgets } from './components/Budgets'
import { Dashboard } from './components/Dashboard'
import { Investments } from './components/Investments'
import { Transactions } from './components/Transactions'
import logo from './assets/logo.svg'
import { canDownload, download } from './lib/ui-helpers'
import { sampleData } from './lib/sampleData'
import { hasClaudeRuntime, useAppData, type SyncStatus } from './lib/storage'
import { supabase, useSession } from './lib/supabase'
import { Account } from './components/Account'
import { InstallButton } from './components/InstallButton'
import type { Ledger } from './lib/types'

type Tab = 'dashboard' | 'transactions' | 'budgets' | 'investments'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'investments', label: 'Investments' },
]
type Theme = 'system' | 'light' | 'dark'

const SYNC_LABEL: Record<SyncStatus, string> = {
  connecting: 'Connecting…',
  synced: 'Synced to your account',
  saving: 'Saving…',
  local: 'Saved on this device',
  error: 'Not synced — saved on this device',
}
const SYNC_HINT: Record<SyncStatus, string> = {
  connecting: 'Looking for your saved data.',
  synced: 'Your data is saved privately to your account and appears on every device where you use it.',
  saving: 'Saving your changes to your account.',
  local: 'Your data is stored only on this device.',
  error: 'Could not reach your account. Changes are kept in this browser and will sync after your next edit.',
}

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
  const { session, ready: sessionReady } = useSession()
  const [data, setData, syncStatus] = useAppData(session?.user.id ?? null)
  const accountsEnabled = !!supabase && !hasClaudeRuntime()
  const [tab, setTab] = useState<Tab>(() => readPref<Tab>('fd:tab', 'dashboard'))
  const [ledger, setLedger] = useState<Ledger>(() => readPref<Ledger>('fd:ledger', 'personal'))
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>('fd:theme', 'system'))
  const [pending, setPending] = useState<'sample' | 'clear' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => writePref('fd:tab', tab), [tab])
  useEffect(() => writePref('fd:ledger', ledger), [ledger])
  useEffect(() => {
    writePref('fd:theme', theme)
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function exportAll() {
    download(`blazynumb-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  }
  function confirmPending() {
    if (pending === 'sample') setData(sampleData())
    if (pending === 'clear') setData({ transactions: [], budgets: [], holdings: [] })
    setNotice(pending === 'sample' ? 'Sample data loaded.' : 'All data cleared.')
    setPending(null)
  }
  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.transactions)) throw new Error('missing transactions')
      setData({ transactions: parsed.transactions, budgets: parsed.budgets ?? [], holdings: parsed.holdings ?? [] })
      setNotice('Backup restored.')
    } catch {
      setNotice('That file is not a blazynumb backup. Choose a .json file made with "Back up (JSON)".')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="" />
          blazynumb
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
        <span className={`sync sync-${syncStatus}`} title={SYNC_HINT[syncStatus]} role="status">
          <span className="dot" aria-hidden="true" />
          {SYNC_LABEL[syncStatus]}
        </span>
        {accountsEnabled && (
          <Account session={session} onSignOut={() => setData({ transactions: [], budgets: [], holdings: [] })} />
        )}
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {syncStatus === 'connecting' || !sessionReady ? (
          <div className="empty">Loading your data…</div>
        ) : (
          <>
        {tab === 'dashboard' && <Dashboard data={data} ledger={ledger} onGoTo={setTab} />}
        {tab === 'transactions' && <Transactions data={data} ledger={ledger} setData={setData} />}
        {tab === 'budgets' && <Budgets data={data} ledger={ledger} setData={setData} />}
        {tab === 'investments' && <Investments data={data} setData={setData} />}
          </>
        )}
      </main>

      <footer className="footer">
        {pending ? (
          <>
            <span role="alert">
              {pending === 'sample'
                ? 'Replace all your data with the sample data?'
                : 'Delete all transactions, budgets and holdings from this browser?'}{' '}
              This can’t be undone{canDownload ? ' — back up first to keep a copy' : ''}.
            </span>
            <button className="btn primary" onClick={confirmPending}>
              {pending === 'sample' ? 'Replace with sample data' : 'Delete everything'}
            </button>
            <button className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <span>{notice ??
                (accountsEnabled && !session
                  ? 'Saved on this device only. Sign in to sync across devices.'
                  : SYNC_HINT[syncStatus === 'saving' ? 'synced' : syncStatus])}</span>
            {canDownload && (
              <button className="btn ghost" onClick={exportAll}>
                Back up (JSON)
              </button>
            )}
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
            {!hasClaudeRuntime() && <InstallButton />}
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Theme">
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
            <button className="btn ghost" onClick={() => setPending('sample')}>
              Load sample data
            </button>
            <button className="btn ghost danger" onClick={() => setPending('clear')}>
              Clear all data
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
