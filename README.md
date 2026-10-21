# BACKLINE

A creative networking and collaboration platform for audiovisual production,
live events, film, music and photography — full-stack edition.

Stack: **React + Vite** (frontend) · **Supabase** (PostgreSQL, Auth, Storage, Realtime) · **Vercel** (hosting)

---

## Features in this build (roadmap Phases 2–5)

| Area | What's working |
|---|---|
| Accounts | Email/password sign-up and sign-in (Supabase Auth), auto-created profile |
| Profiles | View/edit profile: display name, username, role, location, bio, skills, avatar upload |
| Discover | Real projects from the database: search, combined filters (type / role / location), sorting, saved projects, publish projects, express interest |
| Feed | Posts with title + body, likes, comments, Everyone / Following tabs |
| People | Search creatives by name/role/skill/location, follow, start a conversation |
| Forum | Category-organised threads with replies |
| Messages | Realtime 1:1 conversations (Supabase Realtime) |
| Notifications | Like / comment / follow / message alerts, unread badge, mark-all-read |
| Landing page | Public homepage introducing BACKLINE and linking into projects, people, discussions and the community |

Phase 6 items (thorough security testing, accessibility audit, backups, performance
work) are intentionally left for you — see the checklist at the bottom.

---

## 1. Prerequisites

- Node.js 18+ (https://nodejs.org)
- A free Supabase account (https://supabase.com)
- Access to the BACKLINE project in Vercel if you want to configure hosted
  deployments.

## 2. Set up Supabase

Create a Supabase project for the environment you are configuring. For safe
testing, use a separate project from production so test accounts and data cannot
affect the live site.

1. In the Supabase dashboard, open **SQL Editor → New query**, paste the entire
   contents of `supabase/schema.sql`, and click **Run**. This creates the
   tables, security policies, triggers and the `media` storage bucket. Repeat
   this for each Supabase project you use.
2. Keep Email authentication enabled. For a test project, you can turn off
   **Confirm email** in the email provider settings to create accounts without
   email confirmation.

## 3. Configure local development

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

In `.env`, set the Project URL and `anon` / `public` key from **Supabase
Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Use the credentials for your **test** Supabase project when testing locally.
Never put a Supabase service-role key in frontend environment variables or
commit `.env`. The repository's `.gitignore` excludes local environment files,
dependencies and build output.

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Create test accounts
through the app. To test interactions between users, sign in with two accounts
using separate browsers, or a normal and private window. Their data is stored
in the Supabase project configured in `.env`.

To check that the frontend builds:

```bash
npm run build
```

## 4. Configure Vercel environments

BACKLINE is hosted on Vercel. Configure environment variables in the existing
Vercel project under **Settings → Environment Variables**:

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for **Production** to
  the production Supabase project.
- To test a deployment without using production data, set the same variables
  for **Preview** to a separate test Supabase project. Preview deployments
  will then use that project's database and accounts.

Apply `supabase/schema.sql` to the test project as well as production if both
environments are used. Vercel reads these variables when it builds the site;
redeploy the relevant environment after changing them. Do not use the
production Supabase credentials for a test deployment if you want its data
isolated.

The Vercel project can deploy automatically when changes are pushed to its
connected Git repository. No separate Vercel project or CLI deployment is
needed if the existing integration is already configured.

## Project structure

```
backline/
├── index.html                  # fonts + app shell
├── supabase/
│   └── schema.sql              # tables, RLS policies, triggers, storage
├── src/
│   ├── main.jsx                # router + auth provider bootstrap
│   ├── App.jsx                 # landing page, app routes + global auth modal
│   ├── index.css               # the whole design system (dark navy / blue-purple)
│   ├── lib/
│   │   ├── supabase.js         # Supabase client (reads .env)
│   │   ├── conversations.js    # find-or-create 1:1 conversation helper
│   │   └── utils.js            # timeAgo, initials, date formatting
│   ├── context/
│   │   └── AuthContext.jsx     # session + profile state, sign in/up/out
│   ├── components/
│   │   ├── NavBar.jsx          # navigation + notification badge
│   │   ├── AuthModal.jsx       # sign in / create account
│   │   ├── Avatar.jsx
│   │   ├── ProjectCard.jsx     # reusable (Discover + Profile)
│   │   ├── ProjectModal.jsx    # project details + express interest
│   │   └── PostCard.jsx        # post + like + comments
│   └── pages/
│       ├── LandingPage.jsx     # public homepage
│       ├── FeedPage.jsx
│       ├── DiscoverPage.jsx    # search + filters + new project
│       ├── PeoplePage.jsx
│       ├── ProfilePage.jsx     # view / edit + user's projects & posts
│       ├── MessagesPage.jsx    # realtime 1:1 chat
│       ├── ForumPage.jsx       # categories, threads, replies
│       └── NotificationsPage.jsx
```

The public homepage is at `/`. The signed-in community feed is at `/feed`; the
other app areas remain available at `/discover`, `/people`, `/forum`, and the
existing profile, messaging, and notification routes.

## Known simplifications (fine for a major work, tighten before "launch")

- Conversation membership insert policy allows any signed-in user to add themselves
  to a conversation row; a production app should use invitations. Conversations
  themselves are only readable by members.
- Discover filtering runs client-side after fetching recent projects — fine at
  small scale; move to `.ilike()` / `.contains()` queries as data grows.
- No unread-per-conversation tracking, no media attachments on posts (storage +
  `media_urls` column are ready), no password reset UI, no moderation/reporting yet.
- The schema is applied manually: run `supabase/schema.sql` in the SQL Editor
  for each Supabase project you use.

## Phase 6 checklist (your roadmap)

- [ ] Test every RLS policy with two accounts (try to read/edit other users' data)
- [ ] Accessibility pass: labels, focus states, contrast, keyboard-only navigation
- [ ] Error handling and empty states on every fetch
- [ ] Performance: indexes are implicit in PKs; add indexes if you filter large tables
- [ ] Database backups (Supabase → Database → Backups)
- [ ] Content reporting / blocking / spam prevention
