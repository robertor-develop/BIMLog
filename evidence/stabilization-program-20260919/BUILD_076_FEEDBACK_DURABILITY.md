# Build 076 - Durable feedback lifecycle

The normal acceptance suite now binds feedback capture, customer readback, reviewer assignment, optimistic-concurrency state transitions, before/after audit evidence, encrypted backup settlement, and exact restore verification into one fail-closed contract. The contract rejects a future release that removes durable PostgreSQL authority, assignment/state evidence, lease fencing, or exact-byte/SHA-256 restore proof.
