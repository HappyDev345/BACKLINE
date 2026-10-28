import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDemoData } from '../context/DemoContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'
import { timeAgo } from '../lib/utils'

export default function MyReportsPage() {
  const { session } = useAuth()
  const demo = useDemoData()
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    if (isDemoMode) {
      setReports(demo.reports.filter((report) => report.reporter_id === session?.user?.id))
      return
    }
    try {
      const { data, error: reportsError } = await supabase.from('reports')
        .select('id, target_type, reason, status, resolution, created_at, updated_at')
        .eq('reporter_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (reportsError) throw reportsError
      setReports(data || [])
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load your reports right now.'))
    }
  }

  useEffect(() => { if (session) load() }, [session, demo.reports])

  if (!session) {
    return <div className="auth-prompt"><h2>Your reports</h2><p>Sign in to review reports you’ve submitted.</p></div>
  }

  return (
    <div className="page">
      <h1>Your reports</h1>
      <p className="muted">Report details are private to you and authorized staff.</p>
      {error && <p className="error-text" role="alert">{error} <button className="clear-btn" onClick={load}>Try again</button></p>}
      {!error && reports.length === 0 && <div className="panel-empty">You haven’t submitted any reports.</div>}
      {reports.map((report) => (
        <article className="staff-card" key={report.id}>
          <div className="staff-card-head">
            <strong>{report.target_type} report · {report.reason}</strong>
            <span className="badge badge-type">{report.status.replace('_', ' ')}</span>
          </div>
          <p className="muted">Sent {timeAgo(report.created_at)}</p>
          {report.resolution && <p><b>Staff update:</b> {report.resolution}</p>}
        </article>
      ))}
    </div>
  )
}
