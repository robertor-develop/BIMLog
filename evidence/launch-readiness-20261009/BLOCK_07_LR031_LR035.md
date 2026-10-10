# Launch Readiness Block 7 — canonical billing identity

Date: 2026-10-10

This five-build block closes the customer-visible billing-identity gap without changing payment-provider, entitlement, tenant, or checkout authority.

1. **LR031** defines one strict canonical billing-identity contract from the authenticated company legal name, address, and phone.
2. **LR032** exposes tenant-scoped GET/PATCH routes only to the existing billing-manager authority.
3. **LR033** adds a strict browser client that rejects inconsistent or cross-company responses.
4. **LR034** connects Billing & Support to a bilingual canonical identity editor with an explicit return path.
5. **LR035** makes the update and privacy-safe audit evidence atomic and binds the complete journey to the permanent pre-push gate.

The audit log records only the changed field names and resulting completeness status. It does not copy the billing address or phone into audit details.

This is the first five-build half of the LR031–LR040 publication interval. After the complete gate passes, the block is pushed once and remains unpublished until LR036–LR040 are complete.
