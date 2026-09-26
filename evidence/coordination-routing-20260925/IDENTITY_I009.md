# I009 — transactional acceptance and notification proof

Baseline: published42d06df0566d37e73cf5edd65f94b002c6f74357.

Reuses I008's existing locks, recipient binding and acceptance service. No duplicate invitation authority or new tables.

Acceptance now inserts a notification for the inviter into the existing notifications table in the same transaction as membership, invitation status and activity audit. Replay returns before all writes; credentials never enter notification content or URLs.

The actual isolated PostgreSQL/HTTP fixture proves:
- Concurrent acceptance creates one membership, audit and notification.
- Reinvitations preserve existing roles rather than escalating them.
- A forced failure after acceptance rolls back membership, status, audit and notification; retry succeeds.
- Concurrent resends use one pending row and invalidate the older credential.
- A valid competing company-join invitation cannot transfer an existing user or create foreign project membership.
- Existing expiry, revocation, wrong-recipient, revoked-inviter, inactive-member, founder and registration checks remain passing.

API typecheck passes. This suite is now an explicit step in the clean-head release gate; full final-candidate gate/push remains required. Fixture uses disposable loopback database schema and never production. No email provider success is implied by an in-app notice.

I010 remains: sender configuration, real email/UI acceptance, exact company-reference correction and multi-role live smoke. No Lens Next Native or installer changes.
