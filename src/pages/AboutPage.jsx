import { Link } from 'react-router-dom'
import styles from './AboutPage.module.css'

const waysToConnect = [
  {
    number: '01',
    category: 'Your professional presence',
    title: 'A profile that shows your work',
    description: 'Share your role, location, skills, bio, and projects or posts. Give other crew a place to learn what you do and what you bring to a production.',
  },
  {
    number: '02',
    category: 'Your crew network',
    title: 'Find the right people',
    description: 'Browse production people and search by name, username, role, location, or skills. Follow people to keep up with their work and grow your network.',
  },
  {
    number: '03',
    category: 'Your next opportunity',
    title: 'Projects and crew calls',
    description: 'Explore opportunities across live events, film, music, photography, and more. Filter by role, location, and type, then save projects to revisit.',
  },
  {
    number: '04',
    category: 'Your working community',
    title: 'A feed for the work behind the show',
    description: 'Share production updates, questions, tips, and things you have learned on the job. See what the wider community is posting or catch up with people you follow.',
  },
  {
    number: '05',
    category: 'Your shared knowledge',
    title: 'Practical industry discussions',
    description: 'Start a topic or join conversations across audio, lighting, cameras, video, equipment, workflows, careers, and more.',
  },
  {
    number: '06',
    category: 'Your connections',
    title: 'Direct conversations and activity',
    description: 'Message other crew privately and get notifications when people interact with your posts, follow you, or send you a message.',
  },
]

const accountBenefits = [
  {
    title: 'Make your work visible',
    description: 'Create a profile that reflects your role, skills, experience, and projects.',
  },
  {
    title: 'Build your network',
    description: 'Find and follow people across the departments that bring a production together.',
  },
  {
    title: 'Take part',
    description: 'Save projects, share updates, join discussions, and message your connections.',
  },
]

const departments = ['Audio', 'Lighting', 'Video', 'Camera', 'Stage', 'Production']

export default function AboutPage({ onSignIn }) {
  return (
    <main className={styles.about}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A NETWORK FOR LIVE PRODUCTION</p>
          <h1>Good shows start with <span>good people.</span></h1>
          <p className={styles.heroDescription}>
            BACKLINE brings the production community into one place: a professional
            profile, a crew directory, project opportunities, and conversations
            with people who understand the work.
          </p>
          <div className={styles.heroActions}>
            <button className={`${styles.button} ${styles.primary}`} type="button" onClick={onSignIn}>
              Create your crew profile <span aria-hidden="true">→</span>
            </button>
            <Link className={`${styles.button} ${styles.secondary}`} to="/discover">
              Explore projects
            </Link>
          </div>
        </div>

        <div className={styles.networkMap} aria-label="BACKLINE brings people, projects, and community together">
          <div className={styles.networkMapHead}>
            <span className={styles.networkMapDot} />
            <span>YOUR PRODUCTION NETWORK</span>
            <span className={styles.networkMapLine} />
          </div>
          <div className={styles.networkNodes}>
            <article className={styles.networkNode}>
              <span className={styles.nodeIndex}>01 / PEOPLE</span>
              <span className={styles.nodeIcon} aria-hidden="true">◉</span>
              <h2>Profiles</h2>
              <p>Show what you do</p>
            </article>
            <span className={styles.nodeConnector} aria-hidden="true">+</span>
            <article className={styles.networkNode}>
              <span className={styles.nodeIndex}>02 / WORK</span>
              <span className={`${styles.nodeIcon} ${styles.nodeIconPurple}`} aria-hidden="true">↗</span>
              <h2>Projects</h2>
              <p>Find the next call</p>
            </article>
            <span className={styles.nodeConnector} aria-hidden="true">+</span>
            <article className={styles.networkNode}>
              <span className={styles.nodeIndex}>03 / COMMUNITY</span>
              <span className={`${styles.nodeIcon} ${styles.nodeIconOrange}`} aria-hidden="true">⌁</span>
              <h2>Connections</h2>
              <p>Keep the conversation going</p>
            </article>
          </div>
          <div className={styles.departmentList} aria-label="For every department">
            {departments.map((department) => <span key={department}>{department}</span>)}
            <span>And more</span>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.sectionKicker}>ONE NETWORK, BUILT AROUND THE WORK</p>
            <h2 id="features-title">Everything around your production life.</h2>
          </div>
          <p>From finding a crew call to keeping in touch after the show, bring your professional world into one place.</p>
        </div>
        <div className={styles.featureGrid}>
          {waysToConnect.map((item) => (
            <article className={styles.featureCard} key={item.number}>
              <div className={styles.featureTop}>
                <span className={styles.featureNumber}>{item.number}</span>
                <span className={styles.featureRule} />
              </div>
              <p className={styles.featureCategory}>{item.category}</p>
              <h3>{item.title}</h3>
              <p className={styles.featureDescription}>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.accountSection} aria-labelledby="account-benefits-title">
        <div className={styles.accountPanel}>
          <div className={styles.accountIntro}>
            <p className={styles.sectionKicker}>YOUR BACKLINE STARTS HERE</p>
            <h2 id="account-benefits-title">More than a profile.<br /><span>A place in the crew.</span></h2>
            <p>Browse public projects to get a feel for the community. Create an account to make your profile, save opportunities, connect with people, and join in.</p>
          </div>
          <div className={styles.benefitList}>
            {accountBenefits.map((item, index) => (
              <article className={styles.benefit} key={item.title}>
                <span className={styles.benefitNumber}>0{index + 1}</span>
                <div><h3>{item.title}</h3><p>{item.description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta} aria-label="Join BACKLINE">
        <div className={styles.ctaGlow} aria-hidden="true" />
        <p className={styles.sectionKicker}>YOUR NEXT CONNECTION STARTS HERE</p>
        <h2>Find your people.<br /><span>Build the show.</span></h2>
        <p className={styles.ctaCopy}>Make your work visible, find your crew, and stay connected to the industry.</p>
        <div className={styles.heroActions}>
          <button className={`${styles.button} ${styles.primary}`} type="button" onClick={onSignIn}>
            Join BACKLINE <span aria-hidden="true">→</span>
          </button>
          <Link className={`${styles.button} ${styles.secondary}`} to="/discover">Discover projects</Link>
        </div>
      </section>
    </main>
  )
}
