import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDemoData } from '../context/DemoContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'

const REASONS = [
  ['spam', 'Spam or scam'],
  ['harassment', 'Harassment'],
  ['off_topic', 'Off-topic or not about AV'],
  ['misleading', 'Misleading'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Other'],
]

export default function ReportButton({ targetType, targetId, ownerId, promptSignIn }) {
  const { session } = useAuth()
  const demo = useDemoData()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('off_topic')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if ((session && session.user.id === ownerId) || submitted) {
    return submitted ? <span className="hint" role="status">Report sent for review</span> : null
  }

  async function submit(event) {
    event.preventDefault()
    if (!session) return promptSignIn?.()
    setBusy(true)
    setError('')
    try {
      if (isDemoMode) {
        demo.setReports((current) => [{
          id: 'demo-report-' + Date.now(),
          reporter_id: session.user.id,
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim(),
          status: 'open',
          created_at: new Date().toISOString(),
        }, ...current])
      } else {
        const { error: reportError } = await supabase.rpc('submit_report', {
          target_kind: targetType,
          target_uuid: targetId,
          report_reason: reason,
          report_details: details.trim(),
        })
        if (reportError) throw reportError
      }
      setSubmitted(true)
      setOpen(false)
      setDetails('')
    } catch (submitError) {
      setError(getUserFacingError(submitError, 'We couldn’t send your report. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="report-control">
      <button className="action-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Report
      </button>
      {open && (
        <form className="report-form" onSubmit={submit}>
          <label>
            Reason
            <select className="input" value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Details (optional)
            <textarea className="input" rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="report-actions">
            <button className="btn btn-sm" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
