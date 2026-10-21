// Shared navigation for the community pages, including account controls,
// the small-screen menu, and the unread-notification count.
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import Avatar from './Avatar'
import logo from '../../BackLine-logo.png'

export default function NavBar({ onSignIn }) {
  const { session, profile, signOut } = useAuth()
  const demo = useDemoData()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) { setUnread(0); return }
    // Preview mode counts sample alerts locally instead of contacting Supabase.
    if (isDemoMode) {
      setUnread(demo.notifications.filter((notification) => notification.user_id === session.user.id && !notification.read).length)
      return
    }
    // In the connected app, load the count and listen for new alerts in real time.
    async function loadCount() {
      const { count } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id).eq('read', false)
      setUnread(count || 0)
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
        <div id="community-nav-links" className={'nav-links' + (menuOpen ? ' is-open' : '')}>
          <NavLink to="/feed" onClick={() => setMenuOpen(false)}>Feed</NavLink>
          <NavLink to="/discover" onClick={() => setMenuOpen(false)}>Discover</NavLink>
          <NavLink to="/people" onClick={() => setMenuOpen(false)}>People</NavLink>
          <NavLink to="/forum" onClick={() => setMenuOpen(false)}>Forum</NavLink>
          <NavLink to="/messages" onClick={() => setMenuOpen(false)}>Messages</NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) => 'bell-wrap' + (isActive ? ' active' : '')}
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            &#128276;
            {unread > 0 && <span className="badge-dot">{unread}</span>}
          </NavLink>
        </div>
        <div className="nav-actions">
          {session && profile ? (
            <div className="nav-user">
              <NavLink to={'/profile/' + profile.id}><Avatar profile={profile} /></NavLink>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); setMenuOpen(false); navigate('/') }}>Sign out</button>
            </div>
          ) : (
            <button className="nav-sign-in" onClick={() => { setMenuOpen(false); onSignIn() }}>Sign in</button>
          )}
          <button
            className="nav-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="community-nav-links"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  )
}
