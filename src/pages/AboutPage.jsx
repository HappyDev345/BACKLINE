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
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>Good shows start with good people.</h1>
          <p className={styles.heroDescription}>
            BACKLINE brings the production community into one place: a professional
            profile, a crew directory, project opportunities, and conversations
            with people who understand the work.
          </p>
          <div className={styles.heroActions}>
            <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => onSignIn('up')}>
              Create your crew profile
            </button>
            <Link className={`${styles.button} ${styles.secondary}`} to="/discover">
              Explore projects
            </Link>
          </div>

          <div className={styles.networkMap} aria-label="BACKLINE brings people, projects, and community together">
            <div className={styles.networkNodes}>
              <article className={styles.networkNode}>
                <h2>Profiles</h2>
                <p>Show what you do</p>
              </article>
              <article className={styles.networkNode}>
                <h2>Projects</h2>
                <p>Find the next call</p>
              </article>
              <article className={styles.networkNode}>
                <h2>Connections</h2>
                <p>Keep the conversation going</p>
              </article>
            </div>
            <div className={styles.departmentList} aria-label="For every department">
              {departments.map((department) => <span key={department}>{department}</span>)}
              <span>And more</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.tinted}`} aria-labelledby="features-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 id="features-title" className={styles.sectionTitle}>Everything around your production life.</h2>
            <p className={styles.sectionSubtitle}>From finding a crew call to keeping in touch after the show, bring your professional world into one place.</p>
          </div>
          <div className={styles.featureGrid}>
            {waysToConnect.map((item) => (
              <article className={styles.featureCard} key={item.number}>
                <p className={styles.featureCategory}>{item.number} · {item.category}</p>
                <h3>{item.title}</h3>
                <p className={styles.featureDescription}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="account-benefits-title">
        <div className={`${styles.container} ${styles.accountLayout}`}>
          <div className={styles.accountIntro}>
            <h2 id="account-benefits-title" className={styles.sectionTitle}>More than a profile. A place in the crew.</h2>
            <p className={styles.sectionSubtitle}>Browse public projects to get a feel for the community. Create an account to make your profile, save opportunities, connect with people, and join in.</p>
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

      <section className={styles.ctaSection} aria-label="Join BACKLINE">
        <div className={`${styles.container} ${styles.ctaInner}`}>
          <h2 className={styles.ctaTitle}>Find your people. Build the show.</h2>
          <p className={styles.ctaCopy}>Make your work visible, find your crew, and stay connected to the industry.</p>
          <div className={styles.heroActions}>
            <button className={`${styles.button} ${styles.light}`} type="button" onClick={() => onSignIn('up')}>
              Join BACKLINE
            </button>
            <Link className={`${styles.button} ${styles.outlineLight}`} to="/discover">Discover projects</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
