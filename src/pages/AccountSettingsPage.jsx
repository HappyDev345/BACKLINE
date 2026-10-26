import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'

export default function AccountSettingsPage({ promptSignIn }) {
  const { session, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setEmail(session?.user?.email || '')
  }, [session?.user?.email])

  if (loading) return <div className="page"><p className="muted">Loading account…</p></div>

  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Sign in to manage your account</h2>
        <p>Your account settings are available after signing in.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  if (isDemoMode) {
    return (
      <div className="page settings-page">
        <h1>Account settings</h1>
        <section className="settings-card">
          <h2>Preview account</h2>
          <p className="muted">This is a temporary preview account. Email, password, recovery, and account deletion are only available when BACKLINE is connected to Supabase.</p>
        </section>
      </div>
    )
  }

  async function updateEmail(e) {
    e.preventDefault()
    setError('')
    setConfirmation('')
    if (email.trim().toLowerCase() === session.user.email?.toLowerCase()) {
      setError('Enter a different email address.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: email.trim() })
      if (updateError) throw updateError
      setConfirmation('Check your inbox to confirm the email address change.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function updatePassword(e) {
    e.preventDefault()
    setError('')
    setConfirmation('')
    if (password !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirmPassword('')
      setConfirmation('Your password has been updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount(e) {
    e.preventDefault()
    setError('')
    setConfirmation('')
    if (deleteConfirmation !== 'DELETE') {
      setError('Type DELETE exactly to confirm account deletion.')
      return
    }
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-account')
      if (deleteError) {
        let message = deleteError.message
        if (deleteError.context instanceof Response) {
          const response = await deleteError.context.json()
          if (typeof response?.error === 'string') message = response.error
        }
        throw new Error(message)
      }
      await signOut({ scope: 'local' })
      navigate('/')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="page settings-page">
      <header className="settings-heading">
        <h1>Account settings</h1>
        <p className="muted">Manage the sign-in details for {profile?.display_name || session.user.email}.</p>
      </header>

      <section className="settings-card">
        <h2>Email address</h2>
        <p className="muted">Changing your email requires confirmation from your inbox.</p>
        <form onSubmit={updateEmail}>
          <div className="field">
            <label htmlFor="settings-email">Email</label>
            <input id="settings-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Update email'}</button>
        </form>
      </section>

      <section className="settings-card">
        <h2>Password</h2>
        <form onSubmit={updatePassword}>
          <div className="field">
            <label htmlFor="settings-password">New password</label>
            <input id="settings-password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="settings-confirm-password">Confirm new password</label>
            <input id="settings-confirm-password" className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Update password'}</button>
        </form>
      </section>

      <section className="settings-card danger-zone">
        <h2>Delete account</h2>
        <p>This permanently deletes your account, profile, projects, posts, messages, and other linked records. Your uploaded profile images will also be removed. This action cannot be undone.</p>
        <form onSubmit={deleteAccount}>
          <div className="field">
            <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
            <input id="delete-confirmation" className="input" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} required autoComplete="off" />
          </div>
          <button className="btn btn-danger" type="submit" disabled={busy}>{busy ? 'Deleting…' : 'Permanently delete account'}</button>
        </form>
      </section>

      {error && <p className="error-text" role="alert">{error}</p>}
      {confirmation && <p className="settings-success" role="status">{confirmation}</p>}
    </main>
  )
}
