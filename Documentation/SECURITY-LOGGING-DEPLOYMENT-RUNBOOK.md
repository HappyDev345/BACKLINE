# Security Logging and Monitoring Deployment Runbook

## Purpose and current status

This runbook gives the intended step-by-step sequence for deploying the
version 1.8.0 security logging, avatar upload, cleanup, and optional alert
changes to a **separate Supabase project first**.

Initial staging deployment was completed on 2026-11-02: the base schema and
nine migrations were applied; database lint passed; and the four Edge
Functions were verified active. The frontend was connected locally and a
signed-in avatar upload passed. The staging cleanup secret and hourly schedule
are configured and the worker returned HTTP 200 in a manual test. A Vercel
Preview with Preview-scoped staging Supabase variables is deployed, and the
user confirmed they can sign in. A private staging Discord webhook and
separate worker secrets are configured. A synthetic `report.created` event
was delivered successfully in a one-time manual worker run (HTTP 200); audit
logging was confirmed off afterward. The user then created a one-minute
staging Discord schedule; two cron runs are recorded as `succeeded`. The
corresponding scheduled `pg_net` calls returned HTTP 200; five empty-queue
runs reported `Processed 0 security alert(s)`. A recent outbox query found
exactly two expected, delivered staging events: the synthetic
`report.created` event and the `upload.rejected` event (`invalid_image`) from
the invalid avatar test. The browser displayed rejection, but the backend
also processed it and recorded the event while audit logging was temporarily
on. Both events were delivered, reconciling the two-alert worker response.
On 2026-11-15, the user confirmed audit logging is off after testing. Read
permissions were verified for normal and feed-moderator roles; both saw zero
audit rows and had no insert privilege, while a temporary Staging admin loaded
the admin event screen. Both temporary roles were removed. A synthetic report
alert was delivered after one attempt; its excerpt measured 15 characters and
the checked prohibited metadata keys were absent. The quarantine bucket is
private, and no Storage `INSERT`, `UPDATE`, or `ALL` policies were present.
Additional Staging avatar tests confirmed valid JPEG/WebP processing,
unsupported-type and MIME-mismatch rejection, and malformed-image rejection
with no recent quarantine residue. The scheduled cleanup worker deleted an
expired synthetic object, and a separate manual run left a fresh synthetic
object untouched. Frontend size and server-side dimension/pixel-limit
rejections are verified. Large accepted-image resizing, the server-side
streaming-size cap, quota exhaustion, replacement-failure, account-deletion,
and delivery-failure tests remain. Nothing has been deployed to production.

Routine audit logging must remain disabled until the privacy/safeguarding and
retention gates in this document are approved. Do not treat this guide as
authorization to deploy directly to production.

For architecture and code details, read the
[implementation logbook](./SECURITY-LOGGING-IMPLEMENTATION-LOGBOOK.md).
For current scope and outstanding design choices, read the
[security plan](./SECURITY-LOGGING-AND-MONITORING-PLAN.md).

## Non-negotiable safety rules

1. **Use a non-production project for the first deployment.** Keep production
   users, media, and staff data out of initial tests.
2. **Back up and identify the target project before each SQL change.**
   Confirm the project name, project ref, and environment in the dashboard.
3. **Do not apply `supabase/schema.sql` to an existing project as a shortcut.**
   The existing-project procedure is to apply only migrations that have not
   already been applied.
4. **Apply the avatar Edge Function before the avatar policy migration.**
   That migration removes direct authenticated uploads to `media`; deploying
   the new client/server path first prevents the change from leaving the
   intended release without its replacement upload endpoint.
5. **Deploy the matching frontend after the migrations and functions.**
   Older clients still attempt direct avatar upload and will not use the new
   function.
6. **Keep secrets out of source, frontend variables, chat, shell history,
   screenshots, and logs.** Use the Supabase project secrets UI or an
   approved secret manager.
7. **Do not enable routine audit collection yet** unless audience/minor
   safeguarding, event/case retention, and incident ownership have been
   reviewed and recorded.
8. **Do not enable Discord by default.** Configure it only after approving
   the private channel, membership, response owner, and alert policy.
9. The migrations do not include rollback scripts. A failed or partial
   migration requires careful diagnosis, backup-aware recovery, or a forward
   fix—not a blind rerun or guessed `DROP` statements.

## What will be deployed

| Component | Purpose | Default state after migration |
|---|---|---|
| `20261102100000_security_event_pipeline.sql` | Private audit event table, trusted writers/triggers, admin read policy, reported-message evidence audit, and message rate controls | Event persistence off; message rate limit set to 30/minute |
| `20261102110000_avatar_quarantine.sql` | Private quarantine bucket, upload quota, service-only upload RPCs, and removal of direct media insert/update policies | Quarantine bucket private; direct browser upload policy removed |
| `20261102120000_security_alert_outbox.sql` | Restricted event queue and claim/complete functions for optional alerts | Queue exists; the staging Discord webhook and worker are configured and manually tested |
| `20261103210000_expand_security_event_coverage.sql` | Project/feed/forum/comment audit events, authenticated client error events, all-event Discord queueing, and 30-day log purge function | Applied manually in staging SQL Editor on 2026-11-03; content event alerts were verified delivered. Confirm migration history separately. |
| `20261103213000_discord_rich_security_alerts.sql` | Event-time display names/usernames, project-title metadata, and rich Discord embeds | Applied manually in staging SQL Editor; rich-embed delivery confirmed by the user. Confirm migration history separately. |
| `20261108190000_immediate_resilient_discord_delivery.sql` | Immediate best-effort wake-up, Discord-aware send pacing/retries, backlog draining, and retention protection for undelivered alerts | Applied manually in staging SQL Editor on 2026-11-08; updated worker deployed. Immediate delivery and scheduled polling were confirmed. Requires `pg_net` and the two configured Vault entries; production rollout remains separate. |
| `20261108213000_add_discord_content_excerpts.sql` | Sanitized post/comment/report excerpts (max 200 characters) in Discord embeds | Applied manually and worker deployed to staging; excerpt delivery confirmed. Report details may quote private messages; Discord copies are outside database retention. |
| `avatar-upload` | Authenticated image validation, decode/re-encode, and publication | Deployed to staging; valid PNG/JPEG/WebP uploads and normalization were verified. Unsupported type, MIME mismatch, malformed-image, frontend size-limit, server dimension, and pixel-limit rejection passed. Large accepted-image resizing, server streaming-size cap, quota exhaustion, and replacement-failure checks remain. |
| `cleanup-avatar-quarantine` | Removes private quarantine objects older than one hour | Staging secret and hourly schedule are configured; scheduled expired-object deletion and fresh-object preservation passed. Invalid-secret checks passed. Batch-bound and scheduler log-redaction tests remain. |
| `discord-security-alerts` | Delivers queued outbox events as privacy-minimal Discord embeds | Staging webhook/worker configuration and one-minute schedule are active; delivery and invalid-secret checks passed. Retry, dead-letter, and outage tests remain. |
| `delete-account` | Removes account media from both buckets before account removal | Staging deployment and implementation version should be verified before dedicated account-deletion tests. |
| Frontend | Sends connected-mode avatars to the new upload function and exposes admin event view | Vercel Preview uses staging settings; sign-in and avatar update were confirmed. Version 1.8.1 button styling is local and not deployed. |

## Phase 0 — Obtain approval and designate owners

Do this before production. It is also recommended before a staging test that
uses real people or meaningful personal information.

### 0.1 Privacy and safeguarding review

- Confirm the intended user audience and whether minors may sign up or use
  the service.
- Current decision: the user confirmed minors may use BACKLINE. Complete the
  appropriate privacy/safeguarding review before any Production collection.
- Ask the appropriate privacy/safeguarding owner to review the event fields,
  staff visibility, evidence handling, avatar processing, and optional
  external Discord delivery.
- Confirm what notice or user-facing policy is required for security event
  collection and staff review.
- Record who approved the review, when, the project/environment covered, and
  any conditions. Do not store sensitive review evidence in source control.

### 0.2 Retention and deletion decision

Write down a retention/deletion rule for each category before enabling
routine audit collection:

- Routine security event metadata.
- Report and case evidence, including private-message evidence.
- Discord alert copies and any downstream channel retention.
- Private quarantine objects.

The current quarantine worker deletes objects older than one hour, but that
default is not itself a complete retention policy. The project still needs
an owner for legal holds, deletion verification, and response to failed
cleanup.

Current decisions: 30 days is the intended retention for routine audit
events; report/case evidence and Discord retention remain undecided. Routine
audit logging stays off except for brief synthetic Staging tests until the
appropriate review approves ongoing collection.

### 0.3 Incident and operations ownership

Name a person or team who will:

- Review admin-only audit events and high-severity alerts.
- Respond to Discord failures, dead letters, and backlog.
- Respond to audit-write failures and cleanup failures.
- Own periodic access reviews and retention/deletion checks.
- Escalate a suspected account compromise or unsafe upload.

If no one owns these responsibilities, do not enable routine collection or
Discord delivery.

Current Staging owner: the project owner will review alerts and respond to
queue, dead-letter, audit-write, and cleanup failures. Confirm Production
ownership separately.

## Phase 1 — Prepare a safe target environment

### 1.1 Create or select a separate Supabase project

1. Create a Supabase project intended for development/preview validation,
   separate from production.
2. Record its project name, project ref, region, database version, and
   dashboard URL in your internal deployment record.
3. Confirm that you have project-owner/admin access and can deploy Edge
   Functions, run SQL, manage Storage, and configure secrets.
4. Do not paste project secrets into this document or commit them.
5. If testing uses personal or production-derived data, stop and obtain the
   required approval; prefer synthetic test accounts and content.

### 1.2 Confirm repository and release state

From the repository root in PowerShell:

```powershell
git status --short
git branch --show-current
node --version
npm --version
npm ci
npm run build
& .\node_modules\.bin\supabase.cmd --version
```

Confirm that the intended source revision contains version `1.8.1` in
`package.json` and the root package records in `package-lock.json`.
Inspect `git status` carefully: do not discard uncommitted changes or include
unrelated files in a release.

Run the local Edge Function checks if Deno is available:

```powershell
deno lint --no-config `
  supabase\functions\avatar-upload\index.ts `
  supabase\functions\avatar-upload\imageValidation.ts `
  supabase\functions\avatar-upload\imageValidation_test.ts `
  supabase\functions\cleanup-avatar-quarantine\index.ts `
  supabase\functions\discord-security-alerts\index.ts `
  supabase\functions\delete-account\index.ts

deno check `
  supabase\functions\avatar-upload\index.ts `
  supabase\functions\avatar-upload\imageValidation_test.ts `
  supabase\functions\cleanup-avatar-quarantine\index.ts `
  supabase\functions\discord-security-alerts\index.ts `
  supabase\functions\delete-account\index.ts

deno test supabase\functions\avatar-upload\imageValidation_test.ts
```

If Deno is not installed, install it using the official Deno installation
instructions for your workstation, then rerun the checks. The Deno runtime
is used here for Edge Function development; it is not a frontend dependency.

### 1.3 Use the branch's local Supabase CLI

The CLI is already installed as a project dependency; a global Windows
`supabase` command is not required. Run it from the repository root in
PowerShell as:

```powershell
& .\node_modules\.bin\supabase.cmd --version
```

The expected version in this branch is `2.122.0`. The local
`supabase\config.toml` has been initialized. Its `project_id` is a local
configuration label; it does **not** identify or link to a hosted Supabase
project. `supabase link --project-ref ...` performs that link. The local
config contains settings for local development and does not contain project
credentials.

Do not run `supabase db push` against production as part of this guide. The
SQL files are applied and verified one at a time through the Dashboard so
operators can check target and result at each step.

### 1.4 Create a database backup/recovery point

Before applying any migration:

1. Use the Supabase dashboard's supported backup/export facility or the
   organization's approved database backup process.
2. Record the backup time and verify that the restore path is understood.
3. If supported by the project, enable point-in-time recovery according to
   the project's operational requirements.
4. Remember that database backups do not necessarily capture every Storage
   object. Confirm the recovery strategy for `media` and quarantine objects
   separately.

For a fresh disposable staging project, record that it contains no required
data rather than skipping target confirmation.

## Phase 2 — Link the Supabase CLI to staging

Use the correct staging project ref, not a production ref:

```powershell
& .\node_modules\.bin\supabase.cmd login
& .\node_modules\.bin\supabase.cmd link --project-ref <STAGING_PROJECT_REF>
```

The login flow is interactive and should be completed in the terminal.
Never write an access token into this runbook. After linking, verify the
project name/ref in the CLI output and the dashboard before deploying.

If using a CLI flag that accepts a project ref on each command, verify that
the ref is the staging ref before every deployment command. Do not rely on
memory or a previously selected dashboard tab.

## Phase 3 — Deploy the avatar function first

This order is intentional: the next migration removes the browser's direct
upload policy for public `media`.

From the repository root:

```powershell
& .\node_modules\.bin\supabase.cmd functions deploy avatar-upload --project-ref <STAGING_PROJECT_REF>
```

The function uses these Supabase server environment values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase normally provides project environment values to Edge Functions.
Check the current Supabase function environment documentation/dashboard for
the project and confirm that the function has the required values. Never
place the service-role key in the React app, a `VITE_*` variable, source
control, a browser request, or this guide.

At this point the new function exists, but do not assume the storage policy
or frontend has changed yet.

## Phase 4 — Apply the base schema and migrations

The security migrations depend on BACKLINE's profiles, messaging, reports,
staff, and Storage setup. A **brand-new Supabase project** has none of those
application tables, so it needs the base schema plus all earlier migrations
before the three new security migrations.

### 4.1 Fresh staging project

The commands below are for a newly created, empty staging project only. Run
them from the repository root in PowerShell, with the local CLI linked to the
staging project. Do not run these commands against an existing production
database.

First, confirm that the target really is empty. The query below should return
no application tables:

```powershell
& .\node_modules\.bin\supabase.cmd db query --linked "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;"
```

If it returns any application tables, stop and determine whether this is the
right target before continuing.

Apply BACKLINE's base schema:

```powershell
& .\node_modules\.bin\supabase.cmd db query --linked --file .\supabase\schema.sql
```

Then preview the timestamped migrations:

```powershell
& .\node_modules\.bin\supabase.cmd db push --linked --dry-run
```

Read the preview carefully. For a fresh project it should list thirteen files,
in order: the six existing migrations from October 2026 followed by the seven
new migrations from November 2026. If it lists anything unexpected, or
complains about local/remote history, stop rather than guessing.

If the preview is exactly right, apply those migrations:

```powershell
& .\node_modules\.bin\supabase.cmd db push --linked
```

Read the CLI confirmation prompt and verify the project/ref and migration
list before answering `y`. This records the migration versions in Supabase's
migration history. Do not add `--yes` when you want the extra confirmation.

The seven new files are:

1. `supabase/migrations/20261102100000_security_event_pipeline.sql`
2. `supabase/migrations/20261102110000_avatar_quarantine.sql`
3. `supabase/migrations/20261102120000_security_alert_outbox.sql`
4. `supabase/migrations/20261103210000_expand_security_event_coverage.sql`
5. `supabase/migrations/20261103213000_discord_rich_security_alerts.sql`
6. `supabase/migrations/20261108190000_immediate_resilient_discord_delivery.sql`
7. `supabase/migrations/20261108213000_add_discord_content_excerpts.sql`

### 4.2 Existing project or uncertain migration history

Do not run `supabase/schema.sql` on an existing project. First inspect its
actual objects and migration history. A blank remote migration history does
not prove that the schema is empty; it may mean earlier SQL was applied
manually.

Use the following read-only check:

```powershell
& .\node_modules\.bin\supabase.cmd migration list --project-ref <PROJECT_REF>
```

Only push migrations when the remote history and actual database schema agree
with the local files. If migrations were applied manually or the history is
missing/mismatched, stop and have an operator reconcile the migration history
against the real schema. Do not run `db push` merely because it has a dry-run
option: it will offer every migration it believes is missing.

For any SQL Editor/manual route, confirm the project ref, run only verified
unapplied SQL in timestamp order, stop on the first error, and inspect what
committed before proceeding. The repo does not provide down-migrations.

### 4.2 Verify migration objects

Check these properties in the dashboard or through a read-only SQL query:

- `security.configuration` exists and its singleton row has
  `audit_enabled = false` and `message_limit_per_minute = 30`.
- `public.security_audit_events` exists with RLS enabled.
- The policy named `admins read security audit events` is attached to that
  table.
- `security.avatar_upload_usage` and `public.avatar-quarantine` exist.
- The `avatar-quarantine` bucket is private and has the expected file size
  and MIME restrictions.
- The `public.claim_avatar_upload_slot`,
  `public.log_upload_security_event`, and
  `public.list_expired_avatar_quarantine_objects` functions exist with
  service-role-only execution.
- The message rate-limit trigger exists on `public.messages`.
- `public.security_alert_outbox` exists with RLS enabled and no normal client
  table grants.
- The outbox trigger is attached to audit events.
- The new content event triggers are attached to `public.projects`,
  `public.posts`, and `public.comments`, and record no content fields.
- The all-event outbox trigger queues every persisted audit event.
- `public.log_client_error` is executable by authenticated users only and
  stores a fixed operation key and sanitized error category, not raw text.
- `security.purge_expired_security_events()` deletes audit events older than
  30 days; configure the daily schedule only after applying the migration.

Run these checks as a project operator, not by granting broader client
permissions just to make a test query work. Then lint the linked database:

```powershell
& .\node_modules\.bin\supabase.cmd db lint --linked
```

Finally, confirm that remote migration history matches the local files:

```powershell
& .\node_modules\.bin\supabase.cmd migration list --project-ref <STAGING_PROJECT_REF>
```

### 4.3 Confirm storage policy impact

The avatar migration drops the named direct insert policy
`authenticated uploads media` and the named `owners update media` policy.
Confirm the remaining Storage policies match the intended application
behavior. Do not assume that dropping those named policies removes every
other policy in a project; inspect the actual policy list for `storage.objects`.

The public `media` bucket remains public for reads. The migration is intended
to change the admission path for new writes, not to make existing avatars
private or to bulk reprocess them.

## Phase 5 — Deploy the remaining Edge Functions

Deploy to the same staging project:

```powershell
& .\node_modules\.bin\supabase.cmd functions deploy cleanup-avatar-quarantine --no-verify-jwt --project-ref <STAGING_PROJECT_REF>
& .\node_modules\.bin\supabase.cmd functions deploy discord-security-alerts --no-verify-jwt --project-ref <STAGING_PROJECT_REF>
& .\node_modules\.bin\supabase.cmd functions deploy delete-account --project-ref <STAGING_PROJECT_REF>
```

### 5.1 Apply the 1.6.0 rich Discord alert update to the current staging project

The expanded event-coverage migration was applied to this staging project
manually through SQL Editor. Do not run `supabase db push` against it until
the manually applied migration history has been reconciled.

1. Confirm the Supabase Dashboard is showing the staging project.
2. Open `supabase/migrations/20261103213000_discord_rich_security_alerts.sql`,
   copy its full contents into a new SQL Editor query, and run it. Stop if the
   editor reports an error.
3. From the repository root, deploy the updated worker to that same staging
   project:

   ```powershell
   & .\node_modules\.bin\supabase.cmd functions deploy discord-security-alerts --no-verify-jwt --project-ref <STAGING_PROJECT_REF>
   ```

4. Verify the function deployment in Supabase. Keep `audit_enabled` off until
   you are ready for a staging test. For a test, enable it briefly, create a
   test project, and verify that Discord shows the display name/username,
   project title, timestamp, and green activity color. Then turn auditing off
   again. Error-colored embed behavior can be checked with a safe synthetic
   error event; do not generate real user errors to test the color.

This update snapshots an event-time display name and username (and account
target names where applicable) plus project titles. These values and account
IDs are sent to Discord, where they are outside the database's 30-day purge.
Do not use sensitive project titles in testing, and review Discord channel
access and message retention before enabling routine alerts.

### 5.2 Apply the 1.7.0 immediate-wakeup delivery update

The migration uses `pg_net` to wake the alert worker after an outbox entry is
created. It does not send the Discord webhook from the application database
transaction. The durable outbox remains the source of truth; keep the existing
scheduled worker enabled as a backup.

1. In **Database → Extensions**, confirm `pg_net` is enabled.
2. In **Database → Vault**, add these entries without pasting their values
   into SQL or source control:
   - `backline_project_url`: the staging Supabase project URL.
   - `discord_security_worker_secret`: the same secret value configured as
     the Edge Function secret `SECURITY_WORKER_SECRET`.
3. Confirm `audit_enabled = false`, then apply
   `supabase/migrations/20261108190000_immediate_resilient_discord_delivery.sql`
   to the staging SQL Editor. Stop on any SQL error.
4. Deploy the updated worker to the same staging project:

   ```powershell
   & .\node_modules\.bin\supabase.cmd functions deploy discord-security-alerts --no-verify-jwt --project-ref <STAGING_PROJECT_REF>
   ```

5. Keep the existing one-minute Discord schedule active as a backup. Test in
   staging by briefly enabling audit, creating one test project, and verifying
   an embed arrives promptly. Check that the outbox status becomes `delivered`,
   then turn audit logging off again.

The database applies a shared pace of up to four alert claims per rolling
two-second window. The worker processes alerts one by one, drains due backlog
for a bounded period, and honors Discord `Retry-After`. No system can deliver
during an indefinite outage. A Discord acceptance followed by a lost response
can result in a duplicate on retry; delivery is at-least-once, not exactly-once.

### 5.3 Apply the 1.8.0 content-excerpt update

This update copies up to 200 characters from public feed/forum posts,
comments, and report details into restricted audit metadata and Discord.
Report details can include sensitive allegations or a quote copied from a
private message. The excerpt is also kept in Discord independently of the
30-day database retention. Keep the Discord channel private; do not test with
real private-message text or sensitive report details.

1. Confirm audit logging is off and the Dashboard is on the staging project.
2. Apply `supabase/migrations/20261108213000_add_discord_content_excerpts.sql`
   in the staging SQL Editor.
3. Deploy the updated Discord worker:

   ```powershell
   & .\node_modules\.bin\supabase.cmd functions deploy discord-security-alerts --no-verify-jwt --project-ref <STAGING_PROJECT_REF>
   ```

4. Briefly enable audit logging and create a clearly labelled synthetic post
   and comment with harmless test text. Verify the embed shows no more than
   200 characters and that mentions/URLs cannot ping users or open links.
   For a report test, use only harmless synthetic details such as
   `Staging test excerpt`; never paste private conversations.
5. Turn audit logging off again. Confirm the outbox reports `delivered` and
   the audit event stores only the bounded excerpt fields.

`cleanup-avatar-quarantine` and `discord-security-alerts` are scheduled
workers. Their platform JWT verification is disabled because they authenticate
with their own separate secret headers. **Do not remove the custom-header
checks or reuse the same secret for both workers.** The avatar upload and
account-deletion functions retain normal Supabase JWT verification.

Verify each function deployment in the dashboard. Review logs for configuration
errors without copying secrets, access tokens, raw uploaded bytes, or private
user content into diagnostics.

## Phase 6 — Configure worker secrets safely

Use the Supabase project's Edge Function secrets UI or the organization's
approved secret manager. Do not place secret values in frontend hosting
settings or commit them.

### 6.1 Avatar cleanup secret

Generate a high-entropy random secret (at least 32 random bytes) with a
password manager or another approved secret generator. In the staging
project's dashboard:

1. Add it under **Edge Functions → Secrets** as `AVATAR_CLEANUP_SECRET`.
2. Add the exact same value in **Database → Vault** with the name
   `avatar_cleanup_secret`.
3. Add the staging project URL in Vault with the name
   `backline_staging_project_url` (for example,
   `https://<STAGING_PROJECT_REF>.supabase.co`).

Do not paste the secret into chat, SQL, a file, or a URL. The Edge Function
uses the first copy to authenticate the scheduler; the scheduled SQL reads
the second copy from Vault to set the `x-avatar-cleanup-secret` header. A
request without the correct header should receive `401`. A missing
server-side secret should produce a `503` and a sanitized server log.

### 6.2 Optional Discord secrets

Only if Discord has been approved, configure:

- `DISCORD_SECURITY_WEBHOOK_URL` — the private channel's Discord webhook URL.
- `SECURITY_WORKER_SECRET` — a separate high-entropy random worker secret.
- Header name required by the worker: `x-security-worker-secret`.

Restrict the private channel membership, use a dedicated webhook, document
who receives and acts on alerts, and plan for webhook rotation. Treat the
webhook URL itself as a credential. If Discord is not approved, do not set
these secrets and do not schedule the alert worker.

### 6.3 Supabase runtime variables

Verify that each function has its required built-in Supabase environment
variables. Do not manually copy the service-role key into a client-accessible
place. If the project requires an explicit function secret for one of the
standard values, use the project's secure secrets interface and follow
Supabase's current guidance.

## Phase 7 — Schedule the workers

Schedules are not created by these migrations. Use an approved scheduler
that can make HTTPS POST requests and store custom headers as protected
secrets. A scheduler may be Supabase's supported scheduled-function
mechanism or an approved external scheduler; validate the current platform
procedure for the chosen project.

### 7.1 Quarantine cleanup schedule

For Supabase's scheduler, first verify that `pg_cron` and `pg_net` are enabled
under **Database → Extensions**. In the staging project's **SQL Editor**, run
this once to schedule an hourly POST. The SQL contains only Vault lookups;
secret values must not be substituted into it:

```sql
select cron.schedule(
  'backline-avatar-quarantine-cleanup',
  '0 * * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'backline_staging_project_url'
    ) || '/functions/v1/cleanup-avatar-quarantine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-avatar-cleanup-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'avatar_cleanup_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
```

To test immediately without waiting for the next hourly run, execute the
`net.http_post` statement above by itself (without the surrounding
`cron.schedule(...)`). It returns a request ID. After the asynchronous
request completes, inspect only that response:

```sql
select id, status_code, content, error_msg
from net._http_response
where id = <REQUEST_ID>;
```

Expect HTTP `200` and a JSON body containing `inspected`, `removed`, and
`more_pending`. Confirm the job is registered and inspect its run history:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'backline-avatar-quarantine-cleanup';

select runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'backline-avatar-quarantine-cleanup'
)
order by start_time desc
limit 5;
```

`pg_net` dispatches asynchronously and keeps request/response records
temporarily. Treat database access to its request queue as privileged because
the custom header is decrypted while the request is pending.

Expected behavior:

- A successful response reports `inspected`, `removed`, and `more_pending`.
- A run removes at most 1,000 expired objects.
- If `more_pending` is `true`, configure a prompt follow-up invocation or
  alert the operator; otherwise stale private uploads may remain longer than
  intended.
- A non-2xx response should page/log to the cleanup owner, without logging
  the secret header.

Do not pass the secret in a query parameter or URL.

### 7.2 Optional Discord worker schedule

If approved, configure a POST schedule to the `discord-security-alerts`
function URL with `x-security-worker-secret` in the protected header store.
Keep the existing one-minute schedule as a fallback for missed wake-ups and
deferred retries; new outbox inserts also request immediate worker wake-up
after the 1.7.0 migration is applied and Vault is configured. The database
limits dispatch to four claims per rolling two-second window and Discord may
impose additional rate limits. Monitor non-2xx responses, pending backlog, and
dead-letter rows.

Use this query to check queue health without exposing alert payloads:

```sql
select status, count(*) as alerts,
       min(created_at) as oldest_created,
       min(last_attempt_at) as oldest_last_attempt
from public.security_alert_outbox
group by status
order by status;
```

`dead_letter` means the worker exhausted its automatic retry budget; the event
is retained for operator review. To retry a confirmed-fixed delivery issue,
reset only the selected event after checking the cause:

```sql
update public.security_alert_outbox
set status = 'pending',
    attempt_count = 0,
    next_attempt_at = now(),
    last_error_code = null,
    updated_at = now()
where event_id = '<EVENT_UUID>'
  and status = 'dead_letter';
```

Test delivery and outage behavior in staging before enabling the schedule in
production.

### 7.3 Audit-event retention

The expanded event-coverage migration defines
`security.purge_expired_security_events()`, which removes delivered audit
events older than 30 days and their associated outbox rows. The 1.7.0
delivery migration protects pending, sending, and dead-letter alerts from
purge so undelivered alerts are not silently discarded. Dead-letter records
remain until an operator resolves them. Purging database rows does **not**
delete Discord messages already sent; Discord retention must be reviewed
separately.

After applying the migration and confirming `pg_cron` is enabled, schedule a
daily purge in the target project:

```sql
select cron.schedule(
  'backline-security-audit-retention',
  '15 2 * * *',
  $$select security.purge_expired_security_events();$$
);
```

Verify the job in `cron.job` and inspect `cron.job_run_details` after its first
run. Do not configure production retention until the approved policy and any
legal-hold requirements are recorded.

## Phase 8 — Configure and deploy the frontend

Set the frontend host's environment variables to the same staging project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are public frontend configuration values. Never use a service-role key
or Discord webhook as a `VITE_*` value.

Build and deploy the matching frontend:

```powershell
npm ci
npm run build
```

Deploy the generated `dist` output using the project's existing static
hosting pipeline. Do not deploy a frontend build that points to production
while you are testing migrations in staging, or vice versa.

Confirm in the deployed app that:

- Connected avatar updates invoke the `avatar-upload` function.
- Preview mode still uses local preview data and does not send files to
  Supabase.
- The staff page exposes **Security events** only to admins.
- Ordinary users receive a useful rate-limit message rather than raw SQL
  errors.
- The hosted Vercel Preview is connected to staging, and a staging user can
  sign in, sees connected mode (no sample-data banner), and can update an
  avatar. These were user-confirmed smoke tests, not completion of the broader
  access, avatar, or privacy tests below. The public `media` bucket means
  uploaded avatars may be publicly readable; test only with non-identifying
  images.

## Phase 9 — Staging verification checklist

Use synthetic accounts and a controlled test project. Record the date,
project ref, tester, and pass/fail for each item. Avoid testing with real
private conversations or production accounts.

### 9.1 Authentication and configuration

- [x] An unauthenticated avatar request is rejected. The recorded Staging
      smoke test returned HTTP 401 for `avatar-upload`.
- [x] A valid authenticated test account can reach the upload processor. The
      synthetic PNG upload was accepted through `avatar-upload` and updated
      the Staging test account's avatar on 2026-11-15.
- [ ] A suspended test account cannot update its avatar. The function's
      source checks suspension before upload and returns HTTP 403, but the
      live Staging test is pending; no in-app admin account is currently
      available to perform the supported suspend/reinstate flow.
- [x] A missing worker secret returns an explicit unavailable response. The
      recorded unauthenticated Staging smoke test returned HTTP 503 while
      worker secrets were intentionally unset.
- [x] An incorrect worker header is rejected. On 2026-11-15, deliberately
      invalid dummy headers returned HTTP 401 `Not authorized.` from both
      Staging workers; no real secret was sent.
- [x] No service-role key, webhook URL, or worker secret identifier appears
      in frontend source or the production build. On 2026-11-15, the frontend
      referenced only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the
      local `.env*` files contained only those variable names, and a scan of
      the built JavaScript found no service-role, webhook, or worker-secret
      identifiers. The anon key is intended to be public.
- [x] Inspect captured browser requests for server-only credentials. On
      2026-11-15, the user reviewed all Supabase request rows captured during
      a Staging Preview reload; neither worker-secret header name appeared,
      and no Discord webhook request appeared. This was a check of that
      session's captured traffic, not every possible application path. No
      header values or tokens were shared.
- [x] Check the Staging Auth email-confirmation setting explicitly. On
      2026-11-15, the Dashboard showed **Confirm email enabled**. This records
      the current setting only; it does not verify the signup flow or establish
      the intended Production policy.

### 9.2 Avatar handling

- [x] Upload a small valid JPEG, PNG, and WebP; each is accepted and publicly
      served as a normalized PNG. On 2026-11-15, the synthetic 1x1 PNG and
      synthetic 2x2 JPEG/WebP uploads were accepted through `avatar-upload`
      and updated the test account's avatar. A metadata-only aggregate after
      the sequential JPEG/WebP uploads found one recent `media` object, with
      PNG MIME type and no other/untyped objects; the later avatar replaced
      the earlier object. Local Deno tests also confirmed JPEG, PNG, and WebP
      decoding and PNG normalization. The fixtures were blank, so the JPEG
      appeared black and the WebP transparent; this was expected.
- [x] Upload an unsupported type; confirm it is rejected without publishing
      original bytes. On 2026-11-15, the synthetic text file was rejected by
      the Staging avatar UI and the avatar remained unchanged. Source review
      confirms this client-side check returns before invoking `avatar-upload`.
- [x] Upload a file with a mismatched declared type. On 2026-11-15, a
      synthetic valid PNG named `.jpg` was rejected in Staging, the avatar
      remained unchanged, and a read-only check found zero recent objects in
      `avatar-quarantine`.
- [x] Upload a malformed file with a plausible image MIME type. On
      2026-11-15, a synthetic non-image `.png` was rejected by the Staging
      `avatar-upload` endpoint with HTTP 415 and the avatar stayed unchanged.
      The invalid-signature check happens before quarantine/publication.
- [x] Upload one valid synthetic PNG. On 2026-11-15, the 1x1 test image was
      accepted through `avatar-upload`; the Staging account avatar updated,
      the new `media` object was PNG, and the upload processor's temporary
      quarantine object was removed. The separate manually uploaded
      cleanup-test object remained in quarantine.
- [x] Test a malformed file that passes signature inspection but fails safe
      image decoding. On 2026-11-15, the synthetic 24-byte PNG passed local
      2x2 signature/dimension inspection but failed `Image.decode`. On the
      Staging retry, the avatar flow rejected the file, the avatar remained
      unchanged, and a read-only check found zero recent objects in
      `avatar-quarantine`.
- [x] Confirm the frontend rejects images over 5 MiB. On 2026-11-15, the
      synthetic 5 MiB + 1 byte PNG was rejected with “Choose an image smaller
      than 5 MB,” and the avatar stayed unchanged. Source review confirms
      this returns before invoking `avatar-upload`; the server streaming-size
      limit has not been independently exercised.
- [x] Test a dimension over 4096 pixels. On 2026-11-15, a valid synthetic
      4097×1 PNG left the avatar unchanged. The Staging upload counter
      increased from 5 to 6 and the recent quarantine count stayed at zero,
      consistent with the server rejecting it before quarantine. The UI
      showed its generic safe error message rather than the specific 413 text.
- [x] Test an image within the per-side limit but over 8 megapixels. On
      2026-11-15, a valid synthetic 4096×2049 PNG left the avatar unchanged;
      the Staging upload counter advanced from 6 to 7 and the recent
      quarantine count remained zero. The UI showed its generic safe error
      message, consistent with server rejection before quarantine.
- [ ] Confirm large accepted images are resized to at most 1024 pixels on
      either side.
- [ ] Attempt more than 10 uploads within the quota window; excess requests
      are rejected.
- [ ] Confirm the original input is removed from private quarantine after a
      completed/rejected processing attempt, or that cleanup failures are
      surfaced for the operator.
- [x] Confirm `avatar-quarantine` is private. On 2026-11-15, the Staging
      bucket query returned `public = false` and a 5 MiB limit; `media` is
      public as intended.
- [x] Confirm direct authenticated writes to `media` are denied under the
      new policy set. On 2026-11-15, the Staging `pg_policies` check returned
      no `INSERT`, `UPDATE`, or `ALL` policies on `storage.objects`.
- [x] Confirm replacing an avatar updates the profile. On 2026-11-15, the
      synthetic JPEG and WebP uploads each updated the test profile; the
      aggregate after sequential uploads showed only the latest media object,
      consistent with the previous object being removed.
- [ ] Simulate failure to remove a previous avatar object and confirm the
      failure is visible in sanitized operational logs.

### 9.3 Message and audit behavior

1. Keep `audit_enabled = false` initially and verify the message rate limit
   still applies.
2. Use test users to verify rate-limit behavior, including a request that
   attempts to supply a stale `created_at` value if the client path allows
   testing it. The database must use server time for the inserted message.
3. [x] With privacy approval in staging, temporarily set
   `security.configuration.audit_enabled = true`. On 2026-11-15, a
   synthetic report was submitted while enabled, then audit logging was
   returned to `false` immediately afterward.
4. Submit a report, claim/resolve it as staff, add a staff note, perform a
   moderation action, change a test staff role/restriction, and submit a
   repeated identical message. Confirm expected event types and IDs.
5. [x] Confirm synthetic report and feed-post excerpts are capped and
   prohibited metadata keys are absent. On 2026-11-15, the report excerpt
   measured 15 characters and the feed-post excerpt measured 200; neither
   audit record had the checked prohibited keys. No excerpt text was included
   in the verification queries.
   - [x] On 2026-11-15, a synthetic feed alert was inspected in private
     Staging Discord: `@everyone` caused no ping, the example URL was
     neutralized, and markdown was escaped. The post was deleted afterward.
   - [x] On 2026-11-15, synthetic forum and comment excerpts were each
     capped at 200 characters; the forum title was capped at 100. The
     checked prohibited metadata keys were absent. Both Discord alerts
     arrived with mentions suppressed, URLs neutralized, and markdown
     escaped. The synthetic thread and comment were deleted afterward.
   - [x] On 2026-11-15, a read-only key-name screen of all 20 Staging audit
         events found zero metadata keys matching body/message/note/request,
         filename, IP/device, credential, or detail patterns. The query did
         not read metadata values and is not proof that every possible value
         or delivered Discord payload is free of sensitive content.
6. [x] Read the dashboard as an admin and confirm events load. On 2026-11-15,
   the temporary synthetic Staging admin loaded the event list (16 rows).
   The temporary admin role was removed after testing.
7. [x] Read as a normal non-admin user; access was denied by the UI, and a
   simulated authenticated-role query returned zero visible audit rows with
   no insert, update, or delete privileges.
   - [x] On 2026-11-15, a temporary `feed_moderator` Staging account opened
     `/staff` without admin-only tabs. Under the simulated authenticated
     moderator role, the audit query returned zero rows and insert privilege
     was false. The temporary moderator role was removed afterward.
8. Review a reported-message case and confirm the evidence access event is
   written while unrelated conversation history remains inaccessible.
9. [x] Return `audit_enabled` to `false` immediately after the synthetic
   report test. The user confirmed the Staging value is `false`.

### 9.4 Cleanup worker

- [x] Confirm the hourly Staging cleanup schedule is active. On 2026-11-15,
  `backline-avatar-quarantine-cleanup` was active at `0 * * * *`, and its
  latest run showed `succeeded`.
- [x] Create a clearly identified quarantine test object. The user uploaded
  `synthetic-quarantine-cleanup-test-20261115.png` to the Staging
  `avatar-quarantine` bucket root at `2026-11-15 05:51:48 UTC`.
- [x] Verify actual expired-object deletion. At `2026-11-15 07:22:36 UTC`,
  the object count was `0`; the cleanup job was active and its latest run
  succeeded at `2026-11-15 07:00:00 UTC`, after the test object became older
  than one hour. This confirms scheduled deletion in Staging. This check
  does not verify whether a `quarantine_expired` audit event was written.
- [x] Test an incorrect cleanup secret and confirm it is rejected. On
      2026-11-15, a deliberately invalid dummy header received HTTP 401 with
      `Not authorized.`; no real secret was sent.
- [ ] Test a dataset large enough to hit the 1,000-object bound and confirm
      `more_pending` is reported and a subsequent run completes the backlog.
- [x] Confirm recent objects are not deleted. On 2026-11-15, after a
      read-only count showed zero expired and zero recent quarantine objects,
      the user uploaded the synthetic
      `synthetic-quarantine-cleanup-test-20261115.png`. A manual Staging worker
      invocation returned HTTP 200 with `inspected: 0`, `removed: 0`, and
      `more_pending: false`; the user confirmed the object remained present.
      The user then deleted only that test object and confirmed the bucket was
      empty.
- [ ] Confirm scheduler logs never contain the secret header.

### 9.5 Optional Discord alert worker

Skip this section when Discord is not enabled.

- [x] Verify missing worker secrets are rejected. The recorded Staging
      unauthenticated smoke tests returned HTTP 503 while the worker secrets
      were intentionally unset.
- [x] Verify incorrect worker secrets are rejected. On 2026-11-15,
      deliberately invalid dummy headers returned HTTP 401 with
      `Not authorized.` from both Staging workers; no real secret was sent.
- [x] On 2026-11-15, a synthetic `report.created` event was recorded while
  audit logging was temporarily enabled, then audit logging was disabled.
  The outbox showed `delivered` after one attempt, and the user confirmed the
  alert arrived in the private Staging Discord channel. The event's excerpt
  length was 15 characters; no prohibited metadata keys were present.
- [x] On 2026-11-15, a synthetic `feed_post.created` alert was delivered to
  Staging Discord; the excerpt was 200 characters, `@everyone` did not ping,
  the example URL was neutralized, and markdown was escaped. The synthetic
  post was deleted afterward, and `audit_enabled` was confirmed `false`.
- [x] In staging, create one synthetic `report.created` event in a single
      transaction, turn audit collection back off, and manually invoke the
      worker. The worker returned HTTP 200 and reported processing two alerts;
      the user confirmed Discord messages arrived. A later aggregate query
      confirmed exactly two expected events, `report.created` / `discord_test`
      and `upload.rejected` / `invalid_image`, both marked delivered.
- [x] Confirm controlled Discord payload fields and mention suppression. On
      2026-11-15, source review confirmed the worker builds embeds from
      allow-listed event fields and sends `allowed_mentions: { parse: [] }`;
      the webhook URL and file bytes are not part of the JSON body. The user
      confirmed a synthetic `@everyone` post caused no ping in Staging.
- [x] Confirm public-content and report excerpts are capped at 200 characters
      and mentions/clickable URLs are neutralized. On 2026-11-15, Staging
      records showed report excerpt length 15 and feed/forum/comment excerpt
      lengths 200 (forum title 100); checked prohibited metadata keys were
      absent. Delivered Discord examples escaped markdown and neutralized
      URLs/mentions. Source review confirms staff-note bodies are not included
      in the worker's embed fields.
- [ ] Simulate a transient failure safely and verify attempt count, backoff,
      retry, and eventual delivery.
- [ ] Simulate a permanent/exhausted failure and verify dead-letter state and
      operator visibility.
- [ ] Confirm a Discord outage does not block the underlying report,
      moderation, or account action.
- [x] Configure a one-minute recurring staging schedule after the successful
      manual delivery test; the user confirmed two scheduled cron runs have
      `succeeded` status and five scheduled `pg_net` responses returned HTTP
      200 with an empty queue.

### 9.6 Account deletion

- [ ] Delete a dedicated test account that has objects in both `media` and
      `avatar-quarantine`.
- [ ] Confirm both buckets' account-owned objects are removed before the Auth
      account is deleted.
- [ ] Confirm a Storage list/remove failure stops account deletion with a
      safe error instead of silently leaving known objects behind.

## Phase 10 — Production readiness decision

Do not proceed until all of these are true:

- [ ] Privacy/safeguarding review is complete, including the audience and
      minor-use decision.
- [ ] Routine audit and case-evidence retention/deletion periods are approved
      and documented.
- [ ] Incident response, cleanup failures, alert ownership, and periodic
      access review have named owners.
- [ ] Staging migration, Storage policy, RLS, Edge Function, and frontend
      checks pass.
- [ ] Backup and restore responsibilities for database and Storage are
      understood.
- [ ] Secrets and schedules are managed through approved protected systems.
- [ ] Discord is either explicitly approved and tested, or left unconfigured.
- [ ] The change has a deployment window and communication/rollback plan.

Only after explicit approval should routine logging be enabled. The SQL
operation is:

```sql
update security.configuration
set audit_enabled = true
where singleton = true;
```

Run that only in the reviewed target project after the retention decision is
recorded. Verify the affected row and have an operator confirm the setting.
Leave Discord disabled until its separate gate is met.

## Phase 11 — Production deployment order

After staging passes and approvals are recorded:

1. Confirm production backup/recovery point and verify the exact project ref.
2. Deploy `avatar-upload` to production.
3. Apply each unapplied migration in order:
   `20261102100000`, `20261102110000`, `20261102120000`, then
   `20261103210000`.
4. Inspect the resulting Storage policy list and database objects.
5. Deploy `cleanup-avatar-quarantine` and `discord-security-alerts` with
   `--no-verify-jwt`; deploy `delete-account` with JWT verification enabled.
6. Configure a new production `AVATAR_CLEANUP_SECRET`; configure separate
   Discord secrets only if approved.
7. Configure production schedules and protected headers. Verify endpoints
   and schedule cadence before enabling them. If approved, configure the
   30-day audit-retention job only after recording the retention policy.
8. Build and deploy the frontend with production URL and anon key only.
9. Run a low-risk production smoke test using an authorized test account.
10. Keep audit disabled unless the privacy/retention approval has been
    recorded; if approved, enable it explicitly and verify expected events
    without recording raw error text or private content.
11. Record deployment time, project ref, migration results, function versions,
    frontend release, secret names (not values), schedule status, approvals,
    test results, and remaining issues.

Do not deploy the migration but leave the production frontend indefinitely
old: direct avatar writes will be blocked by the new policy and the old
client does not call the processor. Coordinate function, migration, and
frontend rollout as one release window.

## Incident handling and recovery notes

### If avatar processing is unavailable

- The endpoint is intended to fail closed rather than publish an unprocessed
  file.
- Check sanitized Edge Function logs, required Supabase environment
  configuration, image decoder errors, and Storage permissions.
- Do not re-enable a broad direct public-media upload policy as a quick fix.
  It bypasses the intended validation boundary.
- If needed, pause avatar changes while fixing the processor or revert the
  frontend only with a reviewed understanding that existing direct-upload
  policies were removed.

### If audit persistence fails

- If `audit_enabled` is true, high-impact database actions that require their
  event should fail as designed. Treat this as a signal to check the event
  writer, permissions, constraints, and database health.
- Do not silently drop audit writes or widen grants to make the error
  disappear.
- If a reviewed incident decision requires disabling collection, use the
  explicit configuration flag and record who authorized it and when.

### If Discord delivery fails

- Application actions should continue; inspect outbox state, worker logs,
  secret configuration, webhook validity, and rate limits.
- Retry/dead-letter handling is bounded. Review exhausted events through the
  operational database process and alert owner.
- Rotate a compromised webhook and worker secret; do not copy them into
  incident tickets.

### If quarantine cleanup fails

- Inspect the worker response, scheduler history, Storage service health, and
  service-only object-list RPC.
- Run a follow-up cleanup only after confirming the function is listing
  objects older than the one-hour cutoff and the target project is correct.
- If `more_pending` is true, schedule/retry promptly and confirm the backlog
  is eventually empty.

### Migration recovery

- Stop the rollout when a migration fails.
- Capture the exact error and determine which statements committed.
- Compare the live database objects with the migration, using the dashboard
  and an operator-approved catalog query.
- Restore from a verified backup only through the approved recovery process.
- Prefer a reviewed forward migration when possible. Do not issue speculative
  `DROP TABLE`, `DROP POLICY`, or `DROP FUNCTION` commands.

## Deployment record template

Copy this section into the team's approved deployment record, not into a
public repository if it would expose project identifiers or internal
operational details.

```text
Release: BACKLINE 1.4.0
Environment:
Project name/ref:
Deployment date/time and timezone:
Deployer:
Approver:
Backup/recovery point:
Migration 20261102100000 result:
Migration 20261102110000 result:
Migration 20261102120000 result:
Avatar function version/result:
Cleanup function version/result:
Discord worker enabled?:
Delete-account function version/result:
Frontend build/revision:
AVATAR_CLEANUP_SECRET configured? (yes/no; never record value):
Discord secrets configured? (yes/no; never record values):
Schedules configured and last run:
Audit logging enabled? (yes/no; approval reference):
Staging checks passed:
Production smoke test:
Open issues / owner:
Recovery decision and contact:
```

## Final reminder

This deployment changes both database enforcement and the client upload path.
The safest sequence is: **approval and backup → staging deployment →
staging verification → production approval → function and migration rollout
→ matching frontend → monitored smoke tests**. Keep audit and Discord
collection disabled until their separate policy gates are satisfied.
