# Build 070 — Lens Next sole-product acceptance

- Customer-facing Platform source no longer says “Original Lens” or “Legacy Lens.” Historical recovery and My View guidance use neutral, truthful migration language inside Lens Next.
- The only standalone Lens product route is `/lens-next`, its accessible route name is Lens Next, and the product contract permits exactly one supported Lens product.
- The retired localhost endpoint remains unreachable from current authenticated Lens Next behavior; migration-only server/Native compatibility remains inventoried for controlled retirement in Builds 071–075.
- Builds 066–070 change Platform behavior only. The shared release identity advances to `v1.05.N18-P35`; generated Native assembly/manifests align the Platform counter without changing Native behavior. Focused dual-year package/contract smoke is therefore required before push, and authenticated production Lens Next smoke is required after publication.
