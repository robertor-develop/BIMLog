# Launch Readiness Block 8 — billing identity to subscription setup

Date: 2026-10-10

This five-build block closes the server-side gap between the canonical company billing identity and subscription preparation.

1. **LR036** requires the authenticated company's complete canonical billing identity before subscription setup.
2. **LR037** binds the verified legal name, billing address, phone, and billing-administrator email to the Stripe customer request.
3. **LR038** returns a precise `BILLING_IDENTITY_INCOMPLETE` conflict instead of a generic provider failure.
4. **LR039** rejects control characters, invalid phone syntax, and out-of-bounds billing fields before any provider call.
5. **LR040** binds the complete path to permanent focused acceptance and the ten-build release gate.

No payment is taken and no entitlement is granted automatically. The billing administrator must still explicitly prepare the subscription and explicitly start checkout. Provider credentials and provider customer references remain server-side.

Together with LR031–LR035, this reaches the LR031–LR040 publication boundary.
