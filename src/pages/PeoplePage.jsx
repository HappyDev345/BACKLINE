// Search the crew directory and offer quick follow and message actions.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { findOrCreateConversation } from '../lib/conversations'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'
import ProfileBadges from '../components/ProfileBadges'

export default function PeoplePage({ promptSignIn }) {
  const { session } = useAuth()
  const demo = useDemoData()
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [followingSet, setFollowingSet] = useState(new Set())
  const [query, setQuery] = useState('')
  const [busyMsg, setBusyMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError('')
    // Preview profiles and follow markers come from the shared local sample data.
    if (isDemoMode) {
      setPeople(demo.profiles)
      setFollowingSet(new Set(demo.follows.filter((follow) => follow.follower_id === session?.user?.id).map((follow) => follow.followee_id)))
      return
    }
    try {
      const { data, error: peopleError } = await supabase.from('profiles')
        .select('*, staff_roles(role), profile_badges(badge)')
        .order('created_at', { ascending: false }).limit(100)
      if (peopleError) throw peopleError
      setPeople(data || [])
      if (session) {
        const { data: follows, error: followsError } = await supabase.from('follows').select('followee_id').eq('follower_id', session.user.id)
        if (followsError) throw followsError
        setFollowingSet(new Set((follows || []).map(f => f.followee_id)))
      }
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load people right now. Please try again.'))
    }
  }

  useEffect(() => { load() }, [session])

  // Search across name, username, job title, location, and listed skills.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter(p =>
      !q ||
      (p.display_name || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.role_title || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q) ||
      (p.skills || []).some(s => s.toLowerCase().includes(q))
    )
  }, [people, query])

  async function toggleFollow(id) {
    if (!session) return promptSignIn()
    setError('')
    // A preview follow updates shared in-memory state so other screens can use it.
    if (isDemoMode) {
      const following = followingSet.has(id)
      setFollowingSet((current) => {
        const next = new Set(current)
        if (following) next.delete(id)
        else next.add(id)
        return next
      })
      demo.setFollows((current) => following
        ? current.filter((item) => !(item.follower_id === session.user.id && item.followee_id === id))
        : [...current, { follower_id: session.user.id, followee_id: id }])
      return
    }
    setError('')
    try {
      if (followingSet.has(id)) {
        const { error: followError } = await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('followee_id', id)
        if (followError) throw followError
        setFollowingSet(s => { const n = new Set(s); n.delete(id); return n })
      } else {
        const { error: followError } = await supabase.from('follows').insert({ follower_id: session.user.id, followee_id: id })
        if (followError) throw followError
        setFollowingSet(s => new Set(s).add(id))
      }
    } catch (followError) {
      setError(getUserFacingError(followError, 'We couldn’t update your connection right now. Please try again.'))
    }
  }

  async function message(id) {
    if (!session) return promptSignIn()
    setError('')
    setBusyMsg('Opening conversation…')
    try {
      // Create a sample conversation locally when one does not already exist.
      if (isDemoMode) {
        let conversation = demo.conversations.find((item) => item.other.id === id)
        if (!conversation) {
          const other = demo.profiles.find((person) => person.id === id)
          conversation = { id: 'demo-conversation-' + id, other, last: null }
          demo.setConversations((current) => [...current, conversation])
        }
        navigate('/messages', { state: { open: conversation.id } })
        setBusyMsg('')
        return
      }
      const convId = await findOrCreateConversation(supabase, session.user.id, id)
      navigate('/messages', { state: { open: convId } })
    } catch (e) {
      setBusyMsg('')
      setError(getUserFacingError(e, 'We couldn’t start a conversation right now. Please try again.'))
    }
  }

  return (
    <div className="page">
      <header className="row-between" style={{ marginBottom: 20 }}>
        <h1>People</h1>
        <div className="search-box" style={{ maxWidth: 380, width: '100%' }}>
          <input type="search" placeholder="Search by name, role, skill, location…"
            value={query} onChange={e => setQuery(e.target.value)} aria-label="Search people" />
        </div>
      </header>
      {busyMsg && <p className="hint" style={{ marginBottom: 12 }}>{busyMsg}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {/* Each result links to a profile and offers follow/message actions when signed in. */}
      {!error && shown.length === 0 && <div className="panel-empty">No people found. Invite your crew to join BACKLINE!</div>}
      {shown.map(p => (
        <div className="people-row" key={p.id}>
          <Link to={'/profile/' + p.id}><Avatar profile={p} size="lg" /></Link>
          <div className="info">
            <Link to={'/profile/' + p.id} style={{ textDecoration: 'none' }}>
              <div className="name">{p.display_name || 'Unnamed user'}</div>
            </Link>
            <ProfileBadges profile={p} />
            <div className="sub">
              {p.role_title && p.role_title + ' · '}{p.location || 'Location not set'}
              {p.username ? ' · @' + p.username : ''}
            </div>
            {(p.skills || []).length > 0 && (
              <div className="skill-chips">
                {p.skills.map(s => <span key={s} className="role-chip">{s}</span>)}
              </div>
            )}
          </div>
          {session && p.id !== session.user.id && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => message(p.id)}>Message</button>
              <button className="btn btn-sm" onClick={() => toggleFollow(p.id)}>
                {followingSet.has(p.id) ? 'Following ✓' : 'Follow'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
