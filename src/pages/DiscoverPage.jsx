// Lets visitors browse, search, filter, save, and publish crew opportunities.
// Sample projects are used without Supabase; connected projects are loaded online.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { useDemoData } from '../context/DemoContext'
import { getUserFacingError } from '../lib/errorMessages'
import ProjectCard from '../components/ProjectCard'
import ProjectModal from '../components/ProjectModal'

const TYPES = ['Live Event', 'Film', 'Music', 'Photography', 'Other']

const emptyForm = {
  title: '', type: 'Live Event', location: '', event_date: '',
  compensation: 'Paid', spots: 1, roles: '', tags: '', description: '',
}

export default function DiscoverPage({ promptSignIn }) {
  const { session, profile } = useAuth()
  const demo = useDemoData()
  const [projects, setProjects] = useState([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('newest')
  const [savedSet, setSavedSet] = useState(new Set())
  const [open, setOpen] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  async function load() {
    setLoadError('')
    // Build the project list and saved markers from either sample or online data.
    if (isDemoMode) {
      setProjects(demo.projects)
      setSavedSet(new Set(demo.savedProjects.filter((item) => item.user_id === session?.user?.id).map((item) => item.project_id)))
      return
    }
    try {
      const { data, error: projectsError } = await supabase
        .from('projects')
        .select('*, profiles:creator_id(id, display_name, role_title, avatar_url, location)')
        .order('created_at', { ascending: false })
      if (projectsError) throw projectsError
      setProjects(data || [])
      if (session) {
        const { data: saved, error: savedError } = await supabase.from('saved_projects').select('project_id').eq('user_id', session.user.id)
        if (savedError) throw savedError
        setSavedSet(new Set((saved || []).map(r => r.project_id)))
      }
    } catch (loadError) {
      setLoadError(getUserFacingError(loadError, 'We couldn’t load projects right now. Please try again.'))
    }
  }

  useEffect(() => { load() }, [session])

  // Derive available filter choices from the projects currently loaded.
  const roleOptions = useMemo(() => [...new Set(projects.flatMap(p => p.roles || []))].sort(), [projects])
  const locationOptions = useMemo(() => [...new Set(projects.map(p => p.location).filter(Boolean))].sort(), [projects])

  // Search, filters, and sorting only change what is shown, not the source list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = projects.filter(p => {
      const hay = [p.title, p.description, p.location, ...(p.roles || []), ...(p.tags || [])].join(' ').toLowerCase()
      return (!q || hay.includes(q)) &&
        (!type || p.type === type) &&
        (!role || (p.roles || []).includes(role)) &&
        (!location || p.location === location)
    })
    if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [projects, query, type, role, location, sort])

  const filtersActive = query || type || role || location
  const clearFilters = () => { setQuery(''); setType(''); setRole(''); setLocation('') }

  async function toggleSave(id) {
    if (!session) return promptSignIn()
    setActionError('')
    // In preview, update only this browser's temporary sample list.
    if (isDemoMode) {
      const isSaved = savedSet.has(id)
      setSavedSet((current) => {
        const next = new Set(current)
        if (isSaved) next.delete(id)
        else next.add(id)
        return next
      })
      demo.setSavedProjects((current) => isSaved
        ? current.filter((item) => !(item.user_id === session.user.id && item.project_id === id))
        : [...current, { user_id: session.user.id, project_id: id }])
      return
    }
    try {
      if (savedSet.has(id)) {
        const { error: saveError } = await supabase.from('saved_projects').delete().eq('project_id', id).eq('user_id', session.user.id)
        if (saveError) throw saveError
        setSavedSet(s => { const n = new Set(s); n.delete(id); return n })
      } else {
        const { error: saveError } = await supabase.from('saved_projects').insert({ project_id: id, user_id: session.user.id })
        if (saveError) throw saveError
        setSavedSet(s => new Set(s).add(id))
      }
    } catch (saveError) {
      setActionError(getUserFacingError(saveError, 'We couldn’t update your saved projects. Please try again.'))
    }
  }

  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function createProject(e) {
    e.preventDefault()
    if (!session) return promptSignIn()
    setBusy(true); setError('')
    // Turn comma-separated form entries into the lists expected by the project.
    const split = s => s.split(',').map(x => x.trim()).filter(Boolean)
    if (isDemoMode) {
      const project = {
        id: 'demo-project-' + Date.now(),
        creator_id: session.user.id,
        title: form.title.trim(),
        type: form.type,
        location: form.location.trim(),
        event_date: form.event_date || null,
        compensation: form.compensation,
        spots: parseInt(form.spots, 10) || 1,
        roles: split(form.roles),
        tags: split(form.tags),
        description: form.description.trim(),
        created_at: new Date().toISOString(),
        profiles: profile,
      }
      demo.setProjects((current) => [project, ...current])
      setProjects((current) => [project, ...current])
      setShowNew(false)
      setForm(emptyForm)
      setBusy(false)
      return
    }
    try {
      const { error } = await supabase.from('projects').insert({
        creator_id: session.user.id,
        title: form.title.trim(),
        type: form.type,
        location: form.location.trim(),
        event_date: form.event_date || null,
        compensation: form.compensation,
        spots: parseInt(form.spots) || 1,
        roles: split(form.roles),
        tags: split(form.tags),
        description: form.description.trim(),
      })
      if (error) {
        setError(getUserFacingError(error, 'We couldn’t publish this project right now. Please try again.'))
        return
      }
      setShowNew(false)
      setForm(emptyForm)
      load()
    } catch (publishError) {
      setError(getUserFacingError(publishError, 'We couldn’t publish this project right now. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="hero">
        <h1>Find your next <em>production</em></h1>
        <p>Search gigs, collaborations and crew calls across live events, film, music and photography.</p>
      </header>

      <div className="page" style={{ paddingTop: 24 }}>
        {loadError && <p className="error-text" role="alert">{loadError} <button className="clear-btn" onClick={load}>Try again</button></p>}
        {actionError && <p className="error-text" role="alert">{actionError}</p>}
        {/* Search and dropdowns narrow the project cards below. */}
        <section className="toolbar" aria-label="Search and filters">
          <div className="row-between">
            <div className="search-box" style={{ maxWidth: 480, width: '100%' }}>
              <input type="search" placeholder="Search projects, skills, keywords…"
                value={query} onChange={e => setQuery(e.target.value)} aria-label="Search projects" />
            </div>
            <button className="btn" onClick={() => session ? setShowNew(true) : promptSignIn()}>+ New project</button>
          </div>
          <div className="filter-row">
            <span className="filter-label">Filter</span>
            <select className="input" style={{ width: 'auto' }} aria-label="Type" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Type: All</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} aria-label="Role" value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Role: All</option>
              {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} aria-label="Location" value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">Location: All</option>
              {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span className="filter-label" style={{ marginLeft: 8 }}>Sort</span>
            <select className="input" style={{ width: 'auto' }} aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
            </select>
            {filtersActive && <button className="clear-btn" onClick={clearFilters}>Clear all</button>}
          </div>
        </section>

        {!loadError && <p className="results-line" role="status">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
          {session && savedSet.size > 0 ? ' · ' + savedSet.size + ' saved' : ''}
        </p>}

        {/* These cards open the project details window when selected. */}
        <main className="grid">
          {!loadError && filtered.length === 0 && (
            <div className="empty">
              <h3>No projects match those filters</h3>
              <p>Try broadening your search, or publish the project you are looking for.</p>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={clearFilters}>Clear filters</button>
            </div>
          )}
          {filtered.map(p => (
            <ProjectCard key={p.id} p={p} saved={savedSet.has(p.id)} onToggleSave={toggleSave} onOpen={setOpen} />
          ))}
        </main>
      </div>

      {/* Keep each window outside the grid so it can cover the full screen. */}
      {open && <ProjectModal p={open} onClose={() => setOpen(null)} promptSignIn={promptSignIn} />}

      {showNew && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setShowNew(false)} aria-label="Close">&#10005;</button>
            <h2>Publish a project</h2>
            <form onSubmit={createProject}>
              <div className="field">
                <label htmlFor="np-title">Title</label>
                <input id="np-title" className="input" value={form.title} onChange={setField('title')} required maxLength={140} />
              </div>
              <div className="field">
                <label htmlFor="np-desc">Description</label>
                <textarea id="np-desc" className="input" rows={4} value={form.description} onChange={setField('description')} required />
              </div>
              <div className="row-between" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label htmlFor="np-type">Type</label>
                  <select id="np-type" className="input" value={form.type} onChange={setField('type')}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label htmlFor="np-comp">Compensation</label>
                  <select id="np-comp" className="input" value={form.compensation} onChange={setField('compensation')}>
                    <option>Paid</option><option>Volunteer</option><option>Expenses covered</option>
                  </select>
                </div>
                <div className="field" style={{ width: 100 }}>
                  <label htmlFor="np-spots">Spots</label>
                  <input id="np-spots" className="input" type="number" min="1" value={form.spots} onChange={setField('spots')} />
                </div>
              </div>
              <div className="row-between" style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1, minWidth: 160 }}>
                  <label htmlFor="np-loc">Location</label>
                  <input id="np-loc" className="input" value={form.location} onChange={setField('location')} placeholder="City, State" required />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label htmlFor="np-date">Date</label>
                  <input id="np-date" className="input" type="date" value={form.event_date} onChange={setField('event_date')} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="np-roles">Roles needed (comma separated)</label>
                <input id="np-roles" className="input" value={form.roles} onChange={setField('roles')} placeholder="Lighting, Audio, Camera" required />
              </div>
              <div className="field">
                <label htmlFor="np-tags">Tags (comma separated)</label>
                <input id="np-tags" className="input" value={form.tags} onChange={setField('tags')} placeholder="Festival, Night shoot" />
              </div>
              {error && <p className="error-text" role="alert">{error}</p>}
              <div className="modal-actions">
                <button className="btn" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish project'}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
