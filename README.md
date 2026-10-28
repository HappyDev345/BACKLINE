# BACKLINE

BACKLINE is a community app for the people who make live events, film, music
and photography happen. It is built with React and Vite, with Supabase for
connected account and data flows.

## Versioning

The current release is listed in `package.json`. Record notable changes in
`CHANGELOG.md` under the matching version. Use Semantic Versioning:
increment the major number for incompatible changes, minor for new features,
and patch for fixes.

## Run the prototype

Requirements: Node.js 18+.

```bash
npm install
npm run dev
```

Without both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the app runs in
**preview mode** with sample projects, crew, posts, discussions, messages and
notifications. You can sign in with a valid email and a password of at least
six characters, or choose **Continue as sample user**, to try the interactive
flows. Preview changes live in memory and reset when you refresh; they are not
sent to Supabase.

Check the production bundle with:

```bash
npm run build
```

## Connect Supabase

To run the connected app:

1. Create a separate Supabase project for development or preview testing.
2. Run `supabase/schema.sql`, then apply each file in `supabase/migrations/` in
   timestamp order in that project's SQL Editor. For an existing project, run
   only migrations that have not already been applied.
3. Create a local `.env` file with the project's URL and public anon key:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

4. Restart Vite. When both values are present, the app uses Supabase instead of
   preview mode.

In connected mode, community records come from Supabase; illustrative demo
profiles, calls, discussions, and other sample records are limited to preview
mode. The public landing page shows the three newest public projects, crew
profiles, crew calls, and forum discussions from Supabase, with empty states
when no records are available. Preview mode keeps the illustrative sample
content throughout the app.

Never put a Supabase service-role key in the frontend or commit credentials.
Use a separate project and environment variables for preview deployments so
test data cannot affect production.

### Staff roles, reports, and moderation

The roles/reporting migrations add the private staff workspace, account
management, verification badges, reports, content moderation, and the staff
action history. Apply each migration once, in timestamp order. The later
`20261028211000_report_private_messages.sql` migration enables reporting
individual private messages. Only admins can review message reports, and staff
can inspect only the specific reported message—not its conversation history.
After applying the roles migration, create the first admin from the
Supabase SQL Editor using an account that has already signed up. Replace the
email below with the trusted operator's exact account email:

```sql
insert into public.staff_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (user_id, role) do nothing;
```

Only admins can grant or revoke further staff roles. Feed/forum moderators can
review and moderate posts, threads, and comments; project moderators can
moderate projects. Account suspension, staff appointments, and verified badges
are admin-only. Reports are private to the reporter and authorized staff;
the reporting RPC limits submissions and the staff workspace records
moderation actions and private case notes.

Suspension blocks new community content, likes/follows/saves, reports, profile
edits, and new conversations/messages while leaving public read access intact;
suspending a moderator also revokes their staff roles, which must be
re-granted separately after reinstatement.

For the first release, define **Verified** as an admin-reviewed indication
that a person or organization demonstrates real involvement in AV/live
production (for example, through a public portfolio, production credits, or an
official company/venue page). It is not an endorsement, qualification, or
identity guarantee. Do not collect identity documents or sensitive evidence.
Admins must record a brief reason; publish how to request review and appeal
before enabling badges broadly. The current UI provides the admin grant/revoke
control, not a user application or appeal workflow.

The migration also replaces self-service conversation membership with an
atomic database operation, preventing users from adding themselves to
arbitrary existing conversations. Legacy conversations are preserved but
inaccessible while their `created_by` field is null. Review their memberships
in the development project before restoring access by setting a trusted
creator; do not make old conversations visible before checking every member.

Before production, verify these cases in a separate Supabase project:

- Ordinary users cannot grant roles, change badges, write moderation actions,
  directly create/edit reports, or read another user's reports or staff notes.
- Feed/forum moderators can review and moderate posts, threads, and comments,
  but cannot review account reports, change roles, grant verification, or
  suspend accounts. Project moderators can act only on project reports.
- Only admins can review message reports; a staff account cannot read unrelated
  private messages, and a hidden message is no longer visible to conversation
  participants.
- Admins can manage roles, badges, and account standing; the last admin cannot
  remove their own admin role. Admins cannot suspend themselves; another
  admin's role must be revoked before that account can be suspended.
- A resolved hide/remove action removes content from ordinary reads while
  authorized staff retain access; restore clears the hidden state. Every staff
  decision appears in the action history.
- Suspended accounts cannot publish, interact, report, edit profiles, or start
  conversations; reinstatement does not automatically restore staff roles.
- Direct membership writes cannot add someone to an existing conversation;
  the RPC creates exactly the caller and intended recipient. Legacy
  conversations remain unreadable until their membership is audited.

### Account settings and deletion

Signed-in users can change their email and password from **Settings**. Email
changes require confirmation through Supabase Auth. The sign-in dialog also
offers password recovery; set the Supabase Auth **Site URL** and **Redirect
URLs** to include the deployed site origin and its `/reset-password` path (and
the local origin used for development).

For an existing Supabase project, apply
`supabase/migrations/20261026200000_own_media_uploads.sql` before enabling the
new deletion flow. It restricts uploads to each signed-in user's own storage
folder, which is also the folder removed during account deletion. New projects
get the same rule from `supabase/schema.sql`.

Account deletion is permanent: it removes the authenticated user, the profile
and records linked through the schema's cascading foreign keys, plus uploaded
media stored under that user's ID in the `media` bucket. The deletion endpoint
is a Supabase Edge Function; deploy it to the same project as the frontend:

```bash
supabase functions deploy delete-account
```

The function verifies the caller's access token and derives the account ID from
that verified identity. It uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`
to remove media and the Auth user. Supabase provides this key to deployed Edge
Functions; for local serving or a self-hosted environment, configure it as a
function secret. Never add it to `VITE_*` variables, frontend code, or source
control. Verify the function and deletion behavior in a non-production project
before enabling account deletion for production users.

## Hosting direction

For an eventual small full-stack launch, staying with **Vercel for the React
site and Supabase for Auth, Postgres, Storage and Realtime** is a straightforward
low-cost setup. The current frontend is already deployed on Vercel, so there is
no need to move hosting just to add Supabase. Both providers' free-tier quotas,
pausing rules and feature limits can change; check the current terms and expected
usage before depending on the free plans. A custom domain can wait until the
product is closer to launch.

## Project structure

```text
src/
  App.jsx                 Routes and shared auth modal
  components/             Navigation, cards and modals
  context/                Auth and in-memory preview data
  lib/                    Supabase client, demo fixtures and helpers
  pages/                  Landing, feed, account settings, and community pages
supabase/
  schema.sql              Database schema and row-level security policies
  migrations/             Updates for already-connected Supabase projects
  functions/              Supabase Edge Functions
```

## What the setup files do

- `index.html` is the small web page that loads the React app into the browser.
- `vite.config.js` tells Vite how to prepare the React app for local work and hosting.
- `package.json` lists the libraries the app uses and the commands such as `npm run dev`.
- `package-lock.json` is generated by npm to keep installed library versions consistent; it is not hand-edited.
- `README.md` is this human-readable setup and project guide.

JSON files such as `package.json` and `package-lock.json` do not support comments.
Their purpose is explained here instead; images are artwork rather than readable
source code.
