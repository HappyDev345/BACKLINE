// The public introduction to BACKLINE. Demo content appears only in preview
// mode; connected mode uses public profiles and project records from Supabase.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode, supabase } from '../lib/supabase'
import { getUserFacingError } from '../lib/errorMessages'
import Avatar from '../components/Avatar'
import { timeAgo } from '../lib/utils'
import logo from '../../BackLine-logo.png'
import styles from './LandingPage.module.css'

// Example listings are shown only in preview mode.
const productions = [
  {
    title: 'Sydney Harbour Light Festival',
    type: 'Festival',
    date: '12–14 NOV 2026',
    role: 'FOH Audio & Stage Production',
    location: 'Circular Quay · Sydney',
    crew: '6 crew on call',
    image: 'https://images.unsplash.com/photo-1670028514318-0ac718c0590d?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Sydney Coffee & Connect',
    type: 'Community meetup',
    date: '28 NOV 2026',
    role: 'Lighting & Video Systems',
    location: 'Martin Place · Sydney',
    crew: '12 crew confirmed',
    image: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Foundry Sessions Live',
    type: 'Live broadcast',
    date: '06 DEC 2026',
    role: 'Multi-camera Live Production',
    location: 'Bondi · Sydney',
    crew: '4 camera positions',
    image: 'https://images.unsplash.com/photo-1631188769213-1f385e8544fa?auto=format&fit=crop&w=900&q=80',
  },
]

const crew = [
  { name: 'Marcus Reed', role: 'FOH Engineer', location: 'Sydney, NSW', skills: ['D live', 'Touring', 'RF'], image: 'https://images.unsplash.com/photo-1649614808550-173678d92df1?auto=format&fit=crop&w=180&q=80', tone: 'blue' },
  { name: 'Alex Chen', role: 'Lighting Designer', location: 'Alexandria, NSW', skills: ['grandMA3', 'WYSIWYG', 'Touring'], image: 'https://images.unsplash.com/photo-1637124395515-7433c77ac4db?auto=format&fit=crop&w=180&q=80', tone: 'purple' },
  { name: 'Jamie Okafor', role: 'Camera Operator', location: 'Coogee, NSW', skills: ['Sony FX9', 'Jib', 'Broadcast'], image: 'https://images.unsplash.com/photo-1711473610014-0505db6f6702?auto=format&fit=crop&w=180&q=80', tone: 'orange' },
]

// Example calls are shown only in preview mode.
const calls = [
  { department: 'LIGHTING', title: 'Lighting crew needed for a festival', location: 'Sydney, NSW', date: '12–14 Nov 2026', rate: 'A$450 / day', skills: ['grandMA3', 'IPAF', 'Outdoor'], tone: 'purple' },
  { department: 'VIDEO', title: 'Camera operator required for a live broadcast', location: 'Alexandria, NSW', date: '06 Dec 2026', rate: 'A$400 / day', skills: ['Sony', 'Long lens', 'Comms'], tone: 'orange' },
  { department: 'AUDIO', title: 'Monitor engineer needed for a touring show', location: 'UK & EU tour', date: '10–18 Dec 2026', rate: 'Tour rate', skills: ['DiGiCo', 'IEM', 'EU passport'], tone: 'blue' },
]

// Example discussion titles are shown only in preview mode.
const discussions = [
  { category: 'AUDIO & SIGNAL', title: 'Best way to prep an RF coordination file for a festival?', replies: '18 replies', time: '2h ago', tone: 'blue' },
  { category: 'LIGHTING & CONTROL', title: 'Showfile handover tips when joining a touring rig', replies: '12 replies', time: '5h ago', tone: 'purple' },
  { category: 'VIDEO & PROJECTION', title: 'Reliable backup workflow for playback on show day', replies: '9 replies', time: '1d ago', tone: 'orange' },
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
          .limit(3)

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
          .limit(3)

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
          .limit(3)

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
          <div className={`${styles.heroGlow} ${styles.heroGlowOne}`} />
          <div className={`${styles.heroGlow} ${styles.heroGlowTwo}`} />
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}><span className={styles.liveDot} /> Built by crew, for crew</div>
              <h1 className={styles.heroTitle}>The community behind <span className={styles.gradientText}>every live show.</span></h1>
              <p className={styles.heroDescription}>Connect with the sound engineers, lighting technicians, camera operators, stage managers and producers who bring live events to life.</p>
              <div className={styles.heroActions}>
                <a className={`${styles.button} ${styles.primary}`} href="#productions">Explore live work <span aria-hidden="true">→</span></a>
                {session
                  ? <Link className={`${styles.button} ${styles.secondary}`} to="/profile">Your crew profile</Link>
                  : <button className={`${styles.button} ${styles.secondary}`} onClick={onSignIn}>Create your crew profile</button>}
              </div>
              <div className={styles.heroProof}>
                {isDemoMode && <div className={styles.avatarStack} aria-hidden="true">
                  {crew.map(person => <img key={person.name} src={person.image} alt="" />)}
                </div>}
                <div><strong>Made for live-event professionals</strong><span>from first call to final cue</span></div>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.heroImageWrap}>
                <img className={styles.heroImage} src="https://images.unsplash.com/photo-1606150119193-69ed87009dcf?auto=format&fit=crop&w=1200&q=85" alt="Production crew working at a live show" />
                <div className={styles.imageShade} />
                {isDemoMode && <>
                  <div className={styles.imageLabel}><span>MAIN STAGE · SHOW FILE</span><strong>SYDNEY CBD</strong></div>
                  <div className={styles.liveBadge}><span /> SHOW LIVE</div>
                </>}
                <div className={styles.productionLabels}><span>SOUND</span><span>LIGHTING</span><span>VIDEO</span><span>STAGE</span></div>
              </div>
              {isDemoMode && <>
                <Link to="/discover" className={`${styles.floatingCard} ${styles.floatingProject}`}>
                  <span className={`${styles.floatingIcon} ${styles.purple}`}>✦</span>
                  <span><small>CREW CALL MATCH</small><strong>Lighting tech · Sydney</strong></span>
                  <span aria-hidden="true">›</span>
                </Link>
                <div className={`${styles.floatingCard} ${styles.floatingCrew}`}>
                  <div className={styles.miniAvatars}>{crew.slice(0, 2).map(person => <img key={person.name} src={person.image} alt="" />)}</div>
                  <span><strong>All departments</strong><small>on comms for this show</small></span>
                </div>
              </>}
            </div>
          </div>
          <div className={`${styles.container} ${styles.disciplineBar}`}><span>LIVE WORK ACROSS</span><strong>Concerts</strong><i /><strong>Festivals</strong><i /><strong>Theatre</strong><i /><strong>Corporate</strong><i /><strong>Broadcast</strong></div>
        </section>

        {/* Preview cards stay illustrative; live mode reads public projects from Supabase. */}
        <section className={styles.section} id="productions">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div><div className={styles.sectionKicker}>ON THE CALL SHEET</div><h2 className={styles.sectionTitle}>Featured live productions</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Example call-sheet previews. Browse current projects from the community.' : 'Recent crew calls posted by the community.'}</p></div>
              <Link className={styles.textLink} to="/discover">Explore all projects <span aria-hidden="true">→</span></Link>
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
                        ? <img className={styles.gigImage} src={production.image} alt="" loading="lazy" />
                        : <div className={styles.productionPlaceholder} aria-hidden="true">BACKLINE</div>}
                      <div className={styles.gigGradient} />
                      <span className={`${styles.categoryPill} ${styles[`category${index}`]}`}>{production.type}</span>
                      <span className={styles.gigDate}>{date}</span>
                    </div>
                    <div className={styles.gigBody}>
                      <div className={styles.gigRole}>{roles}</div>
                      <h3 className={styles.gigTitle}>{production.title}</h3>
                      <div className={styles.venueName}>{location}</div>
                      <div className={styles.gigFooter}>
                        <span className={styles.crewChip}><span className={styles.crewOrb}>♧</span>{demoProduction ? production.crew : `${production.roles?.length || 0} roles listed`}</span>
                        <Link className={styles.viewShow} to="/discover">Explore <span aria-hidden="true">›</span></Link>
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
            <div className={styles.sectionHead}><div><div className={styles.sectionKicker}>THE PEOPLE BEHIND THE SHOW</div><h2 className={styles.sectionTitle}>Meet your next crew mate</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Example profiles showing the range of roles and skills you can find in the community.' : 'Crew profiles from the BACKLINE community.'}</p></div><Link className={styles.textLink} to="/people">Find crew <span aria-hidden="true">→</span></Link></div>
            <div className={styles.crewGrid}>
              {!isDemoMode && crewLoading && <p className={styles.productionsMessage} role="status">Loading crew profiles…</p>}
              {!isDemoMode && crewError && <p className={styles.productionsMessage} role="alert">{crewError}</p>}
              {!isDemoMode && !crewLoading && !crewError && featuredCrew.length === 0 && <p className={styles.productionsMessage}>No crew profiles yet. Be one of the first to join the community.</p>}
              {featuredCrew.map((person, index) => {
                const demoPerson = isDemoMode
                const name = demoPerson ? person.name : person.display_name || 'Unnamed crew member'
                const tone = demoPerson ? person.tone : ['blue', 'purple', 'orange'][index % 3]
                const profile = demoPerson
                  ? { display_name: person.name, avatar_url: person.image }
                  : person

                return (
                  <article className={`${styles.crewCard} ${styles[`crew${tone[0].toUpperCase()}${tone.slice(1)}`]}`} key={person.id || name}>
                    <div className={styles.crewTop}><div className={styles.portraitWrap}><Avatar profile={profile} size="lg" />{demoPerson && <span className={styles.statusDot} />}</div>{demoPerson && <span className={styles.availability}>Available for work</span>}</div>
                    <div className={styles.crewInfo}><h3 className={styles.crewName}>{name}</h3><div className={styles.crewRole}>{demoPerson ? person.role : person.role_title || 'Crew member'}</div><div className={styles.crewLocation}>⌖ {person.location || 'Location not set'}</div><div className={styles.skillList}>{(person.skills || []).map(skill => <span key={skill}>{skill}</span>)}</div></div>
                    <div className={styles.crewBottom}><span>{demoPerson ? 'AV professional' : 'CREW PROFILE'}</span><Link className={styles.profileAction} to={demoPerson ? '/people' : `/profile/${person.id}`}>{demoPerson ? 'View people' : 'View profile'} <span aria-hidden="true">→</span></Link></div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.crewCallsSection}`} id="calls">
          <div className={styles.container}>
            <div className={styles.sectionHead}><div><div className={styles.sectionKicker}>YOUR NEXT CALL TIME</div><h2 className={styles.sectionTitle}>Crew calls worth a look</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Example calls for a preview. Find current opportunities in projects.' : 'Recent opportunities posted by the BACKLINE community.'}</p></div><Link className={styles.textLink} to="/discover">Browse projects <span aria-hidden="true">→</span></Link></div>
            <div className={styles.callsList}>
              {!isDemoMode && callsLoading && <p className={styles.productionsMessage} role="status">Loading crew calls…</p>}
              {!isDemoMode && callsError && <p className={styles.productionsMessage} role="alert">{callsError}</p>}
              {!isDemoMode && !callsLoading && !callsError && featuredCalls.length === 0 && <p className={styles.productionsMessage}>No crew calls yet. Check back soon or browse all projects.</p>}
              {featuredCalls.map((call, index) => {
                const demoCall = isDemoMode
                const tone = demoCall ? call.tone : ['purple', 'orange', 'blue'][index % 3]
                const callSkills = demoCall ? call.skills : call.roles || []

                return (
                  <article className={styles.callCard} key={call.id || call.title}>
                    <div className={`${styles.callDepartment} ${styles[`call${tone[0].toUpperCase()}${tone.slice(1)}`]}`}><span aria-hidden="true">✳</span>{demoCall ? call.department : (call.type || 'CREW CALL').toUpperCase()}</div>
                    <div className={styles.callMain}><h3 className={styles.callTitle}>{call.title}</h3><div className={styles.callDetails}><span>⌖ {call.location || 'Location TBC'}</span><span>▣ {demoCall ? call.date : formatProductionDate(call.event_date)}</span><strong>{demoCall ? call.rate : call.compensation || 'Rate TBC'}</strong></div><div className={`${styles.skillList} ${styles.callSkills}`}>{callSkills.length > 0 ? callSkills.map(skill => <span key={skill}>{skill}</span>) : <span>Roles not listed</span>}</div></div>
                    <Link className={`${styles.button} ${styles.secondary} ${styles.callAction}`} to="/discover">View projects <span aria-hidden="true">→</span></Link>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.forumSection}`} id="forum">
          <div className={`${styles.container} ${styles.forumLayout}`}>
            <div className={styles.forumIntro}><div className={styles.sectionKicker}>BACKSTAGE DISCUSSIONS</div><h2 className={styles.sectionTitle}>Practical answers from people on the ground.</h2><p className={styles.sectionSubtitle}>{isDemoMode ? 'Example topics for a preview. Ask questions and compare workflows in the community forum.' : 'Recent questions and knowledge shared by the BACKLINE community.'}</p><Link className={`${styles.button} ${styles.secondary}`} to="/forum">Join the discussion <span aria-hidden="true">→</span></Link></div>
            <div className={styles.discussionList}>
              {!isDemoMode && discussionsLoading && <p className={styles.productionsMessage} role="status">Loading discussions…</p>}
              {!isDemoMode && discussionsError && <p className={styles.productionsMessage} role="alert">{discussionsError}</p>}
              {!isDemoMode && !discussionsLoading && !discussionsError && featuredDiscussions.length === 0 && <p className={styles.productionsMessage}>No discussions yet. Start the first conversation in the forum.</p>}
              {featuredDiscussions.map((discussion, index) => {
                const demoDiscussion = isDemoMode
                const tone = demoDiscussion ? discussion.tone : ['blue', 'purple', 'orange'][index % 3]
                const title = demoDiscussion ? discussion.title : discussion.title || discussion.body
                const meta = demoDiscussion
                  ? discussion.replies
                  : `${discussion.comments?.[0]?.count || 0} replies`

                return (
                  <Link className={styles.discussionCard} to="/forum" key={discussion.id || title}>
                    <span className={`${styles.discussionNumber} ${styles[`number${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>0{index + 1}</span>
                    <span className={styles.discussionContent}>
                      <span className={styles.discussionTopline}>
                        <span className={styles.discussionTag}>{discussion.category}</span>
                        <span className={styles.discussionTime}>{demoDiscussion ? discussion.time : timeAgo(discussion.created_at)}</span>
                      </span>
                      <strong className={styles.discussionTitle}>{title}</strong>
                      <span className={styles.discussionMeta}>{meta}</span>
                    </span>
                    <span className={styles.discussionArrow} aria-hidden="true">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Repeat the invitation at the bottom for visitors who reach the footer. */}
        <section className={styles.ctaSection}>
          <div className={`${styles.container} ${styles.ctaInner}`}><div className={styles.ctaGlow} /><span className={styles.ctaIcon} aria-hidden="true">⌁</span><h2 className={styles.ctaTitle}>Find your people. Build the show.</h2><p className={styles.ctaCopy}>Join the backstage network built for the people who make live events possible.</p>{session ? <Link className={`${styles.button} ${styles.light}`} to="/feed">Open the community <span aria-hidden="true">→</span></Link> : <button className={`${styles.button} ${styles.light}`} onClick={onSignIn}>Join BACKLINE <span aria-hidden="true">→</span></button>}</div>
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
