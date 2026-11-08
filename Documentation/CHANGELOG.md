# Changelog

Notable changes to BACKLINE are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## [1.7.0] - 2026-11-08

- Added immediate, best-effort worker wake-ups when alerts enter the durable
  outbox, while retaining scheduled polling as a backup.
- Replaced the conservative 10-per-minute cap with a global four-attempts-per-
  two-seconds safety limit, honored Discord `Retry-After`, and drained due
  backlog in bounded worker runs.
- Kept dead-letter alerts in the database beyond routine retention until an
  operator resolves them.

## [1.6.0] - 2026-11-03

- Reformatted Discord security notifications as timestamped green activity
  embeds and red error embeds.
- Added event-time actor names/usernames, account-target names/usernames, and
  project titles to the relevant audit metadata and Discord alerts. Message
  bodies, post/comment text, and raw error messages remain excluded.

## [1.5.0] - 2026-11-03

- Expanded the audit pipeline to record project, feed/forum post, comment, and
  authenticated client-error events without storing content or raw error text.
- Queued recorded audit events for Discord delivery and added a 30-day audit
  purge function. Audit persistence remains disabled by default; Auth sign-in
  and password-reset outcomes still rely on Supabase Auth audit logs.

## [1.4.0] - 2026-11-02

- Added a restricted, disabled-by-default security audit pipeline, admin-only
  event review, report and moderation event capture, and message rate/risk
  controls.
- Replaced direct avatar publication with private quarantine, server-side
  JPEG/PNG/WebP validation and PNG re-encoding, upload quotas, and cleanup.
- Added an optional privacy-minimal Discord alert outbox and worker.
- Added a detailed implementation logbook and deployment runbook. Deployment
  and production privacy/retention review are still required; routine audit
  logging remains disabled until its approval gates are met.

## [1.3.0] - 2026-10-29

- Added a dedicated `/saved` page where members can revisit and unsave saved
  projects.

## [1.2.10] - 2026-10-28

- Improved `/staff` account loading guidance when the admin account lookup
  migration has not been applied or refreshed in Supabase.

## [1.2.9] - 2026-10-28

- Made the suspended-profile visibility migrations safely replace an existing
  visibility policy, avoiding a duplicate-policy error on Supabase.

## [1.2.8] - 2026-10-28

- Hid suspended profiles from normal reads for admins as well as other users,
  while preserving account management and reinstatement through a dedicated
  admin-only lookup.

## [1.2.7] - 2026-10-28

- Anonymized suspended account references across posts, replies, projects,
  messages, and notifications as “Unknown User”; removed links to unavailable
  profiles while preserving relevant content.

## [1.2.6] - 2026-10-28

- Hid suspended profiles from public profile reads, including the People
  directory, while preserving access for the account owner and admins.

## [1.2.5] - 2026-10-28

- Removed the user-facing report history page and restricted report records to
  authorised staff.
- Added generic private notifications when reports are reviewed; notifications
  do not identify staff, disclose decisions, or link to report details.

## [1.2.4] - 2026-10-28

- Added reporting for individual private messages. Only admins can review
  message reports, and the staff workspace receives access only to the
  reported message rather than the private conversation.

## [1.2.3] - 2026-10-28

- Fixed the staff account lookup by explicitly selecting the account-owner
  relationship for account restrictions.

## [1.2.2] - 2026-10-28

- Fixed sent messages not appearing until a later refresh when Realtime updates
  are delayed or unavailable; successful sends now add the saved message to the
  open chat and refresh the conversation preview.

## [1.2.1] - 2026-10-28

- Fixed navigation overflow by tightening the wide-screen layout and moving
  navigation links and account actions into a responsive menu on smaller screens.

## [1.2.0] - 2026-10-28

- Added admin, feed/forum moderator, and project moderator roles, plus
  admin-managed verified badges and account restrictions.
- Added private reports for accounts, projects, posts, forum threads, and
  comments, with a staff review queue, case notes, content moderation, and
  action history.
- Added the role-gated `/staff` workspace.
- Secured conversation membership through an atomic server-side operation;
  legacy conversations require an access review before being restored.

## [1.1.1] - 2026-10-28

- Fixed profile follow counts and follow-state checks to use the follows
  table's composite key instead of a nonexistent `id` column.
- Restored the crew, crew-call, and discussion landing sections in connected
  mode, showing public Supabase records or clear loading, error, and empty states.

## [1.1.0] - 2026-10-28

- Replaced raw backend error details in user-facing messages with clear,
  action-oriented feedback.
- Added visible error feedback for failed community actions and data loads.
- Limited demo people, calls, and discussion previews on the landing page to
  preview mode so connected users aren't shown fictional community records.
- Added a one-click sample-user sign-in for preview mode.

## [1.0.0] - 2026-10-27

- Established the first tracked BACKLINE release.
- Added authentication-aware navigation, a dedicated About page, and account
  benefit information.
