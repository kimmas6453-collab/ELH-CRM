# Historical migrations from 19/10/2026 — DO NOT PUSH TO PRODUCTION

These 19 SQL files were copied from the 19/10 source archive to keep existing unit-test fixtures working. Production reported an empty migration ledger on 29/10 even though much of this SQL was applied through the dashboard. Therefore running `supabase db push` can attempt to reapply historical migrations and cause errors or damage. These files are NOT an authoritative schema snapshot for 29/10. Export the latest schema separately; reconcile migration history only with an approved migration plan.
