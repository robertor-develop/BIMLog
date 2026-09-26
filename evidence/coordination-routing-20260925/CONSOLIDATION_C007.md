# C007 — ordered frozen-policy runtime approvals

Baseline:730aee9a5640b069f221feb6af65c213e1bc11fe.

Phase completion and final-deliverable rules form an ordered chain. Each approval resolves current company/project authority, rejects checkpoint/evidence authors, and stores its policy fingerprint/version, level and runtime revision in existing immutable events. Advance checks the chain even when the workflow's original phase did not require an approval. Legacy unbound behavior is unchanged. No schema or native Lens changes.

Local PASS: API typecheck; actual PostgreSQL workflow lifecycle including intermediate/final approval requirements, invalidated evidence reapproval, audit preservation, maker denial and concurrent read consistency; pure progress tests for role order, stale policy and resets. Existing template-authoring maker/checker controls remain unchanged. Thresholds and UI integration are separate C008/C010 work; no deployed acceptance is claimed.
