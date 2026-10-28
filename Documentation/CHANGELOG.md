# Changelog

Notable changes to BACKLINE are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

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
- Added `/my-reports` and the role-gated `/staff` workspace.
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
