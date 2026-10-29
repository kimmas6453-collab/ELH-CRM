# ELH CRM — GitHub baseline 2026-10-29 (SAFE, NO DOCKER)

**Source control baseline, NOT a production release, complete database backup, or fully verified restore.**

## What's included
- `src/`, `tests/`, `index.html`, `package.json`, `package-lock.json`: frontend from user-provided 29/10 source archive.
- `public/`: assets recovered from the older 19/10 reference package; exact 29/10 deployment parity NOT verified.
- `supabase/functions/`: two Edge Functions, compared with deployed Supabase source in the preceding audit.
- `supabase/config.toml`: reference local configuration, no secret values.
- `supabase/migrations/`: intentionally EMPTY until proper production schema migrations are reviewed.
- `docs/legacy_backend_20261019/`: dated historical migration and operational scripts, NOT automatically runnable.
- `docs/backend/`: metadata export summary and sanitized offline snapshot after running `PREPARE_GITHUB_SAFE.cmd`.
- `scripts/export-supabase-no-docker.ps1`: optional repeatable read-only metadata export.

## Included after review 2026-10-29
- `docs/backend/production_structure_20261029_SANITIZED.json` uploaded and checked against the declared counts.
- `docs/backend/BACKEND_REVIEW_20261029.md` includes schema and access-control observations.
- `docs/TEST_STATUS_20261029.md` reports 19 passing / 5 failing tests in the current dependency-limited environment.
- `GITHUB_UPLOAD_GUIDE_VI.md` gives upload steps without Docker.

## Immediate action
1. Optionally run `PREPARE_GITHUB_SAFE.cmd` on Windows to produce sanitized structural metadata from the 12 existing local `catalog_*.json` files. It does not connect to the network or require a token.
2. Review `docs/SECURITY_AND_DEPLOYMENT.md` and `docs/BACKUP_STRATEGY.md`.
3. Push the repository to a **Private** GitHub repository with auto-deploy **disabled**.
4. Never push `.env`, tokens, customer records, database dumps, raw catalogs or previous ZIPs.

## No automatic production operation
No build/test success is claimed for this aggregate package. Validate project build and test in an isolated development environment before using any code to deploy.
