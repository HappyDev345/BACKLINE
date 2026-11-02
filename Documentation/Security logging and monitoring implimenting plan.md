# BACKLINE Security Logging and Monitoring Implementation Plan

## Problem and approach

Implement the complete program in `Documentation/SECURITY-LOGGING-AND-MONITORING-PLAN.md` as staged, testable changes. Establish trusted, restricted audit events first; then secure avatar uploads, extend scoped report/evidence and content-risk controls, add optional Discord notifications, and finish with operational verification. Preserve preview-mode behavior and keep private content out of routine logs and Discord.

## Agreed defaults and production gates

- Audience/minor status is unknown. Keep collection minimal and require appropriate privacy/safeguarding review before production collection or retention of sensitive evidence.
- Do not collect source IP or device identifiers. Never log passwords, tokens, cookies, raw request bodies, uploaded bytes, private-message bodies, or untrusted filenames.
- Initial avatar scope: JPEG, PNG, and WebP; maximum 5 MB; validate actual content and decode/re-encode; no external malware scanner initially. Confirm platform-compatible image processing before selecting the implementation.
- Content signals: server-side rate limits and explainable heuristics/reports only; no external content-analysis provider.
- Routine-event retention is undecided. Require an approved period before production logging; define case-evidence and quarantine retention separately.
- Restrict security-audit reads to admins. High-impact staff actions fail closed if their audit event cannot be persisted. Discord delivery is non-blocking.
- Use a private, server-side Discord webhook for a small allowlist only, after the audit store is working. Discord is not the system of record.
- Verify Supabase project capabilities, Edge Function/runtime limits, storage behavior, log access, and secrets management before enabling production behavior.

## Todos and implementation sequence

1. **Resolve operational and privacy gates**
   - Verify deployment/Supabase capabilities and where trusted auth/security events can be obtained.
   - Document event catalog, severity, designated audit/evidence roles, retention, incident ownership, and production approval requirements.
   - Confirm upload limits and user-facing behavior for validation or processing failure.
   - Do not enable sensitive production collection while audience and retention approvals are outstanding.

2. **Build the trusted audit-event foundation**
   - Add a versioned append-only event schema and narrow server-side writer, using server-generated IDs/timestamps and controlled event fields.
   - Restrict direct insert/update/delete to ordinary roles and reads to admins; ensure a browser cannot forge events.
   - Add transaction/request correlation where trustworthy and available; do not treat client values as authoritative.
   - Instrument high-value backend events: report lifecycle, moderation and role/account changes, evidence access, account deletion, and relevant system failures. Integrate authentication events only through a verified trusted Supabase source.
   - Make audit persistence errors explicit; block high-impact privileged mutations when recording fails.
   - Add tests for attribution, redaction, access control, append-only behavior, and failure handling.

3. **Move avatars to private quarantine and safe publication**
   - Replace direct browser uploads to the public `media` bucket with a trusted ingress/processing flow and private quarantine.
   - Enforce authentication, ownership, size, allowed formats, actual file type, and rate/quota rules server-side. Use generated object keys.
   - Decode/re-encode allowed raster images, strip unnecessary metadata, record upload lifecycle events, and publish only validated output.
   - Keep pending/rejected objects private; define cleanup and user-visible outcomes; verify direct Storage API access cannot bypass the flow.
   - Add verification for spoofed MIME, malformed/oversized images, unauthorized paths, processing failures, and cleanup.

4. **Audit reports/evidence and add bounded content-risk controls**
   - Preserve the existing scoped reported-message access boundary.
   - Audit report creation/claim/review/resolution, staff-note changes as appropriate, moderation decisions, and each restricted evidence read without copying protected content into event records.
   - Add server-side message rate limiting and narrowly scoped, explainable signals; keep uncertain signals review-only and provide an appropriate false-positive/appeal path.
   - Test that staff cannot use these workflows to read unrelated private conversations and that routine logs contain no message bodies.

5. **Add reliable, privacy-safe Discord alerts**
   - Create an outbox/queue keyed by event ID; deliver only an allowlisted subset after the authoritative event is stored.
   - Keep the webhook secret server-side; implement idempotency, bounded retries/backoff, rate control/deduplication, safe rendering, disabled mentions, and visible delivery failure/dead-letter state.
   - Verify provider outages, rate limits, invalid/rotated secrets, and hostile user-controlled text cannot block app actions or expose private content.

6. **Operationalize and verify**
   - Add operational visibility for audit-write failures, upload processing/cleanup, and alert queue health using available platform facilities.
   - Document response ownership, escalation, retention/deletion, access review, and false-positive handling; tune thresholds only against observed traffic.
   - Run migration/function checks and targeted tests in a separate Supabase project before production rollout; update the security plan and README to describe implemented behavior and remaining gates.

## Key files and components

- `supabase/schema.sql` and new timestamped migrations for the audit schema, access policies, and server-side event functions.
- `supabase/functions/` for trusted upload processing, alert delivery, and any verified platform integration that belongs at the Edge boundary.
- `src/pages/ProfilePage.jsx` for replacing the direct public avatar upload path.
- `src/pages/StaffPage.jsx` and the report/moderation RPC migrations for scoped evidence access and audit coverage.
- `src/pages/MessagesPage.jsx` and message-related RPC/policies for server-side rate/risk checks.
- `src/context/AuthContext.jsx` / `src/lib/supabase.js` only where trusted auth integration or user-facing failure handling requires it.
- `Documentation/SECURITY-LOGGING-AND-MONITORING-PLAN.md` and `README.md` for current-state and operational documentation.

## Notes and constraints

- Keep changes incremental and preserve the existing preview/demo mode.
- Reuse existing report, moderation, role, and Edge Function patterns; do not duplicate report evidence in the audit log.
- A database table is not immutable against project operators; describe the actual trust boundary and use platform-level controls where available.
- Do not introduce IP/device collection, external content processors, or public access to unverified files without an explicit policy change.
- Production logging and evidence retention remain gated on privacy/audience review and an approved retention schedule.
