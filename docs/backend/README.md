# Supabase backend — ELH CRM

- Production candidate project ref: `qmzmkijlarwdlslipaou` (verify against actual frontend environment before deployment).
- Read-only catalog export on **2026-10-29**: 12/12 sections OK (counts in `production_catalog_status_20261029.json`).
- The complete raw `catalog_*.json` files remain **only on the user's Windows Desktop**; they were not attached in this conversation. Do not commit them.
- The `production_structure_20261029_SANITIZED.json` file is created by running `PREPARE_GITHUB_SAFE.cmd` against the user's existing offline catalog. It excludes SQL function bodies, expressions, policy predicates, secrets, and record values.
- **This is not a restorable PostgreSQL backup.** Raw production schema DDL, RLS policy predicates, function bodies, grants, Auth, data and secrets have not been included in the GitHub baseline.
- The 19 October migrations are **reference only** under `docs/legacy_backend_20261019/migrations_reference_only`; do not run them against Production or automatically migrate a blank instance without expert review.
- Two Edge Functions (`callio-sync`, `crm-accounts`) are stored under `supabase/functions/` and matched prior read-only checks of deployed source; environment secrets and invocation permissions are not part of this source.
- Zero rows in the exported grants catalog does not establish that no grants exist; the export may be limited by metadata scope/permissions.

**Never execute migration/reset/deploy commands on the live database while checking this package.**
