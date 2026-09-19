# Build 070 — Lens Next sole-product acceptance

- Customer-facing Platform source no longer says “Original Lens” or “Legacy Lens.” Historical recovery and My View guidance use neutral, truthful migration language inside Lens Next.
- The only standalone Lens product route is `/lens-next`, its accessible route name is Lens Next, and the product contract permits exactly one supported Lens product.
- The retired localhost endpoint remains unreachable from current authenticated Lens Next behavior; migration-only server/Native compatibility remains inventoried for controlled retirement in Builds 071–075.
- Builds 066–070 change Platform behavior only. The shared release identity advances to `v1.05.N18-P35`; generated Native assembly/manifests align the Platform counter without changing Native behavior. Focused dual-year package/contract smoke is therefore required before push, and authenticated production Lens Next smoke is required after publication.
- The executable current-state contract now binds Block 14/P35 rather than the prior Block 13/P34 candidate while retaining the accepted P34 production receipt until P35 is live-verified.
- The first focused package run correctly failed closed on stale P34 field-checklist and installer guards. Every shipped package text/guard is aligned to P35 before the repeated dual-year package-only smoke; historical P34 ZIP/hash receipts remain immutable evidence.
- Repeated package-only smoke passes: core `132/132`; Native 2021 `57/57`; Native 2025 `57/57`; installer package integrity PASS; no installation. The 2021 ZIP SHA-256 is `C33FB0BCF38B6EA7CD1E09BC13C15F8925055BAE9EAED19A3C5C7024D2B733DC`; the 2025 ZIP SHA-256 is `7BDC82CF80B63E9EC714FBD64BC60F42F26BFDABF04817EB68D47EE203EEFA8F`.
