# Build 116 — Final release manifest and zero-mutation plan

- Release remains `v1.05.N18-P36`; this block does not invent a version bump.
- The exact clean commit and tree are bound at publication time and must match GitHub `master`, Replit Shell, the provider package, and live health metadata.
- Both Navisworks 2021 and 2025 P36 package SHA-256 sidecars are mandatory manifest inputs.
- Database action is `NONE`: the Workflow Governance `_chk` source names now match the already-deployed constraints, so no database rename or migration is required.
- Any destructive statement, data-copy option, stale source, or Replit Agent usage fails the release.
