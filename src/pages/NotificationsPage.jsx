// Lists activity alerts for the signed-in person and allows marking them read.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { timeAgo } from '../lib/utils'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'

const LABELS = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  message: 'sent you a message',
}

const PRIVATE_REPORT_NOTIFICATIONS = {
  report_reviewed: "Your report has been handled privately by a moderator. Please note that for privacy reasons, we're not able to share the specifics of the action taken, if any.",
  report_actioned: "Your report has been handled privately by a moderator. Please note that for privacy reasons, we're not able to share the specifics of the action taken, if any.",
}

export default function NotificationsPage({ promptSignIn }) {
  const { session } = useAuth()
  const demo = useDemoData()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    // Alerts are private to the signed-in account in the connected app.
    if (isDemoMode) {
      setNotifs(demo.notifications.filter((notification) => notification.user_id === session?.user?.id))
      return
    }
    try {
      const { data, error: loadError } = await supabase
        .from('notifications')
        .select('*, profiles:actor_id(id, display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (loadError) throw loadError
      setNotifs(data || [])
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load notifications right now. Please try again.'))
    }
  }

  useEffect(() => { if (session) load() }, [session])

  async function markAllRead() {
    // Update local alerts in preview mode; otherwise save the changes online.
    if (isDemoMode) {
      demo.setNotifications((current) => current.map((notification) => notification.user_id === session.user.id
        ? { ...notification, read: true }
        : notification))
      setNotifs((current) => current.map((notification) => ({ ...notification, read: true })))
      return
    }
    setError('')
    try {
      const { error: updateError } = await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id).eq('read', false)
      if (updateError) throw updateError
    } catch (updateError) {
      setError(getUserFacingError(updateError, 'We couldn’t update your notifications right now. Please try again.'))
      return
    }
    window.dispatchEvent(new Event('backline:notifs-read'))
    load()
  }

  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Notifications</h2>
        <p>Sign in to see activity on your posts and projects.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <header className="row-between" style={{ marginBottom: 20 }}>
        <h1>Notifications</h1>
        {notifs.some(n => !n.read) && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
      </header>
      {error && <p className="error-text" role="alert">{error} <button className="clear-btn" onClick={load}>Try again</button></p>}
      {!error && notifs.length === 0 && <div className="panel-empty">Nothing yet — interactions will show up here.</div>}
      {notifs.map(n => (
        <div
          key={n.id}
          className={'notif-item' + (n.read ? '' : ' unread')}
          style={{ cursor: n.type === 'message' ? 'pointer' : 'default' }}
          role={n.type === 'message' ? 'button' : undefined}
          tabIndex={n.type === 'message' ? 0 : undefined}
          onClick={() => { if (n.type === 'message') navigate('/messages', { state: { open: n.ref_id } }) }}
          onKeyDown={(event) => {
            if (n.type === 'message' && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              navigate('/messages', { state: { open: n.ref_id } })
            }
          }}
        >
          {PRIVATE_REPORT_NOTIFICATIONS[n.type] ? (
            <div className="txt">{PRIVATE_REPORT_NOTIFICATIONS[n.type]}</div>
          ) : (
            <>
              <Avatar profile={n.profiles?.id ? n.profiles : { display_name: 'Unknown User' }} />
              <div className="txt">
                <b>{n.profiles?.id ? n.profiles.display_name || 'Unknown User' : 'Unknown User'}</b> {LABELS[n.type] || 'interacted with you'}
              </div>
            </>
          )}
          <span className="time">{timeAgo(n.created_at)}</span>
        </div>
      ))}
    </div>
  )
}
