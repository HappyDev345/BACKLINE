// A place to browse technical discussions, start threads, and write replies.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { timeAgo } from '../lib/utils'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'
import ReportButton from '../components/ReportButton'
import ProfileBadges from '../components/ProfileBadges'

export const CATEGORIES = [
  // These labels are used by both the category filters and the new-thread form.
  'Lighting & Control', 'Audio & Signal', 'Cameras & Cinematography',
  'Video & Projection', 'Equipment', 'Workflows & Troubleshooting', 'Careers & Training',
]

export default function ForumPage({ promptSignIn }) {
  const { session, profile } = useAuth()
  const demo = useDemoData()
  const [threads, setThreads] = useState([])
  const [cat, setCat] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: CATEGORIES[0] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [open, setOpen] = useState(null)
  const [replies, setReplies] = useState([])
  const [reply, setReply] = useState('')

  async function load() {
    setLoadError('')
    // A forum thread is a post that has a category; regular feed posts do not.
    if (isDemoMode) {
      setThreads(demo.posts.filter((post) => post.category))
      return
    }
    let q = supabase
      .from('posts')
      .select('*, profiles:author_id(id, display_name, role_title, avatar_url, staff_roles(role), profile_badges(badge)), likes(count), comments(count)')
      .not('category', 'is', null)
      .order('created_at', { ascending: false })
    try {
      const { data, error: threadsError } = await q
      if (threadsError) throw threadsError
      setThreads(data || [])
    } catch (threadsError) {
      setLoadError(getUserFacingError(threadsError, 'We couldn’t load discussions right now. Please try again.'))
    }
  }

  useEffect(() => { load() }, [])

  const shown = cat ? threads.filter(t => t.category === cat) : threads

  async function createThread(e) {
    e.preventDefault()
    if (!session) return promptSignIn()
    setBusy(true); setError('')
    // New sample threads are shared with the feed data but remain in this browser.
    if (isDemoMode) {
      const thread = {
        id: 'demo-thread-' + Date.now(),
        author_id: session.user.id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        created_at: new Date().toISOString(),
        profiles: profile,
        likes: [{ count: 0 }],
        comments: [{ count: 0 }],
      }
      demo.setPosts((current) => [thread, ...current])
      setThreads((current) => [thread, ...current])
      setBusy(false)
      setShowNew(false)
      setForm({ title: '', body: '', category: CATEGORIES[0] })
      return
    }
    try {
      const { error } = await supabase.from('posts').insert({
        author_id: session.user.id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
      })
      if (error) {
        setError(getUserFacingError(error, 'We couldn’t post this discussion right now. Please try again.'))
        return
      }
      setShowNew(false)
      setForm({ title: '', body: '', category: CATEGORIES[0] })
      load()
    } catch (postError) {
      setError(getUserFacingError(postError, 'We couldn’t post this discussion right now. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function openThread(t) {
    setOpen(t)
    // Load replies only after someone opens a thread.
    if (isDemoMode) {
      setReplies(demo.comments.filter((comment) => comment.post_id === t.id))
      setReply('')
      return
    }
    try {
      const { data, error } = await supabase
        .from('comments').select('*, profiles:author_id(id, display_name, avatar_url, staff_roles(role), profile_badges(badge))')
        .eq('post_id', t.id).order('created_at', { ascending: true })
      if (error) throw error
      setReplies(data || [])
      setReply('')
      setActionError('')
    } catch (error) {
      setReplies([])
      setActionError(getUserFacingError(error, 'We couldn’t load replies right now. Please try again.'))
      setReply('')
    }
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!session) return promptSignIn()
    if (!reply.trim()) return
    setActionError('')
    if (isDemoMode) {
      const comment = {
        id: 'demo-reply-' + Date.now(),
        post_id: open.id,
        author_id: session.user.id,
        body: reply.trim(),
        created_at: new Date().toISOString(),
        profiles: profile,
      }
      setReplies((current) => [...current, comment])
      demo.setComments((current) => [...current, comment])
      demo.setPosts((current) => current.map((post) => post.id === open.id
        ? { ...post, comments: [{ count: (post.comments?.[0]?.count || 0) + 1 }] }
        : post))
      setReply('')
      setThreads((current) => current.map((thread) => thread.id === open.id
        ? { ...thread, comments: [{ count: (thread.comments?.[0]?.count || 0) + 1 }] }
        : thread))
      return
    }
    try {
      const { data, error } = await supabase.from('comments')
        .insert({ post_id: open.id, author_id: session.user.id, body: reply.trim() })
        .select('*, profiles:author_id(id, display_name, avatar_url, staff_roles(role), profile_badges(badge))').single()
      if (error) throw error
      if (data) {
        setReplies(r => [...r, data])
        setReply('')
        load()
      }
    } catch (error) {
      setActionError(getUserFacingError(error, 'We couldn’t post your reply right now. Please try again.'))
    }
  }

  return (
    <div className="page">
      <header className="row-between" style={{ marginBottom: 6 }}>
        <h1>Forum</h1>
        <button className="btn" onClick={() => session ? setShowNew(true) : promptSignIn()}>+ New thread</button>
      </header>
      <p className="muted">Technical discussions, equipment advice and industry knowledge from the community.</p>
      {loadError && <p className="error-text" role="alert">{loadError} <button className="clear-btn" onClick={load}>Try again</button></p>}

      <div className="forum-cats">
        {/* Choosing a category filters the thread list below. */}
        <button className={'tab' + (cat === '' ? ' active' : '')} onClick={() => setCat('')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} className={'tab' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {/* Selecting a thread opens its full text and replies in a window. */}
      {!loadError && shown.length === 0 && <div className="panel-empty">No threads here yet — start one!</div>}
      {shown.map(t => (
        <div key={t.id}>
          <div
            className="thread-item"
            role="button"
            tabIndex={0}
            onClick={() => openThread(t)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openThread(t)
              }
            }}
          >
            <div className="row-between">
              <h3>{t.title}</h3>
              <span className="badge badge-type">{t.category}</span>
            </div>
            <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.55 }}>
              {(t.body || '').slice(0, 140)}{(t.body || '').length > 140 ? '…' : ''}
            </p>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
              {t.profiles?.display_name || 'Unknown'} · {timeAgo(t.created_at)} · {t.comments?.[0]?.count || 0} replies
            </p>
          </div>
          <div className="thread-report">
            <ReportButton targetType="post" targetId={t.id} ownerId={t.author_id} promptSignIn={promptSignIn} />
          </div>
        </div>
      ))}

      {showNew && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setShowNew(false)} aria-label="Close">&#10005;</button>
            <h2>Start a discussion</h2>
            <form onSubmit={createThread} style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="ft-cat">Category</label>
                <select id="ft-cat" className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ft-title">Title</label>
                <input id="ft-title" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={140} />
              </div>
              <div className="field">
                <label htmlFor="ft-body">Details</label>
                <textarea id="ft-body" className="input" rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required />
              </div>
              {error && <p className="error-text" role="alert">{error}</p>}
              <div className="modal-actions">
                <button className="btn" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post thread'}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {open && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setOpen(null)} aria-label="Close">&#10005;</button>
            <span className="badge badge-type">{open.category}</span>
            <h2>{open.title}</h2>
            {actionError && <p className="error-text" role="alert">{actionError}</p>}
            <div className="post-head" style={{ marginBottom: 14 }}>
              <Avatar profile={open.profiles} />
              <div>
                <div className="who">{open.profiles?.display_name || 'Unknown'}</div>
                <ProfileBadges profile={open.profiles} />
                <div className="sub">{timeAgo(open.created_at)}</div>
              </div>
            </div>
            <ReportButton targetType="post" targetId={open.id} ownerId={open.author_id} promptSignIn={promptSignIn} />
            <p className="post-body">{open.body}</p>
            <div className="modal-section">
              <h4>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</h4>
              {replies.map(r => (
                <div className="comment" key={r.id}>
                  <Avatar profile={r.profiles} />
                  <div>
                    <div className="who">{r.profiles?.display_name || 'Unknown'} <span className="muted" style={{ fontWeight: 400, fontSize: '0.75rem' }}>· {timeAgo(r.created_at)}</span></div>
                    <ProfileBadges profile={r.profiles} />
                    <div className="txt">{r.body}</div>
                  </div>
                  <ReportButton targetType="comment" targetId={r.id} ownerId={r.author_id} promptSignIn={promptSignIn} />
                </div>
              ))}
              {replies.length === 0 && <p className="muted">No replies yet.</p>}
            </div>
            <form className="comment-form" style={{ marginTop: 18 }} onSubmit={submitReply}>
              <input
                className="input"
                placeholder={session ? 'Write a reply…' : 'Sign in to reply'}
                value={reply}
                onChange={e => setReply(e.target.value)}
                disabled={!session}
              />
              <button className="btn btn-sm" type="submit" disabled={!session || !reply.trim()}>Reply</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
