# Test status — 2026-10-29

Executed `npm test` on base package without installing dependencies. **24 tests executed: 19 passed, 5 failed.**

- `tests/database.test.mjs`: missing dependency `@electric-sql/pglite` in environment.
- `tests/import.test.mjs`: test references `scripts/prepare-import.mjs`, which is stored only in `docs/legacy_backend_20261019/scripts_reference_only` in the conservative GitHub baseline.
- `tests/tls-s56f-contract-03.test.mjs` and two tests in `tests/tls-shift-integration.test.mjs`: references SQL migration files `202610210031_tls_shifts.sql` and `202610210033_tls_reminders.sql` which were **not** present in supplied source bundles.

The five failures were not resolved by fabricating missing SQL or changing test semantics. These tests require the canonical SQL migrations and a dev test environment. The result does not validate Production and is not a deployment signoff.

JavaScript syntax-only checks run previously were not equivalent to build/test passing.
