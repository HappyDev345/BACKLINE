import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'
import { timeAgo } from '../lib/utils'

const STAFF_ROLES = [
  ['feed_moderator', 'Feed / forum moderator'],
  ['project_moderator', 'Project moderator'],
  ['admin', 'Admin'],
]

function isAccountSuspended(account) {
  const restrictions = Array.isArray(account.account_restrictions)
    ? account.account_restrictions
    : account.account_restrictions ? [account.account_restrictions] : []
  return restrictions.some((restriction) => restriction.suspended)
}

function ReportCase({ report, roles, onResolved }) {
  const { session } = useAuth()
  const [target, setTarget] = useState(null)
  const [notes, setNotes] = useState([])
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadCase() {
    setError('')
    try {
      let targetData
      if (report.target_type === 'message') {
        const { data, error: targetError } = await supabase.rpc('get_reported_message', {
          report_uuid: report.id,
        })
        if (targetError) throw targetError
        targetData = data
      } else {
        const targetTable = report.target_type === 'user' ? 'profiles' : `${report.target_type}s`
        const { data, error: targetError } = await supabase
          .from(targetTable).select('*').eq('id', report.target_id).maybeSingle()
        if (targetError) throw targetError
        targetData = data
      }
      setTarget(targetData)
      const { data: noteData, error: noteError } = await supabase
        .from('staff_notes')
        .select('*, profiles:author_id(display_name)')
        .eq('report_id', report.id)
        .order('created_at', { ascending: true })
      if (noteError) throw noteError
      setNotes(noteData || [])
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load this report’s review context.'))
    }

  }

  useEffect(() => { loadCase() }, [report.id])

  async function claim() {
    setBusy(true)
    setError('')
    try {
      const { error: claimError } = await supabase.rpc('claim_report', { report_uuid: report.id })
      if (claimError) throw claimError
      await onResolved()
    } catch (claimError) {
      setError(getUserFacingError(claimError, 'We couldn’t assign this report to you.'))
    } finally {
      setBusy(false)
    }
  }

  async function resolve(action) {
    const actionReason = reason.trim()
    if (!actionReason) {
      setError('Add a reason before taking this action.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: actionError } = await supabase.rpc('resolve_report', {
        report_uuid: report.id,
        moderation_action: action,
        action_reason: actionReason,
      })
      if (actionError) throw actionError
      await onResolved()
    } catch (actionError) {
      setError(getUserFacingError(actionError, 'We couldn’t resolve this report.'))
    } finally {
      setBusy(false)
    }
  }

  async function addNote(event) {
    event.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    setError('')
    try {
      const { error: noteError } = await supabase.from('staff_notes').insert({
        report_id: report.id,
        author_id: session.user.id,
        body: note.trim(),
      })
      if (noteError) throw noteError
      setNote('')
      await loadCase()
    } catch (noteError) {
      setError(getUserFacingError(noteError, 'We couldn’t add the staff note.'))
    } finally {
      setBusy(false)
    }
  }

  const isAdmin = roles.includes('admin')
  const targetText = !target ? 'Reported item is unavailable or has been deleted.' :
    report.target_type === 'user' ? `${target.display_name || 'Unnamed account'}${target.username ? ` (@${target.username})` : ''}` :
      (target.title || target.body || target.display_name || 'Content has no text')
  const targetTypeLabel = report.target_type === 'message' ? 'private message' : report.target_type
  const canResolve = report.status === 'open' || report.reviewer_id === session?.user?.id || isAdmin

  return (
    <article className="staff-card">
      <div className="staff-card-head">
        <div>
          <strong>{targetTypeLabel} report</strong>
          <span className="badge badge-type">{report.status}</span>
        </div>
        <span className="muted">{timeAgo(report.created_at)}</span>
      </div>
      <p><b>Reason:</b> {report.reason}</p>
      {report.details && <p><b>Reporter details:</b> {report.details}</p>}
      <p className="staff-target"><b>Reported item:</b> {targetText}</p>
      {report.target_type === 'message' && target && (
        <p className="hint">
          Sent by {target.profiles?.display_name || 'Unknown account'} · {timeAgo(target.created_at)}
        </p>
      )}
      <p className="hint">Target ID: {report.target_id}</p>
      {report.status === 'open' || report.status === 'in_review' ? (
        <>
          {report.status === 'open' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={claim}>Take this report</button>}
          {report.status === 'in_review' && report.reviewer_id === session?.user?.id && <p className="hint">You are reviewing this report.</p>}
          {canResolve ? (
            <>
              <label className="staff-reason">
                Decision reason
                <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
              </label>
              <div className="staff-actions">
                {report.target_type === 'user' ? (
                  isAdmin && <>
                    <button className="btn btn-sm" disabled={busy} onClick={() => resolve('suspend')}>Suspend account</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve('reinstate')}>Reinstate account</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm" disabled={busy} onClick={() => resolve('hide')}>Hide content</button>
                    <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => resolve('remove')}>Remove content</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve('restore')}>Restore content</button>
                  </>
                )}
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve('dismiss')}>Dismiss</button>
              </div>
            </>
          ) : <p className="hint">This report is assigned to another reviewer.</p>}
        </>
      ) : (
        <p className="hint"><b>Resolution:</b> {report.resolution || 'No reason recorded'}</p>
      )}

      <details className="staff-notes">
        <summary>Staff notes ({notes.length})</summary>
        {notes.map((item) => (
          <p className="staff-note" key={item.id}>
            <b>{item.profiles?.display_name || 'Staff'} · {timeAgo(item.created_at)}</b>
            <br />{item.body}
          </p>
        ))}
        <form className="staff-note-form" onSubmit={addNote}>
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Add a private staff note" />
          <button className="btn btn-sm" type="submit" disabled={busy || !note.trim()}>Add note</button>
        </form>
      </details>
      {error && <p className="error-text" role="alert">{error}</p>}
    </article>
  )
}

export default function StaffPage() {
  const { session, staffRoles, staffRoleError, refreshProfile } = useAuth()
  const [section, setSection] = useState('reports')
  const [status, setStatus] = useState('open')
  const [reports, setReports] = useState([])
  const [actions, setActions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [accountQuery, setAccountQuery] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busyAccount, setBusyAccount] = useState('')

  const isAdmin = staffRoles.includes('admin')
  const canStaff = staffRoles.length > 0

  async function loadReports() {
    setLoadError('')
    const { data, error } = await supabase.from('reports').select('*')
      .eq('status', status).order('created_at', { ascending: false }).limit(100)
    if (error) {
      setLoadError(getUserFacingError(error, 'We couldn’t load the reports queue.'))
      return
    }
    setReports(data || [])
  }

  async function loadActions() {
    setLoadError('')
    const { data, error } = await supabase.from('moderation_actions')
      .select('*, profiles:actor_id(display_name)')
      .order('created_at', { ascending: false }).limit(50)
    if (error) {
      setLoadError(getUserFacingError(error, 'We couldn’t load the action history.'))
      return
    }
    setActions(data || [])
  }

  async function loadAccounts(search = '') {
    setLoadError('')
    try {
      const { data, error } = await supabase.rpc('admin_list_accounts', {
        search_term: search.trim(),
      })
      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      setLoadError(getUserFacingError(error, 'We couldn’t load accounts.'))
    }
  }

  useEffect(() => {
    if (isDemoMode || !canStaff) return
    if (section === 'reports') loadReports()
    if (section === 'history') loadActions()
    if (section === 'accounts' && isAdmin) loadAccounts(accountQuery)
  }, [section, status, canStaff, isAdmin, accountQuery])

  async function accountAction(rpc, params) {
    setBusyAccount(params.account_uuid)
    setLoadError('')
    try {
      const { error } = await supabase.rpc(rpc, params)
      if (error) throw error
      await loadAccounts(accountQuery)
      if (params.account_uuid === session?.user?.id) await refreshProfile()
    } catch (actionError) {
      setLoadError(getUserFacingError(actionError, 'We couldn’t update this account.'))
    } finally {
      setBusyAccount('')
    }
  }

  async function toggleRole(account, role) {
    const hasRole = account.staff_roles?.some((item) => item.role === role)
    if (role === 'admin' && hasRole && account.id === session?.user?.id) {
      setLoadError('Choose another admin before removing your own admin role.')
      return
    }
    await accountAction('admin_set_staff_role', {
      account_uuid: account.id,
      role_name: role,
      grant_role: !hasRole,
    })
  }

  function setVerified(account) {
    const verified = account.profile_badges?.some((badge) => badge.badge === 'verified')
    const reason = verified ? '' : window.prompt('Reason for granting the verified badge:')
    if (!verified && !reason?.trim()) return
    accountAction('admin_set_verified', {
      account_uuid: account.id,
      is_verified: !verified,
      verification_reason: reason || 'Verification revoked by admin',
    })
  }

  function setSuspended(account) {
    const suspended = isAccountSuspended(account)
    const reason = window.prompt(suspended ? 'Reason for reinstating this account:' : 'Reason for suspending this account:')
    if (!reason?.trim()) return
    accountAction('admin_set_account_suspended', {
      account_uuid: account.id,
      is_suspended: !suspended,
      restriction_reason: reason.trim(),
    })
  }

  if (isDemoMode) {
    return <div className="page"><h1>Staff workspace</h1><p className="panel-empty">Staff tools require a connected Supabase project.</p></div>
  }
  if (staffRoleError) {
    return <div className="page"><h1>Staff workspace</h1><p className="error-text" role="alert">{staffRoleError}</p></div>
  }
  if (!canStaff) {
    return <div className="auth-prompt"><h2>Staff access required</h2><p>This area is only available to BACKLINE moderators and admins.</p></div>
  }

  return (
    <div className="page staff-page">
      <header className="row-between">
        <div><h1>Staff workspace</h1><p className="muted">Private moderation, reports, and account tools.</p></div>
      </header>
      <div className="tabs staff-tabs">
        <button className={'tab' + (section === 'reports' ? ' active' : '')} onClick={() => setSection('reports')}>Reports</button>
        <button className={'tab' + (section === 'history' ? ' active' : '')} onClick={() => setSection('history')}>Action history</button>
        {isAdmin && <button className={'tab' + (section === 'accounts' ? ' active' : '')} onClick={() => setSection('accounts')}>Accounts & roles</button>}
      </div>
      {loadError && <p className="error-text" role="alert">{loadError}</p>}

      {section === 'reports' && (
        <>
          <div className="tabs staff-status">
            {['open', 'in_review', 'actioned', 'dismissed'].map((value) => (
              <button key={value} className={'tab' + (status === value ? ' active' : '')} onClick={() => setStatus(value)}>{value.replace('_', ' ')}</button>
            ))}
          </div>
          {!loadError && reports.length === 0 && <div className="panel-empty">No {status.replace('_', ' ')} reports.</div>}
          {reports.map((report) => <ReportCase key={report.id} report={report} roles={staffRoles} onResolved={loadReports} />)}
        </>
      )}

      {section === 'history' && (
        <div className="staff-card">
          <h2>Recent staff actions</h2>
          {actions.map((action) => (
            <div className="staff-history-row" key={action.id}>
              <div><b>{action.profiles?.display_name || 'Former staff member'}</b> · {action.action}</div>
              <div className="muted">{action.target_type} · {action.target_id} · {timeAgo(action.created_at)}</div>
              {action.reason && <p>{action.reason}</p>}
            </div>
          ))}
          {!loadError && actions.length === 0 && <p className="muted">No staff actions recorded yet.</p>}
        </div>
      )}

      {section === 'accounts' && isAdmin && (
        <>
          <div className="field staff-search">
            <label htmlFor="staff-account-search">Find an account by name, username, or ID</label>
            <input id="staff-account-search" className="input" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} />
          </div>
          {accounts.map((account) => {
            const suspended = isAccountSuspended(account)
            const verified = account.profile_badges?.some((badge) => badge.badge === 'verified')
            return (
              <article className="staff-card staff-account" key={account.id}>
                <div>
                  <strong>{account.display_name || 'Unnamed account'}</strong>
                  {account.username && <span className="muted"> · @{account.username}</span>}
                  <div className="hint">{account.id}</div>
                  <div className="staff-role-list">
                    {account.staff_roles?.map(({ role }) => <span className="badge badge-type" key={role}>{role.replace('_', ' ')}</span>)}
                    {verified && <span className="badge badge-paid">Verified</span>}
                    {suspended && <span className="badge badge-vol">Suspended</span>}
                  </div>
                </div>
                <div className="staff-account-actions">
                  {STAFF_ROLES.map(([role, label]) => (
                    <button className="btn btn-ghost btn-sm" key={role} disabled={busyAccount === account.id} onClick={() => toggleRole(account, role)}>
                      {account.staff_roles?.some((item) => item.role === role) ? `Remove ${label}` : `Grant ${label}`}
                    </button>
                  ))}
                  <button className="btn btn-ghost btn-sm" disabled={busyAccount === account.id} onClick={() => setVerified(account)}>
                    {verified ? 'Revoke verified' : 'Grant verified'}
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={busyAccount === account.id || account.id === session?.user?.id} onClick={() => setSuspended(account)}>
                    {suspended ? 'Reinstate account' : 'Suspend account'}
                  </button>
                </div>
              </article>
            )
          })}
          {!loadError && accounts.length === 0 && <div className="panel-empty">No matching accounts.</div>}
        </>
      )}
    </div>
  )
}
