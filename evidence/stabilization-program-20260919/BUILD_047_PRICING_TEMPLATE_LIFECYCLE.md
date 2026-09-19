# Build 047 — Company Pricing Template lifecycle

- Result: PASS
- Scope: versioning, required audit reason, publication, functional supersession, retirement, and immutable historical use.
- The existing implementation is append-only: every draft, publication, replacement, and retirement is a new immutable version linked by `supersedes_id`; historical records are never rewritten.
- Only the latest published version is selectable for a new contract. Earlier published versions remain immutable evidence and are rejected for new selection as superseded.
- Publication and retirement require a separate Company PMO/Finance approver; ordinary, cross-company, maker-as-checker, stale-version, wrong-currency, draft, retired, and fingerprint-mismatch paths fail closed.
- Added a permanent lifecycle contract test to keep these guarantees in the normal suite.
- Verification: pricing definition contract PASS; lifecycle source contract PASS; API/web TypeScript remained green from Build 046.
- Database change: none in this build.
- Native/installer impact: none.
