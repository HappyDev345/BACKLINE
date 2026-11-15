# BACKLINE

BACKLINE is a community app for the people who make live events, film, music
and photography happen. It is built with React and Vite, with Supabase for
connected account and data flows.

## Versioning

The current release is listed in `package.json` and `package-lock.json`.
Record notable changes in [`Documentation/CHANGELOG.md`](Documentation/CHANGELOG.md)
under the matching version. Use Semantic Versioning: increment the major
number for incompatible changes, minor for new features, and patch for fixes.

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
For existing projects that already applied earlier migrations, also apply
`20261028212000_private_report_notifications.sql` to remove reporter access to
report records and enable generic review notifications.
Apply `20261028213600_hide_suspended_profiles.sql` and
`20261028214300_hide_suspended_profiles_for_staff.sql` to hide suspended
profiles from all normal profile reads, including those initiated by admins.
The account owner retains access to their own profile. Admins can find
suspended accounts only through the dedicated `/staff` account-management
lookup so they can reinstate or manage them. Existing public content authored
by a suspended account may remain visible, but the account is anonymized as
“Unknown User” and no public link to its profile is shown. The visibility
migrations drop and recreate their policy, so the latest SQL can be run again
if an earlier attempt stopped after creating it. The staff visibility migration
also adds the admin-only account lookup used by `/staff` and refreshes the
Supabase API schema cache; run it before deploying the matching frontend.
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
are admin-only. Report records and case notes are private to authorized staff;
reporters cannot view submitted report details or resolutions. When a report
is finalized, its submitter receives only a generic notification that it was
reviewed (and, when actioned, that action was taken). The notification does not
identify staff, disclose the outcome, or link to report details. The reporting
RPC limits submissions and the staff workspace records moderation actions and
private case notes.

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

### Security event logging, avatars, and alerts

The security logging and upload migrations are
`20261102100000_security_event_pipeline.sql`,
`20261102110000_avatar_quarantine.sql`, and
`20261102120000_security_alert_outbox.sql`, followed by
`20261103210000_expand_security_event_coverage.sql` and
`20261103213000_discord_rich_security_alerts.sql`, followed by
`20261108190000_immediate_resilient_discord_delivery.sql`, followed by
`20261108213000_add_discord_content_excerpts.sql`. Apply them in timestamp
order after the earlier migrations. These migrations add safe project, post,
comment, and authenticated client-error events, queue all recorded events for
alerts, define 30-day audit retention, and format Discord alerts as timestamped
embeds with names and project titles where available. Message bodies, post and
comment text, and raw error messages are not included in full; Discord embeds
include sanitized excerpts up to 200 characters from public feed/forum posts,
comments, and report details. A report excerpt may contain copied private-
message text and is retained by Discord independently. Audit persistence
remains disabled by default. In a separate Supabase project, deploy the
`avatar-upload` function before applying the avatar policy migration:

```bash
supabase functions deploy avatar-upload
```

Apply the seven migrations, deploy the other workers, then deploy the
frontend so avatar uploads use the checked server-side path:

```bash
supabase functions deploy discord-security-alerts --no-verify-jwt
supabase functions deploy cleanup-avatar-quarantine --no-verify-jwt
supabase functions deploy delete-account
```

As of 3 November 2026, the base schema and initial nine migrations and four
functions have been deployed and checked in staging. The expanded event
coverage migration was subsequently run manually in the staging SQL Editor;
project, feed-post, and forum-post events were verified delivered to Discord.
The rich-embed migration and updated Discord worker have now been deployed to
staging, and the user confirmed that an embed arrived successfully. A Vercel
Preview uses staging-only settings; sign-in and avatar update have passed.
Staging cleanup and Discord schedules are configured. Verify audit logging is
off after testing. The 1.7.0 immediate-wakeup migration and worker have been
applied/deployed to staging. The 1.8.0 content-excerpt migration and updated
worker have also been applied/deployed to staging, and the user confirmed the
content appears in Discord. The 1.8.1 button-style update is local and has not
been deployed. Nothing has been deployed to production. For the
PowerShell CLI setup, fresh-project bootstrap, staging checks, and safe
production sequence, follow the
[security deployment runbook](Documentation/SECURITY-LOGGING-DEPLOYMENT-RUNBOOK.md).

The avatar path accepts JPEG, PNG, and WebP files up to 5 MB, checks their
signature and dimensions, decodes and re-encodes them as PNG, and only then
publishes them to the public `media` bucket. Unprocessed bytes use the private
`avatar-quarantine` bucket. Direct authenticated uploads and overwrites in
`media` are disabled by the migration. The server allows at most 10 upload
attempts per account per hour. Store an `AVATAR_CLEANUP_SECRET` as an Edge
Function secret and schedule `cleanup-avatar-quarantine` with the
`x-avatar-cleanup-secret` header; it removes private objects older than one
hour. Each invocation processes at most 1,000 expired objects and returns
`more_pending`; run it again promptly if more work remains. The schedule is
not created automatically.

The migration adds server-generated events for account creation/deletion,
reports, moderation, role and restriction changes, private-message evidence
views, and message submissions. Audit reads are limited to admins through the
staff workspace's **Security events** tab. The audit table is append-only for
ordinary app roles, but not immutable to Supabase project operators. A
server-side 30-messages-per-minute limit and a repeated-message signal are
also enabled; the signal does not copy message text or automatically restrict
an account.

Routine audit persistence is **disabled by default** because the event
retention period and audience/privacy review still need approval. Keep it
disabled until those decisions are documented. After approval, an operator
can enable it from the Supabase SQL Editor:

```sql
update security.configuration
set audit_enabled = true
where singleton = true;
```

Do not collect source IPs, device identifiers, passwords, tokens, raw request
bodies, uploaded bytes, private-message bodies, or original filenames in the
event table. Sign-in success/failure and password-reset events are not
currently written to BACKLINE; use the trusted Supabase Auth platform logs
until an app-side source is verified.

Discord delivery is optional and remains unconfigured by default. Only after
approving the private channel, membership, response owner, and alert policy,
store `DISCORD_SECURITY_WEBHOOK_URL` and a separate random
`SECURITY_WORKER_SECRET` as Edge Function secrets (never as `VITE_*` values).
Set them with the Supabase secrets manager. The scheduled worker endpoints
disable platform JWT verification and require their distinct secret header on
every POST. Schedule `discord-security-alerts` to send POST requests with the
`x-security-worker-secret` header. The worker sends only allowlisted event
metadata, disables Discord mentions, retries transient failures, and records
delivery/dead-letter status. Missing Discord configuration leaves queued
alerts pending and does not block application actions.

Do not enable routine production audit logging before approving retention.
The retention policy for case evidence and quarantined objects must also be
reviewed before production; the one-hour quarantine cleanup is a conservative
implementation default, not a substitute for that review. Validate migrations,
functions, access boundaries, and outage behavior in a separate Supabase
project before production rollout.

For a detailed explanation of the implementation, see the
[security implementation logbook](Documentation/SECURITY-LOGGING-IMPLEMENTATION-LOGBOOK.md).
For the staged deployment sequence and verification checklist, see the
[security deployment runbook](Documentation/SECURITY-LOGGING-DEPLOYMENT-RUNBOOK.md).

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
media stored under that user's ID in the `media` bucket and temporary avatar
objects in `avatar-quarantine` (after applying the security migration). The
deletion endpoint is a Supabase Edge Function; deploy it to the same project
as the frontend:

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
