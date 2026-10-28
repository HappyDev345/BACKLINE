// Site-wide navigation, account controls, and unread-notification count.
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from './Avatar'
import logo from '../../BackLine-logo.png'

export default function NavBar({ onSignIn }) {
  const { session, profile, loading, signOut } = useAuth()
  const demo = useDemoData()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [notificationError, setNotificationError] = useState('')
  const navigate = useNavigate()

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      setMenuOpen(false)
      navigate('/')
    } catch (error) {
      setSignOutError(getUserFacingError(error, 'We couldn’t sign you out right now. Please try again.'))
    }
  }

  useEffect(() => {
    if (!session) { setUnread(0); setNotificationError(''); return }
    // Preview mode counts sample alerts locally instead of contacting Supabase.
    if (isDemoMode) {
      setUnread(demo.notifications.filter((notification) => notification.user_id === session.user.id && !notification.read).length)
      return
    }
    // In the connected app, load the count and listen for new alerts in real time.
    async function loadCount() {
      setNotificationError('')
      try {
        const { count, error } = await supabase
          .from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id).eq('read', false)
        if (error) throw error
        setUnread(count || 0)
      } catch (error) {
        setNotificationError(getUserFacingError(error, 'Your notification count may be out of date. Please refresh to try again.'))
      }
    }
    loadCount()
    const recalc = () => loadCount()
    window.addEventListener('backline:notifs-read', recalc)
    const ch = supabase.channel('notif-count')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        () => setUnread(u => u + 1))
      .subscribe()
    return () => {
      window.removeEventListener('backline:notifs-read', recalc)
      supabase.removeChannel(ch)
    }
  }, [session, demo.notifications])

  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand"><span className="brand-mark" aria-hidden="true"><img src={logo} alt="" /></span>BACKLINE</NavLink>
        <div id="site-nav-links" className={'nav-links' + (menuOpen ? ' is-open' : '')}>
          <NavLink to="/" onClick={() => setMenuOpen(false)}>Home</NavLink>
          {session ? (
            <NavLink to="/feed" onClick={() => setMenuOpen(false)}>Feed</NavLink>
          ) : (
            <NavLink to="/about" onClick={() => setMenuOpen(false)}>About</NavLink>
          )}
          <NavLink to="/discover" onClick={() => setMenuOpen(false)}>Discover</NavLink>
          {session && (
            <>
              <NavLink to="/people" onClick={() => setMenuOpen(false)}>People</NavLink>
              <NavLink to="/forum" onClick={() => setMenuOpen(false)}>Forum</NavLink>
              <NavLink to="/messages" onClick={() => setMenuOpen(false)}>Messages</NavLink>
              <NavLink
                to="/notifications"
                className={({ isActive }) => 'bell-wrap' + (isActive ? ' active' : '')}
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="bell-icon">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                  {unread > 0 && <span className="badge-dot">{unread}</span>}
                </span>
                <span>Notifications</span>
              </NavLink>
            </>
          )}
        </div>
        <div className="nav-actions">
          {session ? (
            <div className="nav-user">
              {profile && <NavLink to={'/profile/' + profile.id} onClick={() => setMenuOpen(false)}><Avatar profile={profile} /></NavLink>}
              <NavLink className="btn btn-ghost btn-sm" to="/settings" onClick={() => setMenuOpen(false)}>Settings</NavLink>
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
              {signOutError && <span className="error-text" role="alert">{signOutError}</span>}
              {notificationError && <span className="error-text" role="alert">{notificationError}</span>}
            </div>
          ) : !loading ? (
            <button className="nav-sign-in" onClick={() => { setMenuOpen(false); onSignIn() }}>Sign in</button>
          ) : null}
          <button
            className="nav-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="site-nav-links"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  )
}
