# Supabase database changes

- For a new project, apply `../schema.sql` in the Supabase SQL Editor.
- For an existing project, apply each unapplied migration in filename order.
- Keep `schema.sql` as the complete, repeatable baseline for new projects and
  keep its policies in sync with later migrations.
- Do not run `reset-app-data.sql` as part of normal setup; it deletes application
  tables and data.

The app accesses Supabase through the Express API using the server-only
`SUPABASE_SECRET_KEY`. Apply `20261124_backend_api_only.sql` to disable direct
browser access to application tables. The API performs its own role checks.

Apply `20261124_authorization_ownership.sql` after the backend-only migration.
It adds account-active and token-version fields for immediate session
revocation, plus announcement creator ownership. Existing announcements are
left without a creator ID and can be managed by administrators; teachers can
manage announcements they create after this migration.
