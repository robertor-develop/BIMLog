# Build 067 — Legacy Lens reference inventory

- `contracts/lens-product-reference-inventory.json` separates the sole supported Lens Next runtime from migration compatibility, governance-only references, test fixtures, and historical evidence.
- The mechanical test scans tracked production source and fails when an Original/Legacy Lens, `lens-sync`, or retired bundle reference appears outside the declared inventory.
- The existing `lens-sync` route and Native historical comments are migration compatibility, not a second customer product. Physical Native/installer retirement remains explicitly assigned to Builds 071–075.
- Customer navigation, customer branding, parallel installation, and a legacy loader remain prohibited.
