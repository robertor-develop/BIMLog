# Build 025 — current-state contradiction gate

The blocking `check:current-state-contract` contract verifies:

- exact current release and binary identity;
- current Build Ledger cadence and counts;
- Replit as BIMLog's proven publication provider;
- the canonical health/readiness contract;
- Lens Next as the sole supported Lens product;
- Legacy Lens as migration-only and absent from current customer-facing labels;
- current STATUS authority cannot regress to `PUSHED_NOT_PUBLISHED`;
- every unchecked OPEN_LOOP entry remains classified with evidence.

The root build invokes this gate before compilation. Its self-test proves parallel Lens support is rejected.
