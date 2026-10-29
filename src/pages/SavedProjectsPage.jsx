// Lists the signed-in member's saved projects in preview and connected modes.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { getUserFacingError } from '../lib/errorMessages'
import ProjectCard from '../components/ProjectCard'
import ProjectModal from '../components/ProjectModal'

export default function SavedProjectsPage({ promptSignIn }) {
  const { session, loading: authLoading } = useAuth()
  const { projects: demoProjects, savedProjects: demoSavedProjects, setSavedProjects } = useDemoData()
  const [projects, setProjects] = useState([])
  const [loadedUserId, setLoadedUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingProjectIds, setSavingProjectIds] = useState(new Set())
  const [open, setOpen] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const userId = session?.user?.id
  const projectsLoading = loading || loadedUserId !== userId

  useEffect(() => {
    let cancelled = false

    async function loadSavedProjects() {
      setError('')
      setActionError('')
      if (!userId) {
        setProjects([])
        setLoadedUserId(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        if (isDemoMode) {
          const projectById = new Map(demoProjects.map((project) => [project.id, project]))
          const savedIds = demoSavedProjects
            .filter((save) => save.user_id === userId)
            .map((save) => save.project_id)
          if (!cancelled) {
            setProjects(savedIds.map((id) => projectById.get(id)).filter(Boolean))
            setLoadedUserId(userId)
          }
          return
        }

        const { data: saves, error: savesError } = await supabase
          .from('saved_projects')
          .select('project_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        if (savesError) throw savesError
        const savedIds = (saves || []).map((save) => save.project_id)
        if (savedIds.length === 0) {
          if (!cancelled) {
            setProjects([])
            setLoadedUserId(userId)
          }
          return
        }

        const { data: savedProjects, error: projectsError } = await supabase
          .from('projects')
          .select('*, profiles:creator_id(id, display_name, role_title, avatar_url, location, staff_roles(role), profile_badges(badge))')
          .in('id', savedIds)
        if (projectsError) throw projectsError
        const projectById = new Map((savedProjects || []).map((project) => [project.id, project]))
        if (!cancelled) {
          setProjects(savedIds.map((id) => projectById.get(id)).filter(Boolean))
          setLoadedUserId(userId)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProjects([])
          setLoadedUserId(userId)
          setError(getUserFacingError(loadError, 'We couldn’t load your saved projects right now. Please try again.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSavedProjects()
    return () => { cancelled = true }
  }, [userId, demoProjects, demoSavedProjects, reloadKey])

  async function unsaveProject(id) {
    if (!userId || savingProjectIds.has(id)) return
    setActionError('')
    setSavingProjectIds((current) => new Set(current).add(id))
    try {
      if (isDemoMode) {
        setSavedProjects((current) => current.filter((save) => !(save.user_id === userId && save.project_id === id)))
      } else {
        const { error: saveError } = await supabase
          .from('saved_projects')
          .delete()
          .eq('project_id', id)
          .eq('user_id', userId)
        if (saveError) throw saveError
      }
      setProjects((current) => current.filter((project) => project.id !== id))
    } catch (saveError) {
      setActionError(getUserFacingError(saveError, 'We couldn’t remove this saved project. Please try again.'))
    } finally {
      setSavingProjectIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  if (authLoading) {
    return <div className="page"><p className="muted" role="status">Loading your saved projects…</p></div>
  }

  if (!session) {
    return (
      <div className="auth-prompt">
        <h2>Saved projects</h2>
        <p>Sign in to see the projects you’ve saved.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={promptSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="row-between" style={{ marginBottom: 22 }}>
        <div>
          <h1>Saved projects</h1>
          <p className="muted" style={{ marginTop: 6 }}>Opportunities you’ve bookmarked for later.</p>
        </div>
      </header>
      {actionError && <p className="error-text" role="alert">{actionError}</p>}
      {projectsLoading && <p className="muted" role="status">Loading your saved projects…</p>}
      {!projectsLoading && error && (
        <p className="error-text" role="alert">
          {error} <button className="clear-btn" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
        </p>
      )}
      {!projectsLoading && !error && projects.length === 0 && (
        <div className="empty">
          <h3>No saved projects yet</h3>
          <p>Save an opportunity from Discover and it’ll be waiting here.</p>
          <Link className="btn" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }} to="/discover">Explore projects</Link>
        </div>
      )}
      {!projectsLoading && !error && projects.length > 0 && (
        <main className="grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              p={project}
              saved
              saving={savingProjectIds.has(project.id)}
              onToggleSave={unsaveProject}
              onOpen={setOpen}
              promptSignIn={promptSignIn}
            />
          ))}
        </main>
      )}
      {open && <ProjectModal p={open} onClose={() => setOpen(null)} promptSignIn={promptSignIn} />}
    </div>
  )
}
