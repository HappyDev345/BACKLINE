# Security Logging and Monitoring Deployment Runbook

## Purpose and current status

This runbook gives the intended step-by-step sequence for deploying the
version 1.5.0 security logging, avatar upload, cleanup, and optional alert
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
Administrator and database-level role/access tests and other staging checks
remain outstanding. Nothing has been deployed to production.

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
| `20261103210000_expand_security_event_coverage.sql` | Project/feed/forum/comment audit events, authenticated client error events, all-event Discord queueing, and 30-day log purge function | Local code only; not yet applied to staging. Audit persistence remains off by default. |
| `avatar-upload` | Authenticated image validation, decode/re-encode, and publication | Needs Supabase URL/anon/service role environment |
| `cleanup-avatar-quarantine` | Removes private quarantine objects older than one hour | Requires `AVATAR_CLEANUP_SECRET` and an external schedule |
| `discord-security-alerts` | Delivers selected outbox events | Optional; requires webhook, worker secret, and external schedule |
| `delete-account` | Removes account media from both buckets before account removal | Must be redeployed with the changed implementation |
| Frontend | Sends connected-mode avatars to the new upload function and exposes admin event view | Requires matching Supabase project URL/anon key at frontend build/deploy |

## Phase 0 — Obtain approval and designate owners

Do this before production. It is also recommended before a staging test that
uses real people or meaningful personal information.

### 0.1 Privacy and safeguarding review

- Confirm the intended user audience and whether minors may sign up or use
  the service.
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

### 0.3 Incident and operations ownership

Name a person or team who will:

- Review admin-only audit events and high-severity alerts.
- Respond to Discord failures, dead letters, and backlog.
- Respond to audit-write failures and cleanup failures.
- Own periodic access reviews and retention/deletion checks.
- Escalate a suspected account compromise or unsafe upload.

If no one owns these responsibilities, do not enable routine collection or
Discord delivery.

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

Confirm that the intended source revision contains version `1.4.0` in
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

Read the preview carefully. For this branch it should list nine files, in
order: the six existing migrations from October 2026 followed by the four
new migrations from November 2026. If it lists anything unexpected, or
complains about local/remote history, stop rather than guessing.

If the preview is exactly right, apply those migrations:

```powershell
& .\node_modules\.bin\supabase.cmd db push --linked
```

Read the CLI confirmation prompt and verify the project/ref and migration
list before answering `y`. This records the migration versions in Supabase's
migration history. Do not add `--yes` when you want the extra confirmation.

The four new files are:

1. `supabase/migrations/20261102100000_security_event_pipeline.sql`
2. `supabase/migrations/20261102110000_avatar_quarantine.sql`
3. `supabase/migrations/20261102120000_security_alert_outbox.sql`
4. `supabase/migrations/20261103210000_expand_security_event_coverage.sql`

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
Choose a cadence suitable for the response need and the database's global
limit of 10 alert attempts per minute. Monitor non-2xx responses and the
outbox backlog/dead-letter state.

The worker uses retries and a bounded batch; repeated scheduler calls do not
make Discord authoritative. Test delivery and outage behavior in staging
before enabling the schedule in production.

### 7.3 Audit-event retention

The expanded event-coverage migration defines
`security.purge_expired_security_events()`, which removes audit events older
than 30 days. Deleting the parent event also removes its associated outbox
record. This does **not** delete Discord messages already sent; Discord
retention must be reviewed separately.

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

- [ ] An unauthenticated avatar request is rejected.
- [ ] A valid authenticated test account can reach the upload processor.
- [ ] A suspended test account cannot update its avatar.
- [ ] Missing worker secret returns an explicit unavailable response; an
      incorrect worker header is rejected.
- [ ] No service-role key, webhook URL, or worker secret appears in browser
      source, network requests to the frontend, or build output.
- [ ] Check the staging Auth email-confirmation setting explicitly. The
      first staging test account signed up without a confirmation step; do
      not assume that behavior matches the intended production policy.

### 9.2 Avatar handling

- [ ] Upload a small valid JPEG, PNG, and WebP; each is accepted and publicly
      served as a normalized PNG.
- [ ] Upload an unsupported type and a file with a mismatched declared type;
      both are rejected without publishing original bytes.
- [ ] Upload a malformed file with a plausible image MIME type; decoder
      rejection leaves no public object.
- [ ] Test an image over 5 MiB, dimensions over 4096, and an image over 8
      megapixels; each is rejected.
- [ ] Confirm large accepted images are resized to at most 1024 pixels on
      either side.
- [ ] Attempt more than 10 uploads within the quota window; excess requests
      are rejected.
- [ ] Confirm the original input is removed from private quarantine after a
      completed/rejected processing attempt, or that cleanup failures are
      surfaced for the operator.
- [ ] Confirm direct authenticated writes to `media` are denied under the
      new policy set.
- [ ] Confirm replacing an avatar updates the profile and that failure to
      remove a previous object is visible in sanitized operational logs.

### 9.3 Message and audit behavior

1. Keep `audit_enabled = false` initially and verify the message rate limit
   still applies.
2. Use test users to verify rate-limit behavior, including a request that
   attempts to supply a stale `created_at` value if the client path allows
   testing it. The database must use server time for the inserted message.
3. With privacy approval in staging, temporarily set
   `security.configuration.audit_enabled = true`.
4. Submit a report, claim/resolve it as staff, add a staff note, perform a
   moderation action, change a test staff role/restriction, and submit a
   repeated identical message. Confirm expected event types and IDs.
5. Confirm message bodies, report details, staff-note bodies, raw requests,
   filenames, IPs, and device IDs do not appear in event metadata.
6. Read the dashboard as an admin and confirm events load.
7. Read it as a non-admin user and non-admin moderator; access must be
   denied by database policy, not merely hidden by the UI.
8. Review a reported-message case and confirm the evidence access event is
   written while unrelated conversation history remains inaccessible.
9. Return `audit_enabled` to `false` after the test if the staging approval
   does not authorize ongoing collection.

### 9.4 Cleanup worker

- [ ] Test an incorrect cleanup secret and confirm it is rejected.
- [ ] In staging, create a clearly identified quarantine test object older
      than one hour using an approved test method.
- [ ] Invoke cleanup and confirm the stale object is removed and a
      `quarantine_expired` event is attempted when audit logging is enabled.
- [ ] Test a dataset large enough to hit the 1,000-object bound and confirm
      `more_pending` is reported and a subsequent run completes the backlog.
- [ ] Confirm recent objects are not deleted.
- [ ] Confirm scheduler logs never contain the secret header.

### 9.5 Optional Discord alert worker

Skip this section when Discord is not enabled.

- [ ] Verify missing or incorrect worker secret is rejected.
- [x] In staging, create one synthetic `report.created` event in a single
      transaction, turn audit collection back off, and manually invoke the
      worker. The worker returned HTTP 200 and reported processing two alerts;
      the user confirmed Discord messages arrived. A later aggregate query
      confirmed exactly two expected events, `report.created` / `discord_test`
      and `upload.rejected` / `invalid_image`, both marked delivered.
- [ ] Confirm the alert contains only controlled event metadata and
      `allowed_mentions` is disabled.
- [ ] Confirm no message text, report details, note bodies, file bytes, or
      webhook URL is delivered.
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
