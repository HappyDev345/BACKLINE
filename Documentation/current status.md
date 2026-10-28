## Overview

BACKLINE is a React website for people working in live events, film, music, and photography. It brings together project listings, crew profiles, a community feed, a technical forum, private messages, and notifications.

It’s currently a **frontend-first prototype**: the main screens and interactions are implemented, but whether changes persist depends on whether the app is connected to Supabase.

## How the app starts and navigates

Vite loads `index.html`, which mounts React through `main.jsx`. The app is wrapped in shared providers for navigation, preview data, and authentication.

`App.jsx` maps URLs to pages and keeps the shared sign-in modal available. The navigation bar is in `NavBar.jsx`.

The main routes are:

- `/` — public landing page
- `/discover` — project listings
- `/people` — crew directory
- `/profile` and `/profile/:id` — your profile or another person’s
- `/feed` — signed-in community feed
- `/forum` — discussions and replies
- `/messages` — private conversations
- `/notifications` — activity alerts

Unknown routes show a friendly not-found message.

## The two data modes

`lib/supabase.js` switches modes based on whether both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set:

- **Preview mode:** Without both settings, the app uses fixtures from `demoData.js`. `DemoContext.jsx` holds shared, editable copies in browser memory. You can try creating content, following people, liking posts, and messaging, but changes disappear on refresh. Sign-in creates a temporary preview account rather than verifying credentials.
- **Connected mode:** With both settings present, pages use Supabase Auth, Postgres, Storage, and some Realtime subscriptions. The credentials are documented in `.env.example`; the setup steps are in `README.md`.

`AuthContext.jsx` shares the current session and profile with pages. In connected mode, it restores the Supabase session, listens for sign-in changes, and loads the user’s profile. New accounts get a profile from a database trigger.

## What each part of the site does

- **Landing:** `LandingPage.jsx` introduces the service and links to the community pages. All illustrative crew, call, and discussion showcases appear only in preview mode. Featured projects use examples in preview mode and the three newest projects in connected mode, with an empty state when there are no public projects.
- **Discover:** `DiscoverPage.jsx` searches, filters, and sorts projects; signed-in users can save listings and publish projects. `ProjectCard.jsx` displays a listing, and `ProjectModal.jsx` shows its details. “Express interest” opens a conversation and sends a message to the creator; it does **not** submit a formal application or assign someone to the project.
- **People and profiles:** `PeoplePage.jsx` searches people by name, username, role, location, or skill. Signed-in users can follow or message them. `ProfilePage.jsx` shows a person’s bio, skills, projects, posts, and follow counts. Owners can edit profile details and, when connected, upload an avatar to Supabase Storage.
- **Feed:** `FeedPage.jsx` requires sign-in. Members can switch between everyone’s posts and posts by people they follow, then publish, like, and comment. `PostCard.jsx` handles post display and loading comments when expanded.
- **Forum:** `ForumPage.jsx` uses the same posts data as the feed, distinguishing threads by their category. Visitors can browse and filter threads; signed-in members can start threads and reply.
- **Messages:** `MessagesPage.jsx` shows conversations and their messages. Starting a chat reuses an existing conversation between the two people or creates one using `conversations.js`. Connected conversations subscribe to new messages in real time.
- **Notifications:** `NotificationsPage.jsx` lists alerts and can mark them read. In connected mode, database triggers create alerts for likes, comments, follows, and messages; Realtime updates the unread count in the navigation.

Demo records and demo-specific UI are limited to preview mode. When Supabase is
connected, pages use database records or their normal empty states.

User-facing errors use brief, actionable messages rather than raw backend
responses. Failed data loads and community actions display feedback instead of
being presented as successful empty results.

## What’s behind the connected mode

`supabase/schema.sql` defines profiles, projects, posts and comments, follows and likes, saved projects, conversations and messages, and notifications. It also sets row-level security policies, profile and notification triggers, and a public `media` storage bucket.

Some backend pieces are groundwork rather than finished product features: `project_members` is defined but not used by the UI; post media is represented in the schema but there’s no post-upload flow; and Realtime is used for open chats and the notification count, not as a general live-update mechanism. The schema also documents a simplified conversation-membership policy that would need tightening before a production launch.

## Running it

The app uses Vite and React; `package.json` provides `npm run dev` and `npm run build`. There is no test script listed in the package manifest. The project’s setup instructions and Supabase connection steps are in the `README`.