# Changelog

Notable changes to BACKLINE are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

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
