# Build 080 - Feedback and notification acceptance

The Block 16 acceptance gate binds customer capture and history, canonical reviewer routing, assignment and optimistic concurrency, durable recovery evidence, deterministic notification preferences and unread state, protected email/Telegram delivery contracts, and customer reopen/closure continuity into one production-safe release check.

The acceptance is non-delivery: it verifies governed provider identity, consent, idempotency, acknowledgement and safe-failure contracts without sending an email, Telegram message or document. Platform release identity advances to `v1.05.N18-P36`; Native remains `N18` because Builds 076-080 do not change Lens Next native binaries or installers.

The shared release contract required package-metadata reconciliation and deterministic package-only rebuilds. Both repeated builds matched and performed no Autodesk installation:

- Navisworks 2021 ZIP SHA-256: `CD0C8A2C63711E4C89EA82B53FA781ED558ED398C724458780E3422895AE6E84`
- Navisworks 2025 ZIP SHA-256: `30F78C364603138587E1F6C809B564D3C0A8B58F8DBF91D6E6698BD05BFB3608`
