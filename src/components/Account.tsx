import type { Session } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'closed' | 'email' | 'code' | 'account'

/** Sign in with an emailed 6-digit code (works inside an installed app, unlike magic links). */
export function Account({ session, onSignOut }: { session: Session | null; onSignOut: () => void }) {
  const [step, setStep] = useState<Step>('closed')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!supabase) return null
  const client = supabase

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return setError(`Couldn't send the code: ${error.message}`)
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) return setError('That code didn’t work. Check the latest email, or send a new code.')
    setCode('')
    setStep('closed')
  }

  async function signOut() {
    await client.auth.signOut()
    setStep('closed')
    onSignOut()
  }

  const toggle = () => setStep((s) => (s === 'closed' ? (session ? 'account' : 'email') : 'closed'))

  return (
    <>
      <button className={`btn ${session ? '' : 'primary'}`} onClick={toggle} aria-expanded={step !== 'closed'}>
        {session ? 'Account' : 'Sign in to sync'}
      </button>
      {step !== 'closed' && (
        <div className="card account-panel">
          {step === 'account' && session && (
            <>
              <h2>Signed in</h2>
              <p className="sub">{session.user.email}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: 0 }}>
                Your data syncs to every device where you sign in with this email.
              </p>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <button className="btn" onClick={signOut}>
                  Sign out
                </button>
                <button className="btn ghost" onClick={() => setStep('closed')}>
                  Close
                </button>
              </div>
              <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
                Signing out removes your data from this device. It stays safe in your account.
              </p>
            </>
          )}
          {step === 'email' && (
            <form onSubmit={sendCode}>
              <h2>Sign in to sync</h2>
              <p className="sub">We’ll email you a sign-in code (or link). No password needed. New here? This creates your account.</p>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <input
                  id="account-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email"
                  required
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button className="btn primary" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a code'}
                </button>
              </div>
            </form>
          )}
          {step === 'code' && (
            <form onSubmit={verify}>
              <h2>Check your email</h2>
              <p className="sub">
                We sent an email to {email.trim()}. Enter the 6-digit code from it, or just tap the sign-in link in the
                email on this device.
              </p>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <input
                  id="account-code"
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label="Code"
                  required
                  style={{ width: 140, letterSpacing: '0.2em' }}
                />
                <button className="btn primary" type="submit" disabled={busy}>
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <button className="btn ghost" type="button" onClick={() => setStep('email')}>
                  Use a different email
                </button>
              </div>
            </form>
          )}
          {error && (
            <p className="neg" role="alert" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
