# BIMLog Feedback pass-through relay and Roberto receiver

Release identity: `v F-1.60.35.8`. Google Drive is excluded. PostgreSQL is the lifecycle/backlog authority; the receiver filesystem is a verified custody projection.

## Single protocol

All receiver traffic uses HTTPS and refuses redirects. Configuration pins the destination origin and leaf certificate or SPKI SHA-256 fingerprint. Every request is HMAC-SHA256 signed over a versioned, newline-delimited canonical form containing method, path, audience, key ID, UTC timestamp, nonce, feedback stable ID, asset/object ID, exact byte count, SHA-256, and body digest. The receiver accepts active and explicitly bounded grace keys, signs only with the active key, enforces clock skew, and atomically consumes nonces. Secrets, roots, content, and unsanitized names are never logged.

Endpoints are capability/health, idempotent object delivery, immutable receipt retrieval, exact-byte readback verification, and custody status. A receipt canonically binds protocol version, feedback ID, asset/object ID, bytes, SHA-256, destination identity, received timestamp, nonce/request identity, and receiver key ID/signature. A successful HTTP status without a valid receipt is failure. Lost responses replay the same idempotency identity. A valid receipt prevents byte resend. Temporary deletion requires both a valid receipt and independent readback/hash confirmation where advertised.

## Relay state machine

`queued -> transferring -> delivered -> cleanup-pending` with terminal/exception states `manual-review`, `held`, and `expired`. Only governed clean scanner output may enter transfer; audio transcription follows clean custody and linked consent. Quarantined or rejected evidence never becomes permanent receiver custody. Transitions are versioned, transactional, idempotent, and audited.

Direct mode streams to a healthy configured receiver and retains no permanent BIMLog/Replit bytes. Queue mode exists only through the private encrypted `TemporaryRelayStore` port, with explicit configuration, TTL, byte/count quotas, opaque keys, no public URL, and compare-and-delete semantics. No approved adapter means fail closed with a visible unavailable/pending state. Retry count, exponential delay, concurrency lease, poison classification, and dead-letter/manual review are bounded and persisted. Cancellation stops unstarted work; holds defeat expiry and deletion. Partial transfer, hash mismatch, stale/forged receipt, unknown outcome, delete failure, or failed absence proof never discard bytes silently.

## Roberto-controlled receiver projection

The configured root must be independently approved and must not be a workspace, application, build, cache, or temporary directory. Every existing component is checked for links/reparse points and physical containment.

`<Root>/BIMLog-Feedback/{01-Active,02-Resolved-Retention,03-Legal-Hold,90-Quarantine,91-Transfer-Failures,99-System}/<CompanySlug>/<ProjectCode-or-General>/<YYYY>/<FB-StableId>/`

Each ticket has `README.txt`, `manifest.json`, and `originals/`, `screenshots/`, `audio/`, `documents/`, `transcripts/`, `receipts/`. Byte filenames are opaque: UTC timestamp plus short content hash. Sanitized display names exist only in `manifest.json`. Manifests are restore-safe, versioned, hash-bound, and contain no credentials or host paths. Atomic projection moves preserve ticket/object IDs and receipts.

## Cleanup and retention proposal

Durations are configuration surfaced for Roberto approval, never embedded as governing constants. Proposed defaults are temporary relay 7 days maximum; transfer failure/manual review and quarantine 30 days; resolved evidence 90 days after both customer and internal verified closure; legal hold has no automatic deletion.

Cleanup is dry-run first. It never auto-deletes Active, Hold, or unknown-outcome custody. Eligibility requires resolved and dual verified closure, no hold, elapsed policy, authenticated destination receipt, matching hash/readback, and operator approval for material purge. Execution produces a byte inventory and immutable deletion receipt, removes exact approved objects, verifies absence, and retains PostgreSQL metadata, hashes, decisions, audit, and deletion receipt. Quota/age dashboards, per-project review/export indexes, duplicate-content detection, and restore verification are required acceptance surfaces.

## Required executable acceptance

Local deterministic HTTPS receiver and encrypted temporary-store fixtures cover rotation/grace, replay/skew, idempotent duplicate and lost response, restart recovery, concurrent leases, quotas/TTL, poison/manual review, partial transfer, hash mismatch, forged/stale acknowledgments, delete failure, hold conflicts, custody-tree containment, atomic failure residue, projection moves, dry-run/operator approval, deletion inventory/receipt/absence, and bilingual customer status. Real receiver URLs, certificates, keys, provider storage, deployment, and customer data remain external gates.
