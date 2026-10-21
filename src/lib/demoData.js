// Example records for the no-backend preview. These look like database records
// so the same page components can display them during the visual prototype stage.
const today = new Date()
// Give sample activity realistic recent dates whenever the site is opened.
const daysAgo = (days) => new Date(today.getTime() - days * 86400000).toISOString()

// Sample crew accounts shown in the directory and on project/post cards.
export const demoProfiles = [
  {
    id: 'demo-user',
    display_name: 'Taylor Morgan',
    username: 'taylormorgan',
    role_title: 'Production Coordinator',
    location: 'Sydney, NSW',
    bio: 'Production coordinator bringing creative teams together for live events and broadcast.',
    skills: ['Live production', 'Scheduling', 'Stage management'],
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=180&q=80',
    created_at: daysAgo(28),
  },
  {
    id: 'crew-marcus',
    display_name: 'Marcus Reed',
    username: 'marcusreed',
    role_title: 'FOH Engineer',
    location: 'Sydney, NSW',
    bio: 'Front of house engineer working across festivals, touring and live broadcast.',
    skills: ['D live', 'Touring', 'RF coordination'],
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=180&q=80',
    created_at: daysAgo(24),
  },
  {
    id: 'crew-alex',
    display_name: 'Alex Chen',
    username: 'alexchen',
    role_title: 'Lighting Designer',
    location: 'Alexandria, NSW',
    bio: 'Lighting designer and programmer with a love for ambitious live shows.',
    skills: ['grandMA3', 'WYSIWYG', 'Touring'],
    avatar_url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=180&q=80',
    created_at: daysAgo(18),
  },
  {
    id: 'crew-jamie',
    display_name: 'Jamie Okafor',
    username: 'jamieokafor',
    role_title: 'Camera Operator',
    location: 'Coogee, NSW',
    bio: 'Camera operator for live music, broadcast and documentary work.',
    skills: ['Sony FX9', 'Jib', 'Broadcast'],
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=180&q=80',
    created_at: daysAgo(12),
  },
]

const profileById = Object.fromEntries(demoProfiles.map((profile) => [profile.id, profile]))

// Example opportunities for the Discover page and member profiles.
export const demoProjects = [
  {
    id: 'project-harbour',
    creator_id: 'crew-alex',
    title: 'Sydney Harbour Light Festival',
    type: 'Live Event',
    description: 'Join the lighting crew for three nights of large-scale installations and live performances around Circular Quay.',
    location: 'Circular Quay, Sydney',
    event_date: '2026-11-12',
    compensation: 'Paid',
    spots: 2,
    roles: ['Lighting', 'Lighting Technician', 'Rigging'],
    tags: ['Festival', 'Outdoor', 'grandMA3'],
    created_at: daysAgo(1),
    profiles: profileById['crew-alex'],
  },
  {
    id: 'project-foundry',
    creator_id: 'crew-jamie',
    title: 'Foundry Sessions Live',
    type: 'Live Event',
    description: 'A multi-camera live session recording with a small, collaborative crew. Camera and media-management experience welcome.',
    location: 'Bondi, Sydney',
    event_date: '2026-12-06',
    compensation: 'Paid',
    spots: 3,
    roles: ['Camera Operator', 'Vision Switcher', 'Media Manager'],
    tags: ['Live broadcast', 'Music', 'Sony'],
    created_at: daysAgo(3),
    profiles: profileById['crew-jamie'],
  },
  {
    id: 'project-coffee',
    creator_id: 'demo-user',
    title: 'Coffee & Connect: Production Crew',
    type: 'Other',
    description: 'A relaxed community meetup for production people to share workflows, meet collaborators and make useful local connections.',
    location: 'Martin Place, Sydney',
    event_date: '2026-11-28',
    compensation: 'Expenses covered',
    spots: 8,
    roles: ['Audio', 'Lighting', 'Video'],
    tags: ['Community', 'Networking'],
    created_at: daysAgo(5),
    profiles: profileById['demo-user'],
  },
  {
    id: 'project-tour',
    creator_id: 'crew-marcus',
    title: 'Monitor Engineer — Summer Tour',
    type: 'Music',
    description: 'Looking for an experienced monitor engineer for a short run of regional dates. Touring experience and clear communication are essential.',
    location: 'Sydney, NSW',
    event_date: '2026-12-10',
    compensation: 'Paid',
    spots: 1,
    roles: ['Monitor Engineer', 'Audio'],
    tags: ['Touring', 'DiGiCo', 'IEM'],
    created_at: daysAgo(8),
    profiles: profileById['crew-marcus'],
  },
]

// Feed posts and discussion threads. A category distinguishes forum threads
// from regular feed posts.
export const demoPosts = [
  {
    id: 'post-rf',
    author_id: 'crew-marcus',
    title: 'Festival RF coordination checklist',
    body: 'What is one thing you always check before doors? I have started doing a fresh scan after the full site is powered up, then keeping a printed coordination sheet at both FOH and monitor world.',
    category: null,
    created_at: daysAgo(0.12),
    profiles: profileById['crew-marcus'],
    likes: [{ count: 5 }],
    comments: [{ count: 2 }],
  },
  {
    id: 'post-handover',
    author_id: 'crew-alex',
    title: null,
    body: 'A tidy showfile handover saves everyone time. I have had good results with a short readme, a versioned backup, and a quick run-through with the next operator.',
    category: null,
    created_at: daysAgo(0.8),
    profiles: profileById['crew-alex'],
    likes: [{ count: 3 }],
    comments: [{ count: 1 }],
  },
  {
    id: 'post-community',
    author_id: 'demo-user',
    title: 'What are you working on this week?',
    body: 'I am planning a small crew catch-up in Sydney and would love to hear what is keeping everyone busy.',
    category: null,
    created_at: daysAgo(2),
    profiles: profileById['demo-user'],
    likes: [{ count: 2 }],
    comments: [{ count: 0 }],
  },
  {
    id: 'thread-playback',
    author_id: 'crew-jamie',
    title: 'Reliable playback backup workflow for show day',
    body: 'For a two-machine playback setup, what is your preferred failover approach? Interested in practical setups that are easy for a visiting operator to understand.',
    category: 'Video & Projection',
    created_at: daysAgo(0.2),
    profiles: profileById['crew-jamie'],
    likes: [{ count: 1 }],
    comments: [{ count: 2 }],
  },
  {
    id: 'thread-showfile',
    author_id: 'crew-alex',
    title: 'Showfile handover tips when joining a touring rig',
    body: 'I am putting together a better handover checklist for guest operators. Which details do you always want documented before taking over a console?',
    category: 'Lighting & Control',
    created_at: daysAgo(1),
    profiles: profileById['crew-alex'],
    likes: [{ count: 4 }],
    comments: [{ count: 1 }],
  },
  {
    id: 'thread-careers',
    author_id: 'demo-user',
    title: 'How did you get your first touring opportunity?',
    body: 'I would love to hear how people moved from local events into touring work, and what skills made the biggest difference.',
    category: 'Careers & Training',
    created_at: daysAgo(4),
    profiles: profileById['demo-user'],
    likes: [{ count: 2 }],
    comments: [{ count: 0 }],
  },
]

// Example replies attached to a post or forum thread.
export const demoComments = [
  {
    id: 'comment-rf-1',
    post_id: 'post-rf',
    author_id: 'crew-alex',
    body: 'Definitely a second scan once the LED wall and wireless video are live.',
    created_at: daysAgo(0.08),
    profiles: profileById['crew-alex'],
  },
  {
    id: 'comment-rf-2',
    post_id: 'post-rf',
    author_id: 'crew-jamie',
    body: 'And a quick comms check with every department before doors.',
    created_at: daysAgo(0.06),
    profiles: profileById['crew-jamie'],
  },
  {
    id: 'comment-playback-1',
    post_id: 'thread-playback',
    author_id: 'crew-marcus',
    body: 'A labelled spare machine and a written changeover sequence make the handoff much calmer.',
    created_at: daysAgo(0.16),
    profiles: profileById['crew-marcus'],
  },
]

// Example relationships and activity used by the follow and notification screens.
export const demoFollows = [
  { follower_id: 'demo-user', followee_id: 'crew-marcus' },
  { follower_id: 'demo-user', followee_id: 'crew-alex' },
]

export const demoNotifications = [
  { id: 'notification-1', user_id: 'demo-user', actor_id: 'crew-marcus', type: 'follow', read: false, created_at: daysAgo(0.08), profiles: profileById['crew-marcus'] },
  { id: 'notification-2', user_id: 'demo-user', actor_id: 'crew-alex', type: 'comment', read: false, created_at: daysAgo(0.5), profiles: profileById['crew-alex'] },
  { id: 'notification-3', user_id: 'demo-user', actor_id: 'crew-jamie', type: 'like', read: true, created_at: daysAgo(2), profiles: profileById['crew-jamie'] },
]

// Example private chats used by the messages screen.
export const demoConversations = [
  { id: 'conversation-marcus', other: profileById['crew-marcus'], last: { body: 'Looking forward to the next show!', created_at: daysAgo(1) } },
  { id: 'conversation-alex', other: profileById['crew-alex'], last: { body: 'Thanks for sharing the run sheet.', created_at: daysAgo(3) } },
]

export const demoMessages = [
  { id: 'message-1', conversation_id: 'conversation-marcus', sender_id: 'crew-marcus', body: 'Hey Taylor, are you on the Harbour Festival crew this year?', created_at: daysAgo(1.2), profiles: profileById['crew-marcus'] },
  { id: 'message-2', conversation_id: 'conversation-marcus', sender_id: 'demo-user', body: 'Yes, I am coordinating the production team. Great to connect!', created_at: daysAgo(1.1), profiles: profileById['demo-user'] },
  { id: 'message-3', conversation_id: 'conversation-marcus', sender_id: 'crew-marcus', body: 'Looking forward to the next show!', created_at: daysAgo(1), profiles: profileById['crew-marcus'] },
  { id: 'message-4', conversation_id: 'conversation-alex', sender_id: 'crew-alex', body: 'Thanks for sharing the run sheet.', created_at: daysAgo(3), profiles: profileById['crew-alex'] },
]

// A starting bookmark and a couple of likes make the preview feel populated.
export const demoSavedProjects = [{ user_id: 'demo-user', project_id: 'project-harbour' }]
export const demoLikedPostIds = ['post-rf', 'post-community']
