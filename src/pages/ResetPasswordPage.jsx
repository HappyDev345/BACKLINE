import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (isDemoMode) {
    return <div className="auth-prompt"><h2>Password reset unavailable</h2><p>Password recovery requires a connected Supabase account.</p><Link className="btn" to="/">Back to BACKLINE</Link></div>
  }

  if (loading) return <div className="page"><p className="muted">Checking password reset link…</p></div>

  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Password reset link unavailable</h2>
        <p>This link may have expired or already been used. Request a new password reset email and try again.</p>
        <Link className="btn" to="/">Back to BACKLINE</Link>
      </div>
    )
  }

  return (
    <main className="page settings-page">
      <section className="settings-card">
        <h1>Set a new password</h1>
        {success ? (
          <>
            <p className="settings-success" role="status">Your password has been updated.</p>
            <Link className="btn" to="/settings">Go to account settings</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="reset-password">New password</label>
              <input id="reset-password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm-password">Confirm new password</label>
              <input id="reset-confirm-password" className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
