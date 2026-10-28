// Shows a crew member's public details, projects, and posts.
// The profile owner can edit their details and profile picture.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import Avatar from '../components/Avatar'
import ProjectCard from '../components/ProjectCard'
import PostCard from '../components/PostCard'
import { timeAgo } from '../lib/utils'
import { getUserFacingError } from '../lib/errorMessages'
import ReportButton from '../components/ReportButton'
import ProfileBadges from '../components/ProfileBadges'

export default function ProfilePage({ promptSignIn }) {
  const { id } = useParams()
  const { session, profile: myProfile, refreshProfile, updateDemoProfile } = useAuth()
  const demo = useDemoData()
  const targetId = id || session?.user?.id

  const [target, setTarget] = useState(null)
  const [projects, setProjects] = useState([])
  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ followers: 0, following: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [tab, setTab] = useState('projects')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!targetId) return
    load()
  }, [targetId, session])

  async function load() {
    setLoadError('')
    // Assemble the profile and its related activity from sample or online data.
    if (isDemoMode) {
      const person = demo.profiles.find((profile) => profile.id === targetId)
      setTarget(person || null)
      setProjects(demo.projects.filter((project) => project.creator_id === targetId))
      setPosts(demo.posts.filter((post) => post.author_id === targetId && !post.category))
      setStats({
        followers: demo.follows.filter((follow) => follow.followee_id === targetId).length,
        following: demo.follows.filter((follow) => follow.follower_id === targetId).length,
      })
      setIsFollowing(demo.follows.some((follow) => follow.follower_id === session?.user?.id && follow.followee_id === targetId))
      return
    }
    try {
      const { data: p, error: profileError } = await supabase.from('profiles')
        .select('*, staff_roles(role), profile_badges(badge)').eq('id', targetId).single()
      if (profileError) throw profileError
      setTarget(p)
      const { data: projs, error: projectsError } = await supabase.from('projects')
        .select('*, profiles:creator_id(id, display_name, role_title, avatar_url, location, staff_roles(role), profile_badges(badge))')
        .eq('creator_id', targetId).order('created_at', { ascending: false })
      if (projectsError) throw projectsError
      setProjects(projs || [])
      const { data: ps, error: postsError } = await supabase.from('posts')
        .select('*, profiles:author_id(id, display_name, role_title, avatar_url, staff_roles(role), profile_badges(badge)), likes(count), comments(count)')
        .eq('author_id', targetId).order('created_at', { ascending: false }).limit(20)
      if (postsError) throw postsError
      setPosts(ps || [])
      const { count: f1, error: followersError } = await supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', targetId)
      if (followersError) throw followersError
      const { count: f2, error: followingError } = await supabase.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', targetId)
      if (followingError) throw followingError
      setStats({ followers: f1 || 0, following: f2 || 0 })
      if (session) {
        const { data: f, error: followError } = await supabase.from('follows').select('followee_id').eq('follower_id', session.user.id).eq('followee_id', targetId).maybeSingle()
        if (followError) throw followError
        setIsFollowing(!!f)
      } else {
        setIsFollowing(false)
      }
    } catch (profileLoadError) {
      setLoadError(getUserFacingError(profileLoadError, 'We couldn’t load this profile right now. Please try again.'))
    }
  }

  const isOwn = session && targetId === session.user.id

  function openEdit() {
    // Copy the current profile into the form so edits do not appear before saving.
    setForm({
      display_name: target.display_name || '',
      username: target.username || '',
      role_title: target.role_title || '',
      location: target.location || '',
      bio: target.bio || '',
      skills: (target.skills || []).join(', '),
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    // Preview edits update only this browser's profile copy.
    if (isDemoMode) {
      const updates = {
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase() || null,
        role_title: form.role_title.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      }
      const updatedProfile = { ...target, ...updates }
      demo.setProfiles((current) => current.map((person) => person.id === targetId ? updatedProfile : person))
      updateDemoProfile(updates)
      setTarget(updatedProfile)
      setBusy(false)
      setEditing(false)
      return
    }
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase() || null,
        role_title: form.role_title.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      }).eq('id', session.user.id)
      if (error) throw error
      setEditing(false)
      await refreshProfile()
      load()
    } catch (saveError) {
      setError(getUserFacingError(saveError, 'We couldn’t save your profile right now. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleFollow() {
    if (!session) return promptSignIn()
    // Keep the follow button and follower total in step for a preview profile.
    if (isDemoMode) {
      demo.setFollows((current) => isFollowing
        ? current.filter((follow) => !(follow.follower_id === session.user.id && follow.followee_id === targetId))
        : [...current, { follower_id: session.user.id, followee_id: targetId }])
      setIsFollowing((current) => !current)
      setStats((current) => ({ ...current, followers: current.followers + (isFollowing ? -1 : 1) }))
      return
    }
    setActionError('')
    try {
      const { error: followError } = isFollowing
        ? await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('followee_id', targetId)
        : await supabase.from('follows').insert({ follower_id: session.user.id, followee_id: targetId })
      if (followError) throw followError
      load()
    } catch (followError) {
      setActionError(getUserFacingError(followError, 'We couldn’t update your connection right now. Please try again.'))
    }
  }

  if (!targetId) {
    return (
      <div className="auth-prompt">
        <h2>Your profile lives here</h2>
        <p>Sign in to view and edit your professional profile.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  if (!target) return <div className="page">{loadError ? <p className="error-text" role="alert">{loadError} <button className="clear-btn" onClick={load}>Try again</button></p> : <p className="muted">Loading profile…</p>}</div>

  return (
    <>
      {/* Profile details and connection statistics appear above the activity tabs. */}
      <div className="profile-head">
        {(loadError || actionError) && <p className="error-text" role="alert">{loadError || actionError} {loadError && <button className="clear-btn" onClick={load}>Try again</button>}</p>}
        <div className="profile-card">
          <div className="profile-top">
            <Avatar profile={target} size="lg" />
            <div className="main">
              <h1>{target.display_name || 'Unnamed user'}</h1>
              <ProfileBadges profile={target} />
              <p className="muted">
                {target.role_title && target.role_title + ' · '}
                {target.location || 'Location not set'}
                {target.username ? ' · @' + target.username : ''}
              </p>
              {target.bio && <p className="profile-bio">{target.bio}</p>}
              {(target.skills || []).length > 0 && (
                <div className="skill-chips">
                  {target.skills.map(s => <span key={s} className="role-chip">{s}</span>)}
                </div>
              )}
              <div className="profile-stats">
                <div className="stat"><b>{stats.followers}</b><span>followers</span></div>
                <div className="stat"><b>{stats.following}</b><span>following</span></div>
                <div className="stat"><b>{projects.length}</b><span>projects</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ReportButton targetType="user" targetId={target.id} ownerId={target.id} promptSignIn={promptSignIn} />
              {isOwn ? (
                <button className="btn btn-ghost btn-sm" onClick={openEdit}>Edit profile</button>
              ) : session ? (
                <button className="btn btn-sm" onClick={toggleFollow}>
                  {isFollowing ? 'Following ✓' : 'Follow'}
                </button>
              ) : (
                <button className="btn btn-sm" onClick={promptSignIn}>Follow</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Switch between projects and posts belonging to this person. */}
      <div className="profile-body">
        <div className="tabs" style={{ marginBottom: 18 }}>
          <button className={'tab' + (tab === 'projects' ? ' active' : '')} onClick={() => setTab('projects')}>
            Projects ({projects.length})
          </button>
          <button className={'tab' + (tab === 'posts' ? ' active' : '')} onClick={() => setTab('posts')}>
            Posts ({posts.length})
          </button>
        </div>

        {tab === 'projects' && (
          <>
            {projects.length === 0 && <div className="panel-empty">No projects published yet.</div>}
            <div className="grid" style={{ marginTop: 0 }}>
              {projects.map(p => (
                <ProjectCard key={p.id} p={p} saved={false} onToggleSave={() => promptSignIn()} onOpen={() => {}} promptSignIn={promptSignIn} />
              ))}
            </div>
          </>
        )}

        {tab === 'posts' && (
          <>
            {posts.length === 0 && <div className="panel-empty">No posts yet.</div>}
            {posts.map(p => (
              <PostCard key={p.id} post={p} liked={false} onLike={() => promptSignIn()} promptSignIn={promptSignIn} />
            ))}
          </>
        )}
      </div>

      {editing && form && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditing(false) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setEditing(false)} aria-label="Close">&#10005;</button>
            <h2>Edit profile</h2>
            <form onSubmit={saveEdit} style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="pf-name">Display name</label>
                <input id="pf-name" className="input" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="pf-user">Username</label>
                <input id="pf-user" className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-role">Professional role</label>
                <input id="pf-role" className="input" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} placeholder="e.g. Lighting Designer" />
              </div>
              <div className="field">
                <label htmlFor="pf-loc">Location</label>
                <input id="pf-loc" className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" />
              </div>
              <div className="field">
                <label htmlFor="pf-bio">Bio</label>
                <textarea id="pf-bio" className="input" rows={4} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-skills">Skills (comma separated)</label>
                <input id="pf-skills" className="input" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="grandMA3, Rigging, Vectorworks" />
              </div>
              <div className="field">
                <label htmlFor="pf-avatar">Avatar image</label>
                <input id="pf-avatar" className="input" type="file" accept="image/*"
                  onChange={async e => {
                    const file = e.target.files[0]
                    if (!file) return
                    if (isDemoMode) {
                      const avatar_url = URL.createObjectURL(file)
                      const updatedProfile = { ...target, avatar_url }
                      demo.setProfiles((current) => current.map((person) => person.id === targetId ? updatedProfile : person))
                      updateDemoProfile({ avatar_url })
                      setTarget(updatedProfile)
                      return
                    }
                    setBusy(true); setError('')
                    try {
                      const path = session.user.id + '/' + Date.now() + '-' + file.name
                      const { error: upErr } = await supabase.storage.from('media').upload(path, file)
                      if (upErr) throw upErr
                      const { data } = supabase.storage.from('media').getPublicUrl(path)
                      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', session.user.id)
                      if (updateError) throw updateError
                      await refreshProfile()
                      load()
                    } catch (uploadError) {
                      setError(getUserFacingError(uploadError, 'We couldn’t update your profile photo right now. Please try again.'))
                    } finally {
                      setBusy(false)
                    }
                  }} />
                <span className="hint">Uploads to the public "media" storage bucket.</span>
              </div>
              {error && <p className="error-text" role="alert">{error}</p>}
              <div className="modal-actions">
                <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
