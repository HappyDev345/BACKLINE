// This pop-up lets a visitor sign in or create an account.
// With no Supabase settings, it instead starts a temporary preview session.
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'

export default function AuthModal({ open, onClose }) {
  const { signIn, signInAsDemoUser, signUp } = useAuth()
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit(e) {
    // Stop the browser from reloading the whole page when the form is submitted.
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (resetError) throw resetError
        setNotice('If an account exists for that email, a password reset link is on its way.')
      } else {
        if (mode === 'in') await signIn(email, password)
        else await signUp(email, password, displayName.trim(), username.trim().toLowerCase())
        onClose()
      }
    } catch (err) {
      setError(getUserFacingError(
        err,
        mode === 'reset'
          ? 'We couldn’t send a reset link right now. Please try again.'
          : mode === 'in'
            ? 'We couldn’t sign you in right now. Please try again.'
            : 'We couldn’t create your account right now. Please try again.'
      ))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">&#10005;</button>
        <h2>{mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Join BACKLINE' : 'Reset your password'}</h2>
        {isDemoMode && <p className="hint">Preview mode: continue as the sample user or use any email and password to explore. Nothing is saved.</p>}
        {isDemoMode && mode === 'in' && (
          <button
            className="btn"
            type="button"
            style={{ width: '100%', marginTop: 16 }}
            onClick={() => { signInAsDemoUser(); onClose() }}
          >
            Continue as sample user
          </button>
        )}
        {mode === 'reset' ? (
          <button className="clear-btn" type="button" onClick={() => { setMode('in'); setError(''); setNotice('') }}>Back to sign in</button>
        ) : (
          <div className="tabs" style={{ margin: '14px 0 20px' }}>
            <button className={'tab' + (mode === 'in' ? ' active' : '')} type="button" onClick={() => { setMode('in'); setError(''); setNotice('') }}>Sign in</button>
            <button className={'tab' + (mode === 'up' ? ' active' : '')} type="button" onClick={() => { setMode('up'); setError(''); setNotice('') }}>Create account</button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === 'up' && (
            <>
              <div className="field">
                <label htmlFor="auth-name">Display name</label>
                <input id="auth-name" className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="auth-user">Username</label>
                <input id="auth-user" className="input" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {mode !== 'reset' && <div className="field">
            <label htmlFor="auth-pass">Password</label>
            <input id="auth-pass" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>}
          {error && <p className="error-text" role="alert">{error}</p>}
          {notice && <p className="hint" role="status">{notice}</p>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </button>
          {mode === 'in' && !isDemoMode && <button className="clear-btn" type="button" style={{ marginTop: 12 }} onClick={() => { setMode('reset'); setError(''); setNotice('') }}>Forgot password?</button>}
          {mode === 'up' && !isDemoMode && <p className="hint" style={{ marginTop: 12 }}>If email confirmation is enabled in Supabase, check your inbox before signing in.</p>}
        </form>
      </div>
    </div>
  )
}
