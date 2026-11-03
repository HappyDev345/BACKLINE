# BACKLINE Security Logging and Monitoring Plan

## Purpose and status

This document records the design and implementation status for BACKLINE's
security event logging, upload safety, suspicious-content handling, evidence
preservation, and optional Discord alerts. The 1.5.0 event coverage and 1.6.0
rich Discord presentation changes are deployed to staging.
On 2026-11-02, the base schema, initial nine migrations, and four Edge
Functions were deployed to a separate staging project and checked.
The frontend was connected locally and a signed-in test avatar upload
succeeded. The staging quarantine cleanup secret and hourly schedule are
configured, and a manual worker invocation returned HTTP 200. A Vercel
Preview uses Preview-scoped staging settings, and the user confirmed sign-in
works, the sample-data banner is absent, and a signed-in avatar update
succeeded. A private staging Discord webhook and worker secrets are set, and
a synthetic alert was delivered successfully by a manual worker invocation;
audit logging was turned off afterward. On 2026-11-03, the event-coverage
migration was manually applied in the staging SQL Editor; project, feed-post,
and forum-post events were verified in the database and delivered to Discord.
migration `20261103213000_discord_rich_security_alerts.sql` was subsequently
applied manually and the updated Discord worker deployed; the user confirmed
a successful rich-embed delivery in staging. Verify the audit flag is off
after testing. A one-minute staging Discord
schedule has been created and verified: two cron executions succeeded and
scheduled `pg_net` calls returned HTTP 200 with an empty queue. The manual
test call processed two expected alerts: the synthetic report event and the
invalid-image upload rejection. An aggregate query confirmed both were
delivered. The browser displayed rejection, but the backend processed that
upload while audit was temporarily enabled. Nothing has been deployed to
production, and broader access and
workflow checks remain outstanding. Staging avatars are in a public-read
bucket, so only non-identifying test images should be used.

For a detailed explanation of the implemented components, see the
[security implementation logbook](./SECURITY-LOGGING-IMPLEMENTATION-LOGBOOK.md).
For staging and production rollout steps, see the
[security deployment runbook](./SECURITY-LOGGING-DEPLOYMENT-RUNBOOK.md).

### Implementation status

The repository now includes migrations and Edge Functions for a disabled-by-
default audit event store, report/moderation/auth-account event capture,
reported-message evidence access auditing, message rate limits and repeated-
message signals, private avatar quarantine and image re-encoding, and an
optional Discord alert outbox/worker. The staff workspace includes an
admin-only recent-event view.

The requested Discord presentation is a compact embed: event-time display
name and username for the actor (and account target when available), the
project title for project events, event type/reason/outcome, and Discord's
native timestamp. Ordinary activity is green; denied, failed, and rejected
outcomes are red. Message bodies, post/comment text, and raw error messages
remain excluded. The migration and worker have been deployed to staging, and
the user confirmed an embed arrived successfully. Production deployment has
not occurred.

The following limitations and release gates remain:

- Staging has the base schema, the initial migrations, and the event-coverage
  SQL applied. That expansion was run manually, so reconcile migration history
  before using `supabase db push`. The 1.6.0 rich-embed migration and updated
  worker remain undeployed. Complete the remaining staging checks before
  production rollout.
- `security.configuration.audit_enabled` defaults to `false`. Keep it disabled
  until the audience/privacy review and routine-event retention period have
  been approved. The server-side message rate limit is active independently.
- Authentication account creation/deletion is captured by database triggers;
  sign-in success/failure, password reset, and other Auth events are not
  currently written to BACKLINE's event table. Use verified Supabase Auth
  platform logs for those events until a supported trusted integration is
  confirmed.
- Avatar processing accepts JPEG, PNG, and WebP up to 5 MB, checks format and
  dimensions, and re-encodes before publication. It does not use a third-party
  malware scanner. The rate defaults to 10 attempts per account per hour and
  30 messages per account per minute; tune these values against actual traffic.
- The staging `cleanup-avatar-quarantine` worker has a Vault-backed secret and
  an hourly `pg_cron` schedule. A manual `pg_net` invocation returned HTTP
  200 with zero expired objects and no remaining backlog. Configure and test
  its schedule separately in production. Schedule `discord-security-alerts`
  only if Discord delivery is approved. Cleanup is bounded to 1,000 objects
  per invocation and returns `more_pending` when another run is needed. These
  schedules are operator-managed and are not provisioned by repository
  migrations.
- Discord delivery is optional. Staging now has a dedicated private-channel
  webhook and worker secrets, with a successful synthetic delivery test.
  A one-minute staging schedule has been verified through successful cron
  runs and HTTP 200 responses. The manual test's two alerts were reconciled
  to the synthetic report and invalid-image upload rejection; both were
  delivered.
  Keep production credentials and schedules unset until a private channel,
  membership, response owner, and alert policy have been approved for
  production.
- The database audit table is append-only for ordinary application roles, not
  immutable against privileged Supabase operators. Retention/deletion,
  incident ownership, and production verification remain outstanding.
- Source IP addresses and device identifiers are not collected in BACKLINE's
  event records. Do not add them without a documented need and privacy review.

The goals are to:

1. Make important security and moderation events attributable and correlatable.
2. Detect and prevent unsafe uploads before they become public.
3. Surface suspicious activity to authorized administrators promptly.
4. Preserve enough evidence to investigate user reports and incidents without
   copying all private content into logs or Discord.
5. Keep the audit trail trustworthy, access-controlled, privacy-conscious, and
   useful if Discord or another alerting service is unavailable.

Logging supports security; it is not itself a blocking or scanning control.
Validation, access control, quarantine, rate limiting, and moderation are
separate measures and must be designed alongside the logs.

## Pre-implementation baseline (verify against deployed project)

The following describes the repository/deployment baseline before this
implementation. Repository code changes do not update a Supabase project
until its migrations and Edge Functions are deployed.

BACKLINE is a React/Vite application using Supabase for connected Auth,
Postgres, Storage, and some Realtime features. It has a preview mode as well as
a connected mode.

Relevant existing behavior and foundations:

- The connected app stores avatars in the public Supabase Storage bucket named
  `media`. The profile page uploads directly from the browser, then saves the
  public URL to the profile. Browser-side `accept="image/*"` is not a security
  validation mechanism.
- The storage upload policy requires an authenticated user and a first path
  segment matching that user's ID. It does not by itself establish that the
  uploaded bytes are a safe image or that the file should be published.
- The app has reports, staff roles, moderation actions, and private staff
  notes. Private messages can be reported individually; admins can inspect
  only the reported message rather than the entire conversation.
- Private messages are stored in the `messages` table and are visible to
  conversation participants under row-level security (RLS).
- There is no general-purpose, append-only security-event pipeline or Discord
  alert integration described in the current app.
- There is no current post-media upload flow, although the public media bucket
  and schema comments describe media for avatars and posts.
- The frontend uses the public Supabase anon key. It must never contain a
  Supabase service-role key, Discord webhook URL, bot token, or other
  privileged secret.

Relevant implementation surfaces to review when work begins:

- `src/pages/ProfilePage.jsx` — avatar upload.
- `src/pages/MessagesPage.jsx` — message submission and individual-message
  reporting UI.
- `supabase/schema.sql` — core tables, RLS, triggers, and public media bucket.
- `supabase/migrations/20261026200000_own_media_uploads.sql` — owner-scoped
  upload policy.
- `supabase/migrations/20261028170000_roles_reports_moderation.sql` — staff
  roles, reports, moderation actions, and staff notes.
- `supabase/migrations/20261028211000_report_private_messages.sql` — reporting
  and review of individual private messages.
- `README.md` — setup and security-related operating notes.

These are architectural pointers, not a security certification. Review the
current deployed Supabase policies and project configuration before changing
production behavior.

## Proposed architecture at a glance

Use three separate but correlated layers:

1. **Authoritative audit events in BACKLINE's backend.** Record security,
   upload, moderation, and administrative events in a restricted backend
   store. The backend, not a browser request, is the source of truth.
2. **Restricted evidence and review workflows.** Preserve reported or
   quarantined content only where needed, separately from routine event
   metadata. Grant access only to authorized reviewers and audit every access.
3. **Discord as a notification surface.** Send a curated subset of event
   metadata to a private admin channel. Discord is not the authoritative audit
   store, should not receive routine private message bodies or uploaded files,
   and must not be required for the app to function.

An example event path:

```text
Client request
  -> authenticated backend operation / upload ingress
  -> authorization, validation, rate limit, and safety checks
  -> authoritative event record
  -> optional queued Discord alert for selected event types
  -> authorized admin review in BACKLINE
```

For asynchronous checks, record both the initial result and later state
transitions. For example, an upload might produce `upload.received`,
`upload.scan_started`, and `upload.rejected`, each with a shared correlation ID
and distinct event IDs.

## Event record requirements

Every event should have a stable, documented shape. Use UTC timestamps and
server-side values for security-sensitive attributes wherever possible.

### Required or strongly recommended fields

| Field | Meaning and guidance |
|---|---|
| `event_id` | Unique identifier for this individual event, preferably a UUID generated server-side. Do not reuse it for different events. |
| `occurred_at` | UTC timestamp for when the action occurred. Use a server-generated time; retain client time only as an explicitly untrusted diagnostic value if needed. |
| `event_type` | Stable, namespaced action name such as `auth.login_failed`, `upload.rejected`, `message.risk_flagged`, `report.created`, `staff.evidence_viewed`, or `account.suspended`. This is not an HTTP status code. |
| `outcome` | Normalized result such as `allowed`, `denied`, `failed`, `flagged`, `accepted`, `rejected`, or `completed`. Define allowed values consistently. |
| `reason_code` | Short machine-readable reason such as `mime_mismatch`, `rate_limit`, `permission_denied`, or `scanner_match`. Avoid unbounded or user-authored values. |
| `severity` | Consistent level, for example `info`, `low`, `medium`, `high`, or `critical`, with documented criteria. Severity is not a substitute for event type or outcome. |
| `actor_user_id` | Authenticated account that initiated the action, when known. Use null for unauthenticated activity; do not invent an account association. |
| `target_type` / `target_id` | The affected resource, such as a user, project, post, comment, message, report, or upload. Store only identifiers needed for correlation. |
| `action` | Human-readable but controlled action name, including relevant safe parameters. Do not store raw commands, request bodies, secrets, or private content. |
| `request_id` | Correlation ID for one inbound request or operation. Generate or validate server-side; do not use a session token as this value. |
| `transaction_id` | Optional ID that groups a multi-step database or workflow operation. It may equal the request ID where appropriate; document the convention. |
| `source` | The trusted component that generated the event, such as `web`, `supabase-edge-function`, `postgres-trigger`, `storage-scanner`, or `discord-delivery-worker`. |
| `destination` | Logical service or resource involved, such as `supabase-storage:quarantine` or `discord:security-alerts`. Prefer service names over destination IP addresses. |
| `http_status` | HTTP response status when an HTTP response exists and is relevant. This is separate from `event_type`, `outcome`, and scanner/moderation result. |
| `response_time_ms` | Duration measured by the trusted server for a request or operation. Null for events where a response duration does not apply. |
| `source_ip` | Optional client network address obtained server-side from a trusted proxy/platform header. Never trust a client-supplied IP field. Apply a documented access and retention policy. |
| `device_id` | Optional opaque, random first-party identifier only if justified. Do not use invasive browser/device fingerprinting. Never treat it as proof of identity. |
| `service_name` / `service_version` | Component and deployed version that produced the event, useful for distinguishing regressions and policy changes. |
| `policy_version` | Version of the validation, risk, or moderation rules used, when applicable. |
| `created_at` | Time the event was persisted, separate from occurrence time if asynchronous delivery or processing creates a delay. |

Fields can be null when inapplicable. Do not fill missing values with misleading
defaults. Keep types and event names stable; document changes when event
semantics change.

### Clarifying the requested fields

- **Event type and status code are not the same thing.** An event type explains
  what happened. An HTTP status code describes an HTTP response. A scanner
  outcome or moderation decision should use a separate normalized result.
- **Source and destination IPs:** BACKLINE's event records do not collect
  these. Record the logical destination/service instead of a raw destination
  IP. Reconsider IP collection only if a concrete incident-response need and
  privacy review justify it.
- **Device identifier:** BACKLINE does not collect device identifiers or
  derive browser fingerprints. Reconsider only if a documented need and
  privacy review justify first-party correlation.
- **Session/transaction IDs:** use non-secret correlation identifiers.
  Never log cookies, bearer tokens, refresh tokens, passwords, authorization
  headers, or session secrets.
- **Command or action:** record the action name and minimal safe context, not a
  literal SQL statement or full HTTP request body. For staff actions, retain
  the target, actor, decision, and concise reason.
- **Response time:** measure at the server or trusted service boundary. A
  browser-reported duration can be retained as supplemental telemetry but is
  not authoritative.

## Event catalog

Start with a small, meaningful catalog and expand based on operational need.
For each event family, define the producer, required fields, severity,
retention, alert policy, and whether evidence is retained.

### Authentication, identity, and sessions

Consider recording:

- Sign-in success and failure, with safe failure reason categories.
- Sign-out and session revocation where the application can observe them.
- Password reset requested/completed and email-change requested/completed,
  without logging secrets, reset links, or tokens.
- Account creation and account deletion requests/completions.
- Repeated authentication failures, rate limits, and suspicious request
  patterns.
- Staff-role grant/revocation and account restriction/suspension/reinstatement.

Avoid recording passwords, raw reset URLs, authentication tokens, or full
identity-provider payloads.

### Authorization and access control

Consider recording:

- Denied access to staff tools or restricted records.
- RLS/RPC authorization denials where they can be reliably observed.
- Attempts to access a resource outside the current user's permissions.
- Reads of restricted report evidence and private moderation context.
- Changes to roles, permissions, report status, moderation state, and account
  restrictions.

For protected reads, record the actor, resource ID, purpose or case ID where
appropriate, timestamp, and result. Do not log the protected content itself in
the access event.

### User-generated content and messages

Consider recording events such as:

- Content created, edited, or removed, identified by resource ID and actor.
- Rate limit reached, repeated posting, or other defined abuse indicators.
- A report submitted, claimed, reviewed, resolved, or reopened.
- Automated risk signal raised and the action resulting from it.
- A moderation action and any subsequent restore.
- Content access or evidence access by staff where the content is restricted.

Do not duplicate all public comments, posts, or private messages into the
security log. Normal application records already hold content. Link to the
record by ID when an investigation or alert needs it.

### Upload and storage activity

Consider recording:

- Upload attempt received, validation result, scan started/completed, accepted,
  rejected, quarantined, released, and deleted.
- Attempts blocked by authentication, ownership, size, type, rate, or quota
  rules.
- Administrative access or release of quarantined files.
- Unexpected storage policy failures or repeated attempts to use disallowed
  paths/types.

Useful safe metadata includes generated object ID, uploader ID, byte size,
detected media type, scanner or decoder result, hash if justified, and a
reason code. Avoid original filenames by default; they can contain sensitive
information or malicious markup. Do not store file bytes in audit rows.

### Infrastructure and integration events

Consider recording:

- Important database, storage, and Edge Function failures.
- Configuration changes made by administrators or deployment systems.
- Discord alert queued, delivered, retried, failed, or dead-lettered.
- Scanner or moderation provider health and timeout events.
- Rate-limit service errors, queue backlogs, and audit-write failures.

Never include secret values or privileged configuration in these records.

## Event integrity, access, and retention

### Make the audit trail trustworthy

- Emit security-relevant events from trusted backend code, database functions,
  or service-side triggers. A browser can request an action but should not be
  able to write arbitrary audit records or claim its own event outcome.
- Use server-generated event IDs and timestamps. Validate correlation IDs;
  limit their size and character set.
- Give the event writer the narrowest database privileges possible. Separate
  write access from read access where practical.
- Make events append-only to normal application roles. Do not permit ordinary
  users or moderators to edit or delete history.
- Protect administrator access to the log itself. Restrict reads to designated
  security administrators; do not assume all moderators need full audit-log
  access.
- Consider a retention/archival mechanism and tamper-evident controls if the
  risk model warrants them. A database table alone is not automatically
  immutable against privileged project operators.
- Monitor failures to write events. Do not silently report an action as safely
  logged when persistence failed. For high-risk actions, decide whether audit
  persistence failure should block the action or raise an operational alert.

### Separate routine logs from case evidence

Routine audit records should contain metadata and references. Report evidence
should be stored separately in a restricted workflow with its own:

- Purpose and allowed access roles.
- Access audit records.
- Retention and deletion rules.
- Encryption and backup considerations.
- Rules for redaction or minimization.

For a reported private message, preserve the reported message and only the
context needed to assess it, rather than giving reviewers access to unrelated
conversation history. The existing message-report flow already follows the
principle of scoped review; preserve that boundary.

### Define retention before enabling collection

Choose different retention periods for:

- Routine security event metadata.
- Open report evidence and closed-case evidence.
- Scanner results and quarantine objects.
- Discord notifications.

Retention must be based on a stated security and operational purpose, not
indefinite availability. Define deletion, archival, and legal-hold procedures.
Routine-event and case-evidence retention periods require approval before
production collection. The audience and minor-safeguarding status also require
review; until then, keep routine audit logging disabled, minimize personal
data, and do not send private content to Discord. Quarantined uploads are
deleted after one hour by the scheduled cleanup worker, but this operational
default still requires production review. The worker processes at most 1,000
expired objects per invocation; rerun it promptly when `more_pending` is true.

## Unsafe upload prevention

The current browser-to-public-bucket path should be replaced or constrained
before treating uploads as screened.

### Proposed flow

1. **Authenticate and authorize.** Confirm the actor is signed in, allowed to
   upload, not suspended where relevant, and uploading within a defined quota.
2. **Apply ingress limits.** Enforce maximum request/file size, upload
   frequency, and allowed file categories on the trusted backend or storage
   boundary. Client-side checks are only for UX.
3. **Use generated object names.** Store files under opaque IDs and the
   appropriate owner namespace. Do not use a user-controlled filename as the
   storage key.
4. **Upload into private quarantine.** Objects must not be publicly retrievable
   while unverified. Ensure the bucket and policies prevent users from
   bypassing the review state with a direct public upload.
5. **Validate actual content.** Compare extension, declared MIME type, and
   detected file signature. Allow only specific types needed by product
   features. Reject mismatches and unsupported formats.
6. **Inspect and transform where appropriate.** Scan with a trusted malware
   scanner when appropriate. For image use, decode and re-encode supported
   formats and strip unnecessary metadata. Do not attempt to render or serve
   arbitrary active content from the app's origin.
7. **Record each state transition.** Write server-side events with upload ID,
   actor, detected type, size, result, reason, scanner version, and correlation
   IDs.
8. **Publish only approved objects.** Move or copy accepted assets to
   controlled public storage, or serve them through an authorized delivery
   path. Ensure the original quarantine object cannot remain publicly
   accessible.
9. **Clean up rejected and abandoned uploads.** Delete/quarantine according to
   a documented policy, and record the deletion outcome. Limit how long
   rejected file bytes are retained.
10. **Test bypass attempts.** Verify direct Storage API access, path traversal
    names, spoofed MIME types, oversized files, malformed images, unsupported
    formats, and unauthorized owner paths are blocked.

### Decisions needed for uploads

- Which types are required initially? Avatars likely need a narrow raster-image
  allowlist. Do not allow arbitrary office documents, archives, executables,
  SVG, or video until a concrete feature and safe delivery design exists.
- What are the maximum file size, image dimensions, and per-account upload
  rates?
- Is a managed scanning service needed for the initial image-only scope, or
  will strict type validation plus safe image decoding/re-encoding be the first
  control?
- Should an upload be rejected on scanner timeout, or remain private in
  quarantine pending a retry? It must not be published while the check is
  unresolved.
- How long should quarantined and rejected bytes be retained?
- What should users see when an upload is held, rejected, or the scanner is
  unavailable?

## Risky messages and other user content

Logging does not make message content safe. The proposed first boundary is
automated risk signals with constrained human review:

- Apply backend validation and rate limits on message submission.
- Begin with narrow, explainable signals such as repeated-message bursts,
  link-spam patterns, known prohibited formats, or explicit report-based
  signals.
- If content analysis is introduced, define the categories and resulting
  actions first. Prefer a flag or review queue over automatic punitive action
  for uncertain matches.
- Store the message itself in the normal message table. An event should refer
  to its ID and record signal category, severity/confidence, policy version,
  and action. Do not copy every private-message body into event logs.
- Restrict human review to the reported item and minimal context needed for a
  case, with access audited. Do not make all private conversations generally
  visible to staff.
- Make it clear to users what automated checks are used and how to report
  harmful content. Provide a way to challenge mistaken actions.
- If any external model or provider processes content, decide explicitly what
  data is sent, where it is processed, how long it is retained, and what users
  must be told. Do not add a third-party content processor by implication.

Apply comparable abuse controls to posts, comments, forum threads, profile
fields, and project listings where appropriate. Keep policies and log
categories consistent across these surfaces.

## Discord alerting

### Recommended initial integration

Start with a **Discord webhook** to a private, access-controlled security
channel if the need is one-way notifications. Build a full bot only if later
requirements include interactive commands, acknowledgements, or a more
complex workflow.

Discord is a notification mirror, not the audit system of record. Persist the
event in BACKLINE first. Queue alert delivery separately so Discord failure
does not undo a successful app operation or erase the event.

### Events that may warrant an alert

Use a curated allowlist, for example:

- High-confidence upload rejection or repeated attempts to bypass upload
  controls.
- Sudden bursts of failed sign-ins, denied access, or rate-limit events.
- A high-severity automated risk signal or multiple related signals.
- A new report involving a private message, without revealing its body.
- Staff access to sensitive evidence or an unusual administrative action.
- Role grants/revocations, account suspension/reinstatement, and other
  high-impact changes.
- Scanner, audit writer, queue, or alert-delivery health failures.

Do not post every ordinary content creation event by default. If admins later
want a feed of new accounts, comments, or uploads, make that a separately
configurable, rate-limited operational feed with minimal fields and clear
purpose.

### Safe alert contents

An alert can contain:

- Severity, event type, timestamp, event ID, and request/correlation ID.
- A short reason code and normalized outcome.
- A pseudonymous or internal user ID where needed by trusted admins.
- Resource type/ID, upload type/size, or scanner result as applicable.
- A link to an authenticated BACKLINE staff view, not a direct public evidence
  URL.

Do not send:

- Passwords, tokens, cookies, or any secret.
- Full message bodies, private conversations, report details, or case notes.
- The uploaded file itself, its public URL, or user-controlled filename.
- Full source IPs or device identifiers by default.
- Personal data that is not necessary to triage the alert.

Keep the Discord channel private, review membership periodically, and account
for Discord retention, forwarding, screenshots, and account compromise in the
threat model. Consider whether alert content should use an internal account
reference rather than a display name.

### Reliability and abuse resistance

- Store the webhook URL or bot token only in server-side secret storage. Never
  place it in Vite environment variables prefixed for browser exposure, client
  code, commits, logs, or error messages.
- Use a backend queue/outbox with a unique event ID and idempotent delivery
  tracking. Record queued, delivered, retrying, and failed states.
- Retry transient errors with backoff and a maximum retry count; move
  persistent failures to a reviewable dead-letter state.
- Rate-limit, aggregate, or deduplicate repeated alerts. During an attack,
  preserve event records while preventing a flood from hiding critical alerts.
- Escape and truncate all user-controlled text. Prefer controlled fields and
  never interpolate arbitrary user content into Discord markdown or mentions.
  Disable unintended `@everyone`/role mentions.
- Monitor queue age and delivery failures. Alert through an independent
  operational channel if the Discord integration is unavailable.
- Test that a Discord outage, invalid token, rate limit, or payload rejection
  does not prevent login, messaging, reporting, or upload safety checks.

## Detection and response operations

Define what happens after an alert; a notification without a response process
can create noise without improving safety.

For each severity level, document:

- Who is notified and who is allowed to investigate.
- Expected response time and escalation path.
- Which actions are permitted (for example, hold an upload, restrict an
  account, or disable an integration).
- How to preserve relevant evidence and record the case.
- How to avoid exposing evidence in Discord or routine logs.
- How to restore service and review false positives.

Useful baseline detection rules may include:

- Failed sign-in counts per account and source over a defined window.
- Rate-limit hits, rejected uploads, and permission denials by source/account.
- High-frequency account creation or content submission.
- Repeated invalid file signatures or attempts to access other users' object
  paths.
- A sudden increase in reports, risk flags, or storage errors.
- Changes to staff roles or access to sensitive records.
- Audit-event write failure, growing alert queue, or stale scanner health.

Set thresholds using measured normal traffic. Avoid hard-coded assumptions
that turn ordinary bursts into incidents or allow an attacker to overwhelm
admins with alerts.

## Implementation sequence

### Phase 0 — Decisions and threat model

Implementation decisions recorded:

- Accept JPEG, PNG, and WebP avatars up to 5 MB; preflight dimensions, decode,
  and re-encode server-side. No third-party malware scanner is in scope.
- Use server-side message rate limiting and repeated-message heuristics only;
  risk signals do not automatically restrict accounts.
- Keep audit-event reads admin-only, omit source IPs and device identifiers,
  and keep routine audit persistence disabled until privacy and retention
  approvals are recorded.
- Fail high-impact database actions if audit persistence fails while audit
  logging is enabled. Discord delivery remains optional and non-blocking.

**Production gates:** audience/minor-safeguarding review, retention and
deletion rules, incident ownership, and Supabase deployment/access validation
remain unresolved. Complete these reviews before enabling routine audit
collection or production rollout.

### Phase 1 — Trusted audit-event foundation (implemented locally)

- Design a versioned event schema and stable event-type catalog.
- Implement server-side event writers and narrow database permissions.
- Add RLS and operational access controls so ordinary users cannot read or
  mutate the audit log.
- Add correlation IDs across relevant backend operations.
- Instrument a small high-value set: authentication/account events, staff
  actions, reports, access denials, and system failures.
- Ensure sensitive values are redacted before persistence.
- Add monitoring for event-write failures and verify append-only behavior for
  ordinary roles.

**Exit criteria:** representative events are correctly attributed, correlated,
restricted, timestamped, and cannot be forged or edited by a normal user.

### Phase 2 — Upload quarantine and validation (implemented locally)

- Change the upload path so untrusted files enter private quarantine.
- Enforce type, size, ownership, quota, and rate limits on trusted boundaries.
- Add signature/content validation and safe image decoding/re-encoding for
  supported image formats.
- Integrate malware scanning if required by the accepted file scope.
- Record upload lifecycle events and prevent publication until approved.
- Add rejected/abandoned object cleanup and status feedback.
- Verify public bucket policies cannot bypass the validation flow.

**Exit criteria:** tests demonstrate that allowed images become available only
after checks and disallowed, malformed, oversized, or mismatched files stay
private or are rejected.

### Phase 3 — Reports, evidence, and message-risk signals (implemented locally)

- Preserve reported evidence in a separate restricted workflow with an
  explicit retention rule.
- Audit every staff access to restricted evidence and every case decision.
- Add server-side rate limiting and selected explainable message/content risk
  signals.
- Keep human review scoped to reported/authorized items and minimal context.
- Define false-positive handling, appeals, and any user-facing explanations.

**Exit criteria:** a report can be investigated without granting general
access to private conversations; event logs do not contain duplicate message
bodies.

### Phase 4 — Discord notifications (implemented locally; optional)

- Create a private Discord channel and decide its membership and moderation.
- Use a server-side webhook secret for one-way alerts, or a bot only if
  interactive functionality is approved.
- Implement an outbox/queue, idempotency, retry behavior, rate controls, safe
  payload rendering, and delivery status events.
- Enable a small high-value allowlist of alerts first.
- Test channel removal, secret rotation, Discord rate limits, provider outage,
  and attempted markdown/mention injection.

**Exit criteria:** event persistence and safety decisions continue to work
when Discord is unavailable; alerts contain no secrets or unapproved private
content.

### Phase 5 — Operational tuning

- Review alert volume, false positives, missed events, and queue health.
- Tune thresholds and deduplication based on real traffic.
- Test incident response and account/evidence access controls.
- Review retention and permissions periodically, especially after product or
  audience changes.
- Document ownership for updates to event types, scanners, and policies.

## Verification checklist

Before enabling in production, verify at least the following in a separate
Supabase project:

### Event logging

- Every tested event has a unique event ID, UTC timestamp, stable event type,
  actor/resource association where appropriate, outcome, and reason.
- HTTP status is populated only where applicable and is not confused with
  event type or scanner outcome.
- Request/transaction IDs correlate related lifecycle events without exposing
  session secrets.
- Source IP/device data are absent unless deliberately enabled under the
  approved policy, and client-supplied values cannot override server values.
- Normal users and unauthorized staff cannot read, insert, alter, or delete
  security audit events.
- Event-write failures are observable and do not create false claims that an
  action was recorded.
- Logs do not contain passwords, tokens, cookies, full message bodies, raw
  request bodies, or file contents.

### Upload handling

- Spoofed MIME type, mismatched extension, malformed file, oversized image,
  unsupported format, and unauthorized storage path are rejected or held
  private.
- A direct Storage API call cannot bypass quarantine or approval.
- Pending and rejected objects are not publicly readable.
- A scanner timeout leaves the object private.
- Approved content is served only through the intended publication path.
- Original filenames and embedded metadata are handled according to policy.
- Rejected/abandoned objects are removed within the defined cleanup schedule.

### Reports and messages

- A reported message remains scoped to the report; staff cannot read unrelated
  conversation history.
- Evidence reads, report decisions, and moderation actions are audited.
- Routine logs and Discord alerts do not include private message content or
  unrestricted report details.
- Rate limits and risk signals are enforced server-side and are resilient to
  client bypass.
- False-positive review and restoration paths work.

### Discord and operations

- Webhook/bot credentials are server-side only, rotatable, and excluded from
  logs and client bundles.
- An event is persisted before alert delivery begins.
- Duplicate deliveries are prevented or clearly marked; retries and permanent
  failures are visible.
- A burst cannot flood the channel or hide critical events.
- User-controlled text cannot cause mentions, markdown abuse, or oversized
  payloads.
- Discord outage does not block site functionality or erase security events.
- Staff can use the BACKLINE admin view to investigate without relying on the
  Discord message as evidence.

## Decisions and production gates

The implementation choices above are recorded. The following still require
operator or privacy review before production:

- Confirm whether minors may use BACKLINE and complete any required privacy
  and safeguarding review.
- Approve retention and deletion periods for routine audit events and
  case-related evidence; document any legal-hold process.
- Assign incident response ownership, escalation paths, and periodic access
  and retention reviews.
- Review the private Discord channel, membership, response owner, and alert
  policy before configuring its webhook.
- Apply migrations, deploy functions, configure secrets and schedules, and
  validate RLS, fail-closed behavior, cleanup, and alert outages in a separate
  Supabase project.

## Final principle

Collect enough trustworthy metadata to explain and correlate security-relevant
actions, but do not turn operational logs or Discord into a shadow copy of
BACKLINE's private data. Keep prevention at trusted backend boundaries,
investigation evidence narrowly scoped, and Discord alerts useful, minimal,
and non-authoritative.
