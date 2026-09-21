# Build 212 — Isolated release rollback rehearsal

Status: PASS

- Rehearsed candidate activation and rollback through a fresh disposable filesystem target.
- An unhealthy candidate rolls back only to an independently healthy exact previous identity.
- A healthy candidate remains active; mismatched identity, unhealthy rollback target, or any non-disposable/production target fails closed.
- The rehearsal verifies the final release pointer and removes its disposable target.
