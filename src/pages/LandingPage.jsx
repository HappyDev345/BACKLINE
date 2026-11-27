// The public introduction to BACKLINE. Demo content appears only in preview
// mode; connected mode uses public profiles and project records from Supabase.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'
import { timeAgo } from '../lib/utils'
import logo from '../../BackLine-favicon.png'
import styles from './LandingPage.module.css'

const unsplash = (id, w) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

// Example listings are shown only in preview mode.
const productions = [
  { title: 'Sydney Harbour Light Festival', type: 'Festival', date: '12–14 Mar 2027', role: 'FOH Audio & Stage Production', location: 'Circular Quay · Sydney CBD', crew: '6 crew on call', image: unsplash('photo-1670028514318-0ac718c0590d', 900) },
  { title: 'Sydney Coffee & Connect', type: 'Community meetup', date: '20 Feb 2027', role: 'Lighting & Video Systems', location: 'Martin Place · Sydney CBD', crew: '12 crew confirmed', image: unsplash('photo-1573339887617-d674bc961c31', 900) },
  { title: 'Foundry Sessions Live', type: 'Live broadcast', date: '10 Apr 2027', role: 'Multi-camera Live Production', location: 'Bondi · Sydney', crew: '4 camera positions', image: unsplash('photo-1631188769213-1f385e8544fa', 900) },
  { title: 'The Tempest', type: 'Theatre', date: '18–29 May 2027', role: 'Stage, Flys & Automation', location: 'Grand Theatre · Sydney', crew: '8 show crew', image: unsplash('photo-1744142474863-b1e2a44d530b', 900) },
]

// Example profiles are shown only in preview mode.
const crew = [
  { name: 'Marcus Reed', role: 'Sound Engineer', location: 'Northbridge, NSW', skills: ['DiGiCo', 'RF', 'System tech'], availability: 'Available Feb', experience: '11 years experience', image: unsplash('photo-1649614808550-173678d92df1', 180) },
  { name: 'Alex Chen', role: 'Lighting Designer', location: 'Alexandria, NSW', skills: ['grandMA3', 'WYSIWYG', 'Touring'], availability: 'Open to tour', experience: '8 years experience', image: unsplash('photo-1637124395515-7433c77ac4db', 180) },
  { name: 'Jamie Okafor', role: 'Camera Operator', location: 'Coogee, NSW', skills: ['Sony FX9', 'Jib', 'Broadcast'], availability: 'Freelance', experience: '12 years experience', image: unsplash('photo-1711473610014-0505db6f6702', 180) },
  { name: 'Maya Bennett', role: 'Stage Manager', location: 'Parramatta, NSW', skills: ['Show calling', 'Arena', 'Theatre'], availability: 'Available now', experience: '9 years experience', image: unsplash('photo-1635352210867-ad9cf78e00a1', 180) },
  { name: 'Jordan Ellis', role: 'Event Producer', location: 'Castle Hill, NSW', skills: ['Festivals', 'Budgets', 'Crewing'], availability: 'Booking Q2', experience: '14 years experience', image: unsplash('photo-1682617367187-232f65e6e5df', 180) },
]

// Example calls are shown only in preview mode.
const calls = [
  { department: 'Lighting', title: 'Lighting crew needed for a festival', location: 'Northbridge, NSW', date: 'Open, 12–14 Mar 2027', rate: 'A$320 / day', skills: ['grandMA3', 'IPAF', 'Outdoor'] },
  { department: 'Video', title: 'Camera operator required for a live broadcast', location: 'Alexandria, NSW', date: 'Open, 10 Apr 2027', rate: 'A$400 / day', skills: ['Sony', 'Long lens', 'Comms'] },
  { department: 'Audio', title: 'Monitor engineer needed for a touring show', location: 'UK & EU tour', date: 'Open, 21 Mar–18 Apr 2027', rate: 'A$450 / day', skills: ['DiGiCo', 'IEM', 'EU passport'] },
]

// Example discussion titles are shown only in preview mode.
const discussions = [
  { category: 'Sound', title: 'How are you handling RF coordination at multi-stage festivals?', meta: 'Sample thread · Join to reply' },
  { category: 'Lighting', title: 'grandMA3 show-file workflows that survive a tour', meta: 'Sample thread · Join to reply' },
  { category: 'Stage', title: 'Cue-calling tips for a first run in a new venue', meta: 'Sample thread · Join to reply' },
  { category: 'Video', title: 'Comms and camera routing for small broadcast crews', meta: 'Sample thread · Join to reply' },
]

function formatProductionDate(date) {
  if (!date) return 'DATE TBC'
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00`)).toUpperCase()
}

export default function LandingPage({ onSignIn }) {
  const { session } = useAuth()
  const [liveProductions, setLiveProductions] = useState([])
  const [productionsLoading, setProductionsLoading] = useState(!isDemoMode)
  const [productionsError, setProductionsError] = useState('')
  const [liveCrew, setLiveCrew] = useState([])
  const [crewLoading, setCrewLoading] = useState(!isDemoMode)
  const [crewError, setCrewError] = useState('')
  const [liveCalls, setLiveCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(!isDemoMode)
  const [callsError, setCallsError] = useState('')
  const [liveDiscussions, setLiveDiscussions] = useState([])
  const [discussionsLoading, setDiscussionsLoading] = useState(!isDemoMode)
  const [discussionsError, setDiscussionsError] = useState('')

  useEffect(() => {
    if (isDemoMode) return

    let cancelled = false

    async function loadProductions() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, type, event_date, roles, location, created_at')
          .order('created_at', { ascending: false })
          .limit(4)

        if (cancelled) return
        if (error) {
          setProductionsError(getUserFacingError(error, 'We couldn’t load featured productions right now. Please try again later.'))
          setProductionsLoading(false)
          return
        }
        if (!data) {
          setProductionsError('We couldn’t load featured productions right now. Please try again later.')
          setProductionsLoading(false)
          return
        }

        setLiveProductions(data)
        setProductionsLoading(false)
      } catch (error) {
        if (cancelled) return
        setProductionsError(getUserFacingError(error, 'We couldn’t load featured productions right now. Please try again later.'))
        setProductionsLoading(false)
      }
    }

    async function loadCrew() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, role_title, location, skills, avatar_url')
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error
        if (!cancelled) setLiveCrew(data || [])
      } catch (error) {
        if (!cancelled) setCrewError(getUserFacingError(error, 'We couldn’t load crew profiles right now. Please try again later.'))
      } finally {
        if (!cancelled) setCrewLoading(false)
      }
    }

    async function loadCalls() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, type, event_date, roles, location, compensation, created_at')
          .order('created_at', { ascending: false })
          .limit(3)

        if (error) throw error
        if (!cancelled) setLiveCalls(data || [])
      } catch (error) {
        if (!cancelled) setCallsError(getUserFacingError(error, 'We couldn’t load crew calls right now. Please try again later.'))
      } finally {
        if (!cancelled) setCallsLoading(false)
      }
    }

    async function loadDiscussions() {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id, category, title, body, created_at, comments(count)')
          .not('category', 'is', null)
          .order('created_at', { ascending: false })
          .limit(4)

        if (error) throw error
        if (!cancelled) setLiveDiscussions(data || [])
      } catch (error) {
        if (!cancelled) setDiscussionsError(getUserFacingError(error, 'We couldn’t load discussions right now. Please try again later.'))
      } finally {
        if (!cancelled) setDiscussionsLoading(false)
      }
    }

    loadProductions()
    loadCrew()
    loadCalls()
    loadDiscussions()
    return () => { cancelled = true }
  }, [])

  const featuredProductions = isDemoMode ? productions : liveProductions
  const featuredCrew = isDemoMode ? crew : liveCrew
  const featuredCalls = isDemoMode ? calls : liveCalls
  const featuredDiscussions = isDemoMode ? discussions : liveDiscussions

  return (
    <div className={styles.home} id="top">
      <main>
        {/* Introduce the service and give visitors a direct route into projects or sign-up. */}
        <section className={styles.hero}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>The community behind every live show.</h1>
              <p className={styles.heroDescription}>Find crew, find work and ask questions of the sound engineers, lighting technicians, camera operators, stage managers and producers who run live events.</p>
              <div className={styles.heroActions}>
                <a className={`${styles.button} ${styles.primary}`} href="#productions">Browse productions</a>
                {session
                  ? <Link className={`${styles.button} ${styles.secondary}`} to="/profile">Your crew profile</Link>
                  : <button className={`${styles.button} ${styles.secondary}`} onClick={() => onSignIn('up')}>Create a crew profile</button>}
              </div>
            </div>
            <figure className={styles.heroFigure}>
              <img className={styles.heroImage} src={unsplash('photo-1606150119193-69ed87009dcf', 1200)} alt="Production professional working at a live show" />
              <figcaption>Front of house, Sydney CBD. Stock photo.</figcaption>
            </figure>
          </div>
          <p className={`${styles.container} ${styles.disciplines}`}>Concerts, festivals, theatre, corporate events and broadcast.</p>
        </section>

        {/* Preview cards stay illustrative; live mode reads public projects from Supabase. */}
        <section className={styles.section} id="productions">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div><h2 className={styles.sectionTitle}>Featured live productions</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Sample shows and listings that bring live productions together.' : 'Recent crew calls posted by the community.'}</p></div>
              <Link className={styles.textLink} to="/discover">Explore all projects</Link>
            </div>
            <div className={styles.gigGrid}>
              {productionsLoading && <p className={styles.productionsMessage} role="status">Loading featured productions…</p>}
              {productionsError && <p className={styles.productionsMessage} role="alert">{productionsError}</p>}
              {!isDemoMode && !productionsLoading && !productionsError && featuredProductions.length === 0 && (
                <p className={styles.productionsMessage}>No productions have been posted yet. Check back soon or explore all projects.</p>
              )}
              {featuredProductions.map((production, index) => {
                const demoProduction = isDemoMode
                const roles = demoProduction ? production.role : (production.roles || []).join(' · ') || 'No crew roles listed'
                const date = demoProduction ? production.date : formatProductionDate(production.event_date)
                const location = demoProduction ? production.location : production.location || 'Location TBC'

                return (
                  <article className={styles.gigCard} key={production.id || production.title}>
                    <div className={styles.gigImageWrap}>
                      {demoProduction
                        ? <img className={styles.gigImage} src={production.image} alt={`${production.title} production`} loading="lazy" />
                        : <div className={styles.productionPlaceholder} aria-hidden="true">BACKLINE</div>}
                      <span className={styles.categoryPill}>{production.type}</span>
                      <span className={styles.gigDate}>{date}</span>
                    </div>
                    <div className={styles.gigBody}>
                      <div className={styles.gigRole}>{roles}</div>
                      <h3 className={styles.gigTitle}>{production.title}</h3>
                      <div className={styles.venueName}>{location}</div>
                      <div className={styles.gigFooter}>
                        <span className={styles.crewChip}>{demoProduction ? production.crew : `${production.roles?.length || 0} roles listed`}</span>
                        <Link className={styles.viewShow} to="/discover">View show</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTinted}`} id="crew">
          <div className={styles.container}>
            <div className={styles.sectionHead}><div><h2 className={styles.sectionTitle}>Featured crew</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Example profiles showing crew skills, specialties, and availability.' : 'Crew profiles from the BACKLINE community.'}</p></div><Link className={styles.textLink} to="/people">Find crew</Link></div>
            <div className={styles.crewGrid}>
              {!isDemoMode && crewLoading && <p className={styles.productionsMessage} role="status">Loading crew profiles…</p>}
              {!isDemoMode && crewError && <p className={styles.productionsMessage} role="alert">{crewError}</p>}
              {!isDemoMode && !crewLoading && !crewError && featuredCrew.length === 0 && <p className={styles.productionsMessage}>No crew profiles yet. Be one of the first to join the community.</p>}
              {featuredCrew.map((person) => {
                const demoPerson = isDemoMode
                const name = demoPerson ? person.name : person.display_name || 'Unnamed crew member'
                const profile = demoPerson
                  ? { display_name: person.name, avatar_url: person.image }
                  : person

                return (
                  <article className={styles.crewCard} key={person.id || name}>
                    <div className={styles.crewTop}><div className={styles.portraitWrap}><Avatar profile={profile} size="lg" /></div>{demoPerson && <span className={styles.availability}>{person.availability}</span>}</div>
                    <div className={styles.crewInfo}><h3 className={styles.crewName}>{name}</h3><div className={styles.crewRole}>{demoPerson ? person.role : person.role_title || 'Crew member'}</div><div className={styles.crewLocation}>{person.location || 'Location not set'}</div><div className={styles.skillList}>{(person.skills || []).map(skill => <span key={skill}>{skill}</span>)}</div></div>
                    <div className={styles.crewBottom}><span>{demoPerson ? person.experience : 'Crew profile'}</span><Link className={styles.profileAction} to={demoPerson ? '/people' : `/profile/${person.id}`}>View profile</Link></div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={styles.section} id="calls">
          <div className={styles.container}>
            <div className={styles.sectionHead}><div><h2 className={styles.sectionTitle}>Example crew calls</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Illustrative listings of the work BACKLINE is designed to help crews find.' : 'Recent opportunities posted by the BACKLINE community.'}</p></div><Link className={styles.textLink} to="/discover">Browse projects</Link></div>
            <div className={styles.callsList}>
              {!isDemoMode && callsLoading && <p className={styles.productionsMessage} role="status">Loading crew calls…</p>}
              {!isDemoMode && callsError && <p className={styles.productionsMessage} role="alert">{callsError}</p>}
              {!isDemoMode && !callsLoading && !callsError && featuredCalls.length === 0 && <p className={styles.productionsMessage}>No crew calls yet. Check back soon or browse all projects.</p>}
              {featuredCalls.map((call) => {
                const demoCall = isDemoMode
                const callSkills = demoCall ? call.skills : call.roles || []

                return (
                  <article className={styles.callCard} key={call.id || call.title}>
                    <div className={styles.callDepartment}>{demoCall ? call.department : (call.type || 'Crew call')}</div>
                    <div className={styles.callMain}><h3 className={styles.callTitle}>{call.title}</h3><div className={styles.callDetails}><span>{call.location || 'Location TBC'}</span><span>{demoCall ? call.date : formatProductionDate(call.event_date)}</span><strong>{demoCall ? call.rate : call.compensation || 'Rate TBC'}</strong></div><div className={`${styles.skillList} ${styles.callSkills}`}>{callSkills.length > 0 ? callSkills.map(skill => <span key={skill}>{skill}</span>) : <span>Roles not listed</span>}</div></div>
                    <Link className={`${styles.button} ${styles.secondary} ${styles.callAction}`} to="/discover">View call</Link>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={styles.section} id="forum">
          <div className={`${styles.container} ${styles.forumLayout}`}>
            <div className={styles.forumIntro}><h2 className={styles.sectionTitle}>Practical answers from people on the ground.</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Ask questions, compare workflows, and learn from people who understand the pressure of show day.' : 'Recent questions and knowledge shared by the BACKLINE community.'}</p><Link className={`${styles.button} ${styles.secondary}`} to="/forum">Join the discussion</Link></div>
            <div className={styles.discussionList}>
              {!isDemoMode && discussionsLoading && <p className={styles.productionsMessage} role="status">Loading discussions…</p>}
              {!isDemoMode && discussionsError && <p className={styles.productionsMessage} role="alert">{discussionsError}</p>}
              {!isDemoMode && !discussionsLoading && !discussionsError && featuredDiscussions.length === 0 && <p className={styles.productionsMessage}>No discussions yet. Start the first conversation in the forum.</p>}
              {featuredDiscussions.map((discussion) => {
                const demoDiscussion = isDemoMode
                const title = demoDiscussion ? discussion.title : discussion.title || discussion.body
                const meta = demoDiscussion
                  ? discussion.meta
                  : `${discussion.comments?.[0]?.count || 0} replies · ${timeAgo(discussion.created_at)}`

                return (
                  <Link className={styles.discussionCard} to="/forum" key={discussion.id || title}>
                    <span className={styles.discussionTag}>{discussion.category}</span>
                    <strong className={styles.discussionTitle}>{title}</strong>
                    <span className={styles.discussionMeta}>{meta}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Repeat the invitation at the bottom for visitors who reach the footer. */}
        <section className={styles.ctaSection}>
          <div className={`${styles.container} ${styles.ctaInner}`}><h2 className={styles.ctaTitle}>Find your people. Build the show.</h2><p className={styles.ctaCopy}>Join the backstage network built for the people who make live events possible.</p>{session ? <Link className={`${styles.button} ${styles.light}`} to="/feed">Open the community</Link> : <button className={`${styles.button} ${styles.light}`} onClick={() => onSignIn('up')}>Join BACKLINE</button>}</div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Link to="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><img src={logo} alt="" /></span>BACKLINE</Link>
          <div className={styles.footerLinks}>
            {session ? (
              <>
                <Link to="/feed">Community</Link><Link to="/discover">Projects</Link><Link to="/people">People</Link><Link to="/forum">Forum</Link>
              </>
            ) : (
              <>
                <Link to="/about">About</Link><Link to="/discover">Discover</Link>
              </>
            )}
          </div>
          <span className={styles.footerNote}>The community behind every live show.</span>
        </div>
      </footer>
    </div>
  )
}
