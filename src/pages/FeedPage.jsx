// Shows community posts and lets signed-in visitors publish, like, and comment.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import PostCard from '../components/PostCard'
import Avatar from '../components/Avatar'
import { getUserFacingError } from '../lib/errorMessages'

export default function FeedPage({ promptSignIn }) {
  const { session, profile, loading } = useAuth()
  const demo = useDemoData()
  const [posts, setPosts] = useState([])
  const [likedSet, setLikedSet] = useState(new Set())
  const [followingSet, setFollowingSet] = useState(new Set())
  const [tab, setTab] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    // Preview mode uses local sample posts; connected mode requests recent posts.
    if (isDemoMode) {
      setPosts(demo.posts.filter((post) => !post.category))
      if (session) {
        setLikedSet(new Set(demo.likedPostIds))
        setFollowingSet(new Set(demo.follows.filter((follow) => follow.follower_id === session.user.id).map((follow) => follow.followee_id)))
      } else {
        setLikedSet(new Set())
        setFollowingSet(new Set())
      }
      return
    }
    try {
      const { data, error: postsError } = await supabase
        .from('posts')
        .select('*, profiles:author_id(id, display_name, role_title, avatar_url), likes(count), comments(count)')
        .is('category', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (postsError) throw postsError
      setPosts(data || [])
      if (session) {
        const { data: likes, error: likesError } = await supabase.from('likes').select('post_id').eq('user_id', session.user.id)
        if (likesError) throw likesError
        setLikedSet(new Set((likes || []).map(l => l.post_id)))
        const { data: follows, error: followsError } = await supabase.from('follows').select('followee_id').eq('follower_id', session.user.id)
        if (followsError) throw followsError
        setFollowingSet(new Set((follows || []).map(f => f.followee_id)))
      }
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'We couldn’t load the feed right now. Please try again.'))
    }
  }

  useEffect(() => { if (session) load() }, [session])

  async function publish(e) {
    e.preventDefault()
    if (!session) return promptSignIn()
    setError('')
    setBusy(true)
    // Sample posts are added to shared browser memory, not saved to a server.
    if (isDemoMode) {
      const post = {
        id: 'demo-post-' + Date.now(),
        author_id: session.user.id,
        title: title.trim() || null,
        body: body.trim(),
        category: null,
        created_at: new Date().toISOString(),
        profiles: profile,
        likes: [{ count: 0 }],
        comments: [{ count: 0 }],
      }
      demo.setPosts((current) => [post, ...current])
      setPosts((current) => [post, ...current])
      setTitle('')
      setBody('')
      setBusy(false)
      return
    }
    try {
      const { data, error } = await supabase.from('posts')
        .insert({ author_id: session.user.id, title: title.trim() || null, body: body.trim() })
        .select('*, profiles:author_id(id, display_name, role_title, avatar_url), likes(count), comments(count)')
        .single()
      if (error) throw error
      setPosts(p => [data, ...p])
      setTitle(''); setBody('')
    } catch (error) {
      setError(getUserFacingError(error, 'We couldn’t publish your post right now. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleLike(post) {
    if (!session) return promptSignIn()
    setError('')
    const id = post.id
    // Update the visible count and sample state together in preview mode.
    if (isDemoMode) {
      const liked = likedSet.has(id)
      setLikedSet((current) => {
        const next = new Set(current)
        if (liked) next.delete(id)
        else next.add(id)
        return next
      })
      setPosts((current) => current.map((item) => item.id === id
        ? { ...item, likes: [{ count: Math.max(0, (item.likes?.[0]?.count || 0) + (liked ? -1 : 1)) }] }
        : item))
      demo.setPosts((current) => current.map((item) => item.id === id
        ? { ...item, likes: [{ count: Math.max(0, (item.likes?.[0]?.count || 0) + (liked ? -1 : 1)) }] }
        : item))
      demo.setLikedPostIds((current) => liked ? current.filter((postId) => postId !== id) : [...current, id])
      return
    }
    try {
      if (likedSet.has(id)) {
        const { error } = await supabase.from('likes').delete().eq('post_id', id).eq('user_id', session.user.id)
        if (error) throw error
        setLikedSet(s => { const n = new Set(s); n.delete(id); return n })
        setPosts(ps => ps.map(p => p.id === id ? { ...p, likes: [{ count: Math.max(0, (p.likes?.[0]?.count || 1) - 1) }] } : p))
      } else {
        const { error } = await supabase.from('likes').insert({ post_id: id, user_id: session.user.id })
        if (error) throw error
        setLikedSet(s => new Set(s).add(id))
        setPosts(ps => ps.map(p => p.id === id ? { ...p, likes: [{ count: (p.likes?.[0]?.count || 0) + 1 }] } : p))
      }
    } catch (error) {
      setError(getUserFacingError(error, 'We couldn’t update your like right now. Please try again.'))
    }
  }

  const shown = tab === 'all' ? posts : posts.filter(p => followingSet.has(p.author_id))

  if (loading) return null
  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Feed</h2>
        <p>Sign in to see the community feed.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="row-between" style={{ marginBottom: 22 }}>
        <h1>Feed</h1>
        <div className="tabs">
          <button className={'tab' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>Everyone</button>
          <button className={'tab' + (tab === 'following' ? ' active' : '')} onClick={() => setTab('following')}>Following</button>
        </div>
      </header>
      {error && <p className="error-text" role="alert">{error}</p>}

      <form className="composer" onSubmit={publish}>
        <div className="composer-top">
          {session ? <Avatar profile={profile} /> : <span className="avatar">?</span>}
          <textarea
            className="input"
            rows={3}
            placeholder={session ? 'Share a production, a tip, a question…' : 'Sign in to share your work'}
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={!session}
          />
        </div>
        <div className="row-between">
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!session}
          />
          <button className="btn" type="submit" disabled={!session || !body.trim() || busy}>
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {/* The tabs show either every post or posts from followed people. */}
      {!error && shown.length === 0 && (
        <div className="panel-empty">
          {tab === 'following'
            ? 'No posts from people you follow yet — visit the People page to build your network.'
            : 'No posts yet. Be the first to share something!'}
        </div>
      )}
      {shown.map(p => (
        <PostCard key={p.id} post={p} liked={likedSet.has(p.id)} onLike={toggleLike} promptSignIn={promptSignIn} />
      ))}
    </div>
  )
}
