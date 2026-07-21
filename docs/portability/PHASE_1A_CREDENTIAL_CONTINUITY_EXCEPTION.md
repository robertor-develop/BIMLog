# Phase 1A Credential Continuity Exception

Status: local review candidate; not deployed or published
Owner decision: Roberto explicitly approved this temporary exception
Baseline: `2c1ffc4b5c08618610cdb70b42fcb08556726f1c`

## Decision and boundary

Working credential material has intentionally been kept in its present configuration because earlier Replit rebuilds lost or replaced configuration and required repeated manual recovery. Roberto has decided that operational continuity takes priority until final launch hardening.

This is an owner-approved temporary risk acceptance, not the desired public-launch architecture. Until Roberto gives fresh explicit approval, no working credential or credential-bearing configuration may be rotated, revoked, deleted, replaced, moved, re-encrypted, regenerated, invalidated, tested against a provider, or otherwise changed. Rebuild behavior must remain unchanged and must not require Roberto to re-enter credentials.

## Value-blind inventory

The inventory deliberately records categories and dependencies only. It contains no value, endpoint, account identifier, customer information, or provider response.

| Credential or continuity type | Owning category | Storage classification at this baseline | Operational dependency | Recovery owner |
|---|---|---|---|---|
| Application token-signing material | BIMLog authentication | Literal assignment inside the protected tracked Replit configuration | Existing bearer tokens and signed OAuth/Living Brief state; rebuilt API startup | Roberto/BIMLog |
| Production database connection credential | Database integration | Literal assignment inside the protected tracked Replit configuration | API startup and all production persistence | Roberto/BIMLog plus database-account owner |
| Application session-signing material | BIMLog authentication | Runtime environment dependency; actual provider-side storage is unverified in this phase | Browser OAuth/session continuity | Roberto/BIMLog |
| Telegram bot, webhook-signing and data-protection material | Telegram integration | Runtime environment/provider configuration; exact live storage is unverified and was not accessed | Webhook authentication, bot delivery and protected Telegram product data | Roberto/BIMLog plus Telegram-account owner |
| Email delivery credential | Email integration | Runtime environment/provider configuration; exact live storage is unverified and was not accessed | Transactional email and notification delivery | Roberto/BIMLog plus email-provider owner |
| AI provider access and key-encryption material | AI integrations | Runtime environment plus database-backed encrypted provider-connection design; live values were not accessed | AI requests and decryption of stored provider connections | Roberto/BIMLog plus AI-provider owners |
| OAuth client credentials | Drive/document/BIM integrations | Runtime environment and provider application configuration; exact live storage is unverified | Google Drive, Dropbox, Autodesk and Procore connection flows | Roberto/BIMLog plus each provider-account owner |
| Desktop Sync Agent API token | Customer desktop integration | Local per-user application configuration | Sync Agent authentication to the configured BIMLog endpoint | Roberto/BIMLog for server issuance; customer for local custody |
| Public URLs, callbacks and webhook destinations | Cross-provider continuity configuration | Tracked/runtime/provider settings, depending on integration | Signed-link validity, callbacks, webhook delivery and cutover continuity | Roberto/BIMLog plus DNS/provider owners |

### Fingerprint policy

The entire protected tracked configuration file is guarded by one SHA-256 fingerprint established from the accepted baseline. The fingerprint is used only for equality checking. The guard prints neither the expected nor observed fingerprint and never parses, prints, copies, or transmits credential values.

Whole-file fingerprinting is intentional: it proves that credential assignments and the rebuild configuration surrounding them remain byte-for-byte unchanged. Any legitimate future edit to that file requires a separately approved owner review and baseline update.

Provider-side secrets, database-held encrypted connections, callback settings and desktop tokens are not fingerprinted because this phase does not access those systems or values.

## Non-mutating safeguards

1. Run `node scripts/check-credential-continuity.mjs` before and after every portability candidate. A failure is a hard stop, not permission to inspect or replace a value.
2. Never print or capture the protected file, environment contents, provider responses, database URLs, authentication headers or desktop token files in logs/evidence.
3. Use names/categories and boolean presence results only. Do not use shell tracing, verbose HTTP clients, environment dumps, broad configuration diffs or error reporting that can echo values.
4. Exclude the protected file from Phase 1A patches. Review `git diff --name-only` before any content diff.
5. Do not call providers to test credentials. Future provider checks require explicit launch-hardening approval and a secrets-safe procedure.
6. Treat a fingerprint mismatch, missing protected file, unexpected authentication change or rebuild prompting for manual entry as a real blocker. Stop and return to Roberto.
7. Keep Phase 1A evidence outside production systems and free of fingerprints tied to individual credentials. The whole-file guard is sufficient.

## Rebuild dependencies that must remain stable

- The protected Replit configuration supplies runtime modules, deployment mode, workflows and literal continuity assignments.
- Replit artifact declarations supply API build/start, static-web build/serve, routing and startup-health behavior.
- Application code requires stable runtime environment names for database, authentication, sessions, callbacks, Telegram, email, AI and OAuth integrations.
- The deployed Living Brief requires the complete source bundle and accepted source-commit metadata.
- Provider-side secret scopes and callback registrations may also participate in rebuild continuity, but they were not accessed and remain unverified.

No Phase 1A change may alter these behaviors or require credential re-entry.

## Future launch-hardening migration design — not authorized for implementation

The final migration should be a single controlled cutover, not a sequence of ad hoc credential moves:

1. Roberto approves the launch window, owners, managed-secret platform, recovery custodians, rollback criteria and provider-by-provider mutation list.
2. Freeze credential-bearing configuration and produce a value-blind inventory of every runtime consumer, provider registration, callback and build/rebuild scope.
3. Establish durable managed-secret storage with access controls, audit logging, encrypted backup/export where supported, account recovery and a tested rebuild injection path that does not require repeated manual entry.
4. Build a disposable environment using newly provisioned non-production credentials and callbacks. Prove build, rebuild, restart, rollback and secret recovery without touching current production credentials.
5. Take a final protected configuration fingerprint and recovery snapshot under owner control. Prepare an exact rollback map for each provider and client.
6. During the approved cutover, provision the managed production secrets, update runtime bindings and callbacks in one coordinated window, and preserve the prior environment for bounded rollback.
7. Independently validate authentication, database connectivity, callback signatures, Telegram/email delivery, OAuth flows, AI access and desktop/plugin continuity using sanitized pass/fail evidence only.
8. Rotate or revoke superseded credentials only after the replacement path and rollback decision are approved. The order may differ by provider and must prevent customer interruption.
9. After superseded credentials are confirmed unusable, execute a separately reviewed Git-history remediation and downstream-copy assessment. Never rewrite history while working credentials remain dependent on it.
10. Record final recovery ownership, rotation cadence, backup/restore proof and rebuild drill. Close the exception only by Roberto's explicit written acceptance.

## Mandatory public-launch blocker

BIMLog must not enter public/production launch while this exception remains open. Launch requires explicit closure through:

- approved durable managed-secret migration and tested rebuild recovery;
- rotation/revocation as appropriate for every exposed or superseded credential;
- provider and callback continuity verification;
- Git-history and downstream-copy remediation after affected credentials are no longer valid;
- independent secrets-safe verification; and
- Roberto's explicit acceptance that the temporary exception is closed.

## Separate portability risks — documented, not changed here

- GitHub's default `main` is not the accepted `master` history. Phase 1A selects the accepted commit explicitly but does not change either branch or the remote default.
- Production attachments currently depend on local process disk and have no proven restore.
- Production database backup/restore remains unproven.
- Startup schema changes are non-versioned and not a proven empty/restored-database procedure.
- The static health route does not prove database, storage, migration, worker or provider readiness, and the declared probe path requires reconciliation.
- Scheduled/Telegram workers run in the API process and need a future singleton or lease design.
- DNS, provider-account recovery and callback ownership remain unverified.

These items remain governed by the Step 0 portability audit and require later approval. They do not authorize credential mutation.

## Reusable validation checklist for future portability candidates

The unchecked boxes below are a reusable procedure for later candidates. They are not the result record for this completed Phase 1A candidate; its executed results are recorded in the external Phase 1A evidence manifest.

- [ ] Accepted commit and remote `master` are recorded explicitly; no reliance on remote default.
- [ ] Protected-file guard passes before work.
- [ ] Patch excludes the protected Replit configuration and all credential-bearing files.
- [ ] No environment dump, provider call, production/customer access or credential test occurred.
- [ ] Documentation contains categories only and no credential value/private endpoint.
- [ ] Protected-file guard passes after work.
- [ ] Git diff confirms only approved non-secret documentation/guardrail files changed.
- [ ] Focused guardrail behavior test passes for match, mismatch and missing-file cases without printing fingerprints.
- [ ] Main checkout and audit worktree remain unchanged.
- [ ] No push, publish, deployment, callback, environment, authentication or provider change occurred.
