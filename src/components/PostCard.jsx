// Displays one feed post, its like/comment controls, and any expanded replies.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { timeAgo } from '../lib/utils'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from './Avatar'
import ReportButton from './ReportButton'
import ProfileBadges from './ProfileBadges'

export default function PostCard({ post, liked, onLike, promptSignIn }) {
  const { session, profile } = useAuth()
  const demo = useDemoData()
  const author = post.profiles || {}
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [body, setBody] = useState('')
  const [count, setCount] = useState(post.comments?.[0]?.count || 0)
  const [error, setError] = useState('')

  const likeCount = post.likes?.[0]?.count || 0
  const authorName = author.display_name || 'Unknown User'

  async function toggleComments() {
    setError('')
    if (!expanded && !loaded) {
      // Load sample replies from memory in preview mode; otherwise request them.
      if (isDemoMode) {
        setComments(demo.comments.filter((comment) => comment.post_id === post.id))
        setLoaded(true)
        setExpanded(true)
        return
      }
      try {
        const { data, error: commentsError } = await supabase
          .from('comments').select('*, profiles:author_id(id, display_name, avatar_url, staff_roles(role), profile_badges(badge))')
          .eq('post_id', post.id).order('created_at', { ascending: true })
        if (commentsError) throw commentsError
        setComments(data || [])
        setLoaded(true)
      } catch (commentsError) {
        setError(getUserFacingError(commentsError, 'We couldn’t load comments right now. Please try again.'))
        return
      }
    }
    setExpanded(!expanded)
  }

  async function submitComment(e) {
    // A new comment is added locally in preview mode, or saved to Supabase.
    e.preventDefault()
    if (!session) return promptSignIn()
    if (!body.trim()) return
    setError('')
    if (isDemoMode) {
      const comment = {
        id: 'demo-comment-' + Date.now(),
        post_id: post.id,
        author_id: session.user.id,
        body: body.trim(),
        created_at: new Date().toISOString(),
        profiles: profile,
      }
      setComments((current) => [...current, comment])
      demo.setComments((current) => [...current, comment])
      setCount((current) => current + 1)
      demo.setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, comments: [{ count: (item.comments?.[0]?.count || 0) + 1 }] }
        : item))
      setBody('')
      return
    }
    try {
      const { data, error } = await supabase.from('comments')
        .insert({ post_id: post.id, author_id: session.user.id, body: body.trim() })
        .select('*, profiles:author_id(id, display_name, avatar_url, staff_roles(role), profile_badges(badge))').single()
      if (error) throw error
      if (data) {
        setComments(c => [...c, data])
        setCount(c => c + 1)
        setBody('')
      }
    } catch (error) {
      setError(getUserFacingError(error, 'We couldn’t post your comment right now. Please try again.'))
    }
  }

  return (
    <article className="post-card">
      <div className="post-head">
        {author.id ? <Link to={'/profile/' + author.id}><Avatar profile={author} /></Link> : <Avatar profile={{ display_name: authorName }} />}
        <div>
          {author.id
            ? <Link to={'/profile/' + author.id} style={{ textDecoration: 'none' }}><div className="who">{authorName}</div></Link>
            : <div className="who">{authorName}</div>}
          {author.id && <ProfileBadges profile={author} />}
          <div className="sub">{author.id && author.role_title ? author.role_title + ' · ' : ''}{timeAgo(post.created_at)}</div>
        </div>
      </div>
      {post.title && <h3 className="post-title">{post.title}</h3>}
      <p className="post-body">{post.body}</p>
      <div className="post-actions">
        <button className={'action-btn' + (liked ? ' liked' : '')} onClick={() => onLike(post)}>
          {liked ? '\u2665' : '\u2661'} Like {likeCount > 0 && '(' + likeCount + ')'}
        </button>
        <button className="action-btn" onClick={toggleComments}>
          &#128172; Comments ({count})
        </button>
        <ReportButton targetType="post" targetId={post.id} ownerId={post.author_id} promptSignIn={promptSignIn} />
      </div>
      {expanded && (
        <div className="comments">
          {error && <p className="error-text" role="alert">{error}</p>}
          {comments.map(c => (
            <div className="comment" key={c.id}>
              <Avatar profile={c.profiles} />
              <div>
                <div className="who">{c.profiles?.id ? c.profiles.display_name || 'Unknown User' : 'Unknown User'}</div>
                {c.profiles?.id && <ProfileBadges profile={c.profiles} />}
                <div className="txt">{c.body}</div>
              </div>
              <ReportButton targetType="comment" targetId={c.id} ownerId={c.author_id} promptSignIn={promptSignIn} />
            </div>
          ))}
          {comments.length === 0 && <p className="muted" style={{ padding: '8px 0' }}>No comments yet — start the discussion.</p>}
          <form className="comment-form" onSubmit={submitComment}>
            <input
              className="input"
              placeholder={session ? 'Write a comment…' : 'Sign in to comment'}
              value={body}
              onChange={e => setBody(e.target.value)}
              disabled={!session}
            />
            <button className="btn btn-sm" type="submit" disabled={!session || !body.trim()}>Post</button>
          </form>
        </div>
      )}
    </article>
  )
}
