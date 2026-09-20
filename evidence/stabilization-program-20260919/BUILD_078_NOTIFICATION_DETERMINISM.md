# Build 078 - Notification decision determinism

Notification Center release acceptance now fails if global/channel/module preferences, quiet hours, daily/weekly digest identity, unread ownership, authorization revocation, channel revocation, provider acknowledgement, or optimistic UI rollback disappears. Delivery decisions remain idempotent and auditable, and membership/channel authority is rechecked before immediate or digest delivery.
