# Security Logging and Monitoring Implementation Logbook

## What this logbook is for

This is a technical learning record for the security logging, avatar upload,
moderation-signal, and optional alert work recorded in BACKLINE version
**1.4.0**. It explains the problem being addressed, how the repository
implementation is structured, what the main code paths do, what was tested,
and what still needs to happen before a real deployment.

It is not a deployment approval, privacy assessment, or penetration test.
Initial staging deployment was completed on 2026-11-02: the base schema, all
nine migrations, and four Edge Functions are present and checked in a separate
Supabase project. The avatar cleanup worker secret is configured in staging,
and its hourly schedule was created and tested successfully. The Discord worker
remains unconfigured. A Vercel Preview configured with staging-only Supabase
variables is deployed, and the user confirmed sign-in works. The frontend was
also connected locally and a signed-in avatar upload succeeded. In the hosted
Preview, the user confirmed there was no sample-data banner and a signed-in
avatar update succeeded. No production deployment has occurred. Start with the
[deployment runbook](./SECURITY-LOGGING-DEPLOYMENT-RUNBOOK.md) for what
remains.

## Executive summary

The work creates four related safeguards:

1. A restricted database event trail records selected security and moderation
   operations without copying private message bodies, staff notes, or
   uploaded bytes.
2. Avatar uploads pass through an authenticated server-side processor and a
   private quarantine bucket before a normalized PNG is published.
3. Message submissions have a database-enforced per-account rate limit and
   an optional repeated-message signal. These controls do not perform
   automated content moderation.
4. An optional database outbox can deliver a small allowlisted event subset
   to a private Discord channel. Discord is a notification destination, not
   the audit system of record.

The audit writer is disabled by default. This is deliberate: event retention,
the site's intended audience and possible minor use, privacy/safeguarding,
and incident ownership need review before routine collection is enabled.
The message rate-limit guard is independent of that flag and is active when
its migration is installed.

## Scope and implementation decisions

### Decisions used by the implementation

- **Audit data source:** trusted PostgreSQL triggers and server-side Edge
  Functions create audit events; the browser does not submit arbitrary event
  records.
- **Initial audit audience:** only admins can read the audit table through
  row-level security (RLS) and the existing staff workspace.
- **Routine logging default:** `security.configuration.audit_enabled` starts
  as `false`; an operator must make an explicit, reviewed change before
  enabling it.
- **High-impact operation behavior:** when audit logging has been enabled,
  database row changes audited by database triggers and their event inserts
  run in the same transaction. If an event write fails, that database
  operation fails too. The Edge Function upload flow crosses separate
  Storage and PostgREST requests, so it cannot make the object upload, profile
  update, and event insert one atomic transaction; it checks required event
  writes and fails the request rather than knowingly continuing without one.
- **Personal data minimization:** no source IP, device identifier, password,
  token, cookie, request body, private-message body, uploaded bytes, or
  original filename is placed in these event records.
- **Avatar types:** JPEG, PNG, and WebP, up to 5 MiB, with a preflight
  maximum dimension of 4096 pixels and a maximum of 8 million pixels.
- **Image processing:** ImageScript is pinned to version 3.13.1 in the Edge
  Function. Accepted images are decoded and re-encoded as PNG; output images
  are resized so neither side exceeds 1024 pixels.
- **External scanning:** no third-party malware or content scanner is used.
- **Message controls:** enforce 30 messages per account per minute by default
  and record a repeated-identical-message signal at the database boundary
  when event logging is enabled. A signal does not automatically suspend or
  restrict anyone.
- **Avatar quota:** at most 10 upload attempts per account in a one-hour
  quota window.
- **Quarantine cleanup:** remove unprocessed objects older than one hour.
  Cleanup is bounded to 1,000 objects per invocation.
- **Discord:** optional and not configured by default. The sender only
  receives fixed event fields, disables mentions, retries a bounded number of
  times, and does not block the underlying application action.

### Why the system is split across database and Edge Functions

The browser is not a trusted security boundary. A user can modify a browser
request, skip client-side checks, or call a database/API endpoint directly.
Accordingly:

- Postgres triggers are used where the database can authoritatively see a
  report, message, staff-role change, restriction, or moderation action.
- Edge Functions are used where the server must authenticate an upload,
  handle raw image bytes, call the image decoder, move objects between
  buckets, or contact Discord.
- RLS and database grants decide who may read or invoke the relevant
  database resources.
- The frontend provides clear interaction and error feedback, but its file
  type and size checks are explicitly treated as user experience rather than
  security validation.

## The event pipeline, step by step

### Event storage and controls

The migration
[`20261102100000_security_event_pipeline.sql`](../supabase/migrations/20261102100000_security_event_pipeline.sql)
creates:

- A private `security` schema for configuration and internal event-writing
  logic.
- A single configuration row containing `audit_enabled` and the
  `message_limit_per_minute` setting. The initial values are `false` and 30.
- `public.security_audit_events`, a versioned event table with a server-
  generated UUID and timestamp, namespaced event type, normalized outcome,
  severity, actor/resource identifiers, source, and tightly bounded metadata.
- Indexes for recent-event display and filtering by event type or actor.
- An RLS policy allowing authenticated admins to select events. Ordinary
  roles do not receive insert, update, or delete access.

The table's metadata check requires a JSON object no larger than 1024 bytes
and blocks common sensitive keys such as `body`, `password`, `token`,
`authorization`, `filename`, `source_ip`, and `device_id`. The trusted writer
also reconstructs upload metadata from a small allowlist instead of trusting
arbitrary JSON.

“Append-only” here means normal application roles cannot edit or delete event
rows. It does **not** make the table immutable to a Supabase project owner or
other sufficiently privileged operator. It is not a tamper-proof external
archive.

### Trusted event writers

`security.write_event(...)` is the internal `SECURITY DEFINER` writer. It
checks the configuration flag first. When logging is disabled, it returns
without inserting an event. When enabled, it writes a validated event row.
Execution is revoked from normal client roles; trusted triggers and narrow
server RPCs call it.

The `security.audit_row_change()` trigger function maps selected row changes
to fixed event names. It records identifiers and controlled reason codes, not
the entire changed row. The audited events include:

| Action | Event(s) | Data intentionally omitted |
|---|---|---|
| Report submitted | `report.created` | User-written report details |
| Report claimed or resolved | `report.claimed`, `report.resolved` | Staff notes and free-form resolution text |
| Message submitted | `message.created` | Message body |
| Repeated identical message burst | `message.risk_flagged` | Message text or a body hash |
| Moderation action inserted | `moderation.action_applied` | Free-form moderation reason |
| Staff role granted or revoked | `staff.role_granted`, `staff.role_revoked` | No credentials or session data |
| Account suspension/reinstatement | `account.suspended`, `account.reinstated` | Free-form restriction explanation |
| Staff note added | `staff.note_added` | Note body |

Auth-user row triggers add `account.created` and `account.deleted` events.
These are account database lifecycle events, **not** a complete authentication
log. Sign-in success/failure, password-reset activity, email-change events,
and other Auth events are not currently written to BACKLINE's event table.
Continue to use trusted Supabase Auth platform logs for those records.

The `public.get_reported_message(report_uuid)` RPC verifies the existing
admin-only moderation capability, finds the single message linked to the
report, writes `staff.evidence_viewed`, and returns only that message and its
sender's display name. It does not grant conversation-wide access. An
evidence-read event records the message ID, not its contents.

### Event visibility in the app

The staff workspace's **Security events** tab appears only for admins. It
fetches at most the latest 100 events and displays event type, outcome,
severity, reason code, actor and target IDs, timestamp, and event ID. The
dashboard intentionally does not display event metadata or private content.
An empty result can mean there have been no events, or that event logging is
still disabled.

Relevant application code:

- [`StaffPage.jsx`](../src/pages/StaffPage.jsx) — fetches and displays the
  event list.
- [`errorMessages.js`](../src/lib/errorMessages.js) — maps the database
  message-rate-limit error to a user-facing explanation.
- [`MessagesPage.jsx`](../src/pages/MessagesPage.jsx) — keeps the existing
  permission error handling and uses shared error translation for a
  rate-limit response.

### Message rate limiting and repeated-message signal

The same migration installs a `BEFORE INSERT` trigger on `public.messages`.
For a signed-in user inserting as their own account, it:

1. Replaces `created_at` with the database's current wall-clock time. This
   prevents a client from supplying an old timestamp to evade a recent-
   message count.
2. Takes a transaction-scoped advisory lock for that sender. Concurrent
   requests from the same user therefore cannot both pass based on the same
   pre-insert count.
3. Counts that sender's messages in the preceding minute.
4. Rejects a submission at the configured threshold with SQLSTATE `P0001`
   and a controlled message.

The limit is 30 per minute initially. A separate after-insert audit trigger
counts identical messages from that sender during the last minute. At the
third matching message, it emits a `message.risk_flagged` event if auditing
is enabled. This is a lightweight signal only; it is not a content classifier
and it does not inspect or store a copy of the message body in audit data.

The `clock_timestamp()` assignment is important: PostgreSQL `now()` is
transaction-stable. For this guard, the intent is to compare using a fresh
server time for each inserted message, not a timestamp supplied by the
client.

## The avatar upload pipeline, step by step

### Why the old path changed

Previously the browser could upload directly to the public `media` bucket.
An owner-folder policy protected object ownership, but it did not prove that
the bytes were a safe image or that they had been decoded and normalized.
The new flow puts a trusted processor between the browser and public storage.

### Request flow

The Edge Function at
[`avatar-upload/index.ts`](../supabase/functions/avatar-upload/index.ts)
performs the following sequence:

1. Handles CORS preflight and rejects methods other than `POST`.
2. Requires the caller's Supabase access token in the `Authorization` header
   and verifies it with Supabase Auth using `auth.getUser(token)`. It does not
   trust a user ID supplied by the client.
3. Reads the Supabase URL, anon key, and service-role key from the server
   environment. Missing configuration is reported as a server error; no
   success-shaped fallback is used.
4. Checks the account restriction row and rejects a suspended account.
5. Enforces a 5 MiB limit using the request length when supplied and a bounded
   streaming body reader regardless of that header.
6. Requires a declared MIME type of JPEG, PNG, or WebP.
7. Claims an hourly upload quota slot through the service-only database RPC.
8. Reads the bytes, inspects the file signature and image dimensions, and
   checks the 4096-pixel/8-megapixel limits before full decode.
9. Uploads the original bytes to the private `avatar-quarantine` bucket using
   a generated account-scoped UUID object name.
10. Decodes the image with ImageScript, checks decoded dimensions against
    preflight dimensions, resizes large images to a maximum 1024-pixel side,
    and encodes a normalized PNG.
11. Uploads only that normalized PNG under a new generated name into the
    public `media` bucket.
12. Updates only the verified caller's profile URL.
13. Attempts to remove the previous avatar if its URL is a recognized public
    `media` URL within the same project and owner folder.
14. Attempts to remove the private quarantine input in a `finally` block.
    If cleanup fails, it reports the error in server logs and attempts to
    record a safe cleanup-failure event.

The upload event RPC accepts only a fixed family of `upload.*` event names.
Upload metadata is reduced to media type and byte count; it does not store a
filename or file bytes. When audit is enabled, failure to record a required
upload event fails the processing request. When audit is disabled, the RPC
returns without storing routine upload events. Because object storage and
profile changes are separate service requests, this is fail-closed control
flow, not a distributed transaction: partial object cleanup is attempted
when later steps fail.

### Format preflight and decoding are separate checks

[`imageValidation.ts`](../supabase/functions/avatar-upload/imageValidation.ts)
is a quick structural preflight:

- PNG: checks the PNG signature and reads width/height fields.
- JPEG: walks marker segments until it finds a supported start-of-frame
  marker and reads the declared frame dimensions.
- WebP: recognizes RIFF/WEBP and extracts dimensions from VP8X, VP8, or VP8L
  headers.
- All formats: reject zero, non-integer, over-4096, or over-8-megapixel
  dimensions.

Preflight does not certify that the entire file is valid. Full decoding is a
second check. Decoder failure or a mismatch between preflight and decoded
dimensions causes rejection. Re-encoding removes the original file's
container/metadata structure from the publicly served output; it is not a
substitute for a malware scanner, and it cannot guarantee an image is
appropriate user content.

### Storage policy and quota

[`20261102110000_avatar_quarantine.sql`](../supabase/migrations/20261102110000_avatar_quarantine.sql)
does two important things:

- Creates or enforces the private `avatar-quarantine` bucket with a 5 MiB
  object limit and JPEG/PNG/WebP MIME allowlist.
- Drops the old direct authenticated insert policy for `media` and the named
  owner update policy, so the browser cannot bypass the processor through
  those policies.

The public avatar output remains readable from `media`; what changes is how
new objects are admitted. Existing avatars are not bulk reprocessed by this
migration. Deploy the matching frontend and Edge Function with the migration
so the supported upload path remains available.

`security.avatar_upload_usage` tracks one hourly window and up to 10 claimed
slots per user. `claim_avatar_upload_slot(uuid)` is service-role-only and
atomically creates or updates the counter. Invalid declared MIME types are
rejected before the quota call; requests that reach the quota step consume a
slot even if later image checks reject them.

### Bounded private-object cleanup

The cleanup worker at
[`cleanup-avatar-quarantine/index.ts`](../supabase/functions/cleanup-avatar-quarantine/index.ts)
requires the dedicated `x-avatar-cleanup-secret` header. It calls
`list_expired_avatar_quarantine_objects`, a service-role-only RPC that queries
Storage metadata for objects older than one hour. Using a database cutoff
avoids relying on paginated Storage listing metadata to decide age.

The worker removes objects in batches of at most 100, up to 1,000 objects in
one invocation. It returns counts and a `more_pending` indicator so the
scheduler/operator can run it again if the cap was reached. It does not
recursively list arbitrary user folders or accept a caller-supplied object
path. For UUID-named expired objects it attempts to record an
`upload.deleted` event with a `quarantine_expired` reason.

The cleanup schedule is not created by this repository. A deployment owner
must schedule it and monitor errors, including the case where Storage removal
succeeds but a subsequent audit write fails.

### Account deletion

[`delete-account/index.ts`](../supabase/functions/delete-account/index.ts)
now enumerates and removes objects belonging to the account from both
`media` and `avatar-quarantine` before deleting the Auth account. It batches
Storage removals and returns a failure rather than proceeding with account
deletion when it cannot complete object cleanup. Raw Storage error messages
were removed from the touched log paths to avoid sending backend details to
logs or users.

## Reports, staff actions, and restricted evidence

The audit migration instruments the existing report/moderation schema instead
of building a second case-management system. This keeps current authorization
and workflow controls in place:

- Report submission, claim, and resolution events capture IDs and controlled
  reason values, not report details.
- Moderation and staff access changes are recorded with their actor and
  target.
- The database function for reported-message evidence continues to require
  admin moderation capability and returns only the reported message context.
- Staff notes remain in their existing restricted table; note content is not
  copied into the audit event.
- Admins can read the recent event view; non-admin staff do not gain audit
  visibility from their moderation roles.

The full deployed authorization behavior still needs to be tested against a
separate Supabase project. Local smoke tests are not proof that the deployed
project's existing RLS policies and API schema cache are correct.

## Optional Discord delivery

### Database outbox

[`20261102120000_security_alert_outbox.sql`](../supabase/migrations/20261102120000_security_alert_outbox.sql)
adds a private queue keyed by `event_id`, making an event's alert unique. A
trigger queues only selected events: report creation, staff-role changes,
account suspension/reinstatement, and rejected/failed uploads.

`claim_security_alerts(batch_size)` is service-role-only. It serializes
dispatch claiming with an advisory lock, claims due rows, tracks attempts,
and enforces a global maximum of 10 alert attempts in a rolling minute. A
stale `sending` row can be reclaimed; rows that have exhausted five attempts
are moved to `dead_letter`.

`complete_security_alert(...)` records success or failure. Failed attempts
are retried with exponential delays of 30, 60, 120, 240, then 480 seconds.
Rows stop retrying after five attempts. This status is for delivery
operations; it is not the authoritative record of the underlying security
event.

### Edge Function delivery

[`discord-security-alerts/index.ts`](../supabase/functions/discord-security-alerts/index.ts)
requires `x-security-worker-secret` and the server-side
`DISCORD_SECURITY_WEBHOOK_URL`. It validates HTTPS and an official Discord
webhook host/path, asks the database for a bounded batch, and posts fixed
event fields. It sets `allowed_mentions.parse` to an empty list, rejects
redirects, and applies a 10-second network timeout. It records HTTP/network
failure categories rather than raw response bodies or webhook secrets.

The message includes severity, event type/outcome, event ID, event time,
controlled reason code, and internal actor/target identifiers when present.
It does not include message bodies, report details, staff notes, uploaded
files, or public avatar URLs.

Discord is optional. If it is not configured, alerts remain in the outbox and
normal application actions do not wait for Discord. A production owner still
needs to approve the channel, membership, response owner, alert policy, and
Discord's retention/forwarding risks before configuring it.

## Frontend and operator documentation changes

- [`ProfilePage.jsx`](../src/pages/ProfilePage.jsx) keeps fast client-side
  size/type checks for helpful feedback, then sends raw `File` bytes to
  `avatar-upload` in connected mode. Preview mode continues to use a local
  object URL and does not call Supabase.
- [`MessagesPage.jsx`](../src/pages/MessagesPage.jsx) and
  [`errorMessages.js`](../src/lib/errorMessages.js) show a helpful message
  for the server rate-limit error instead of exposing database internals.
- [`StaffPage.jsx`](../src/pages/StaffPage.jsx) provides the admin-only
  recent-event view.
- [`README.md`](../README.md) records migration ordering, function deployment,
  secrets, schedules, defaults, and production gates.
- [`SECURITY-LOGGING-AND-MONITORING-PLAN.md`](./SECURITY-LOGGING-AND-MONITORING-PLAN.md)
  records implementation status, design decisions, and unresolved gates.
- [`CHANGELOG.md`](./CHANGELOG.md), `package.json`, and `package-lock.json`
  identify this work as version 1.4.0, a minor release from 1.3.0.

## Validation record

The following local and staging checks passed:

| Check | Result | What it establishes |
|---|---|---|
| `npm run build` | Passed | Vite can produce the production frontend bundle. |
| Deno lint on touched Edge Functions and image tests | Passed | No lint findings in the selected TypeScript/Deno files. |
| Deno check on upload, cleanup, Discord, deletion, and image-test files | Passed | Those files type-check against their Deno imports and APIs. |
| Deno image tests | 5 passed | PNG/JPEG/WebP preflight, dimension bounds, actual ImageScript decoding, and normalized PNG signatures. |
| PGlite migration smoke tests | Passed | The three new SQL migrations ran in a local PostgreSQL-compatible in-memory harness; tested upload quota, cleanup batching, sanitized upload-event metadata, report audit, message rate limits, spoofed client timestamps, outbox claim, and completion. |
| Fresh staging bootstrap | Passed | Confirmed no application tables existed, applied `supabase/schema.sql`, then applied all nine timestamped migrations through the linked Supabase CLI. Remote migration history matches all nine local versions. |
| Staging Supabase DB lint | Passed | `supabase db lint --linked` reported no schema errors in `extensions`, `public`, or `security`. |
| Staging defaults and RLS checks | Passed | Confirmed audit logging is false, message limit is 30/minute, audit RLS is enabled, quarantine is private, and the outbox is empty. |
| Staging Edge Function checks | Passed | Four functions active; JWT verification is enabled for `avatar-upload` and `delete-account`, disabled for the two secret-header workers. |
| Unauthenticated function smoke tests | Passed | Avatar upload/account deletion returned 401; workers returned 503 while their required secrets are intentionally unset. |
| Signed-in staging avatar test | Passed | A new staging test account completed an avatar upload through the frontend; aggregate Storage counts showed one public `media` object and zero quarantine objects. |
| Staging quarantine cleanup schedule | Passed | The hourly `pg_cron` job was created. A manual `pg_net` invocation returned HTTP 200 with `inspected: 0`, `removed: 0`, and `more_pending: false`; no expired quarantine objects were waiting for deletion. |
| Hosted Vercel Preview sign-in | Passed (user-confirmed) | Vercel Preview uses Preview-scoped staging Supabase settings; the user confirmed a staging account can sign in. This does not verify broader app behavior or access policies. |
| Hosted Vercel Preview avatar update | Passed (user-confirmed) | The user confirmed the sample-data banner was absent and a signed-in profile avatar update succeeded in the hosted Preview. Avatar files in the public `media` bucket may be publicly readable; use only a non-identifying test image. |
| `git diff --check` | Passed | No whitespace errors in the patch. |

The PGlite test harness used minimal stand-in versions of some existing
Supabase schemas, tables, and auth functions. It was temporary and removed
after testing. It is useful for SQL syntax and targeted behavior but does not
replace Supabase's Postgres version or a full policy and role-based signed-in
application test. The staging project has had a full base schema and migration
run, and the authenticated avatar workflow has passed. Live role-based RLS
tests, the optional Discord worker schedule, and broader hosted Preview
workflow checks remain outstanding. The staging quarantine cleanup schedule
has been tested successfully. Hosted Preview sign-in and avatar update were
confirmed by the user; broader access and privacy behavior still require
review.

An earlier local `supabase db lint --local` attempt could not connect because
the local Supabase/Postgres service was unavailable. Staging was later
verified with `supabase db lint --linked`; production remains untouched.

## Open risks and work that was intentionally not claimed complete

1. **Privacy and safeguarding:** confirm the intended audience and whether
   minors may use BACKLINE; complete appropriate review.
2. **Retention:** specify deletion/archive periods and ownership for routine
   events and case evidence before enabling routine audit collection.
3. **Production environment:** apply the migrations, deploy functions, set
   approved secrets, and configure and test schedules in a separate project
   first. The staging cleanup schedule is not a production schedule.
4. **RLS and Storage:** verify actual anon, authenticated, moderator, admin,
   and service-role behavior in the target Supabase environment.
5. **Message and upload thresholds:** tune the current 30/minute and 10/hour
   defaults using measured traffic and false-positive reports.
6. **Auth logs:** sign-in and password-reset events remain in Supabase's
   trusted Auth/platform logs, not this new event pipeline.
7. **Scanner:** no third-party malware scanner is included. This is a
   conscious initial scope choice, not a claim that image re-encoding detects
   all harmful content.
8. **Discord:** no webhook, schedule, private channel, or responder is
   configured by default.
9. **Monitoring ownership:** assign a human owner for cleanup failures,
   alert dead letters, audit-write failures, and incident escalation.
10. **Rollback:** no down-migrations are supplied. Database changes need a
    reviewed recovery/forward-fix plan and a verified backup before applying.

## Learning notes: how to reason about this design

- **Do not trust the UI for authorization.** A hidden button or disabled file
  picker can improve UX, but only server/database checks protect the boundary.
- **Separate event evidence from private evidence.** A durable event can say
  who accessed which reported item without duplicating the message itself.
- **Fail closed only where the product decision requires it.** High-impact
  audited DB actions fail when a required event cannot be written; optional
  Discord delivery does not block the original action.
- **Normalize untrusted files before publication.** MIME labels are supplied
  by clients. Signature inspection, bounded dimensions, full decoding, and
  re-encoding provide stronger checks, while still not substituting for
  moderation or a malware scanner.
- **Use the database clock and concurrency controls for rate limits.** A
  client timestamp and concurrent requests are both potential bypasses if
  rate decisions are made only in the browser.
- **A queue needs lifecycle state.** An outbox, claim status, attempt counter,
  retry timing, and dead-letter state make delivery observable rather than
  fire-and-forget.
- **Tests must match the claim.** A unit test for image headers is not a test
  of full image decode; a simulated PostgreSQL test is not a Supabase RLS
  test; and a passing frontend build is not a deployment test.

## Related documents

- [Security logging and monitoring plan](./SECURITY-LOGGING-AND-MONITORING-PLAN.md)
- [Security deployment runbook](./SECURITY-LOGGING-DEPLOYMENT-RUNBOOK.md)
- [Project README](../README.md)
- [Project changelog](./CHANGELOG.md)
