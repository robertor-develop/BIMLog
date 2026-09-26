# I002 — explicit company retirement and protected identity references

Adds nullable retirement target/time to the existing companies authority with a self-reference and paired-state check. Explicit additive SQL is supplied for governed release, not a login/startup mutation. Operational admin and client lists omit retired aliases; registration invite targets, client creation and project rebinding reject retired targets. Historical records remain stored.

The bounded alias resolver detects missing rows, invalid IDs, cycles and excessive depth. Resolution never grants membership. The collision key is only a candidate-matching primitive, not legal identity or permission authority.

Pure behavior cases passed via the installed tsx CLI. `test-identity-lifecycle-db.mjs` passed actual isolated PostgreSQL migration/replay, foreign-key, paired-state, self-alias refusal, operational filtering and rollback checks. DB/Zod declaration build and API typecheck passed. Full release gate remains pending. Production migration/retirement has NOT run. Company38 remains outside the31/35 reconciliation.
