# Build 072 — Deterministic dual-year Native packaging

- Native source is staged immutably beneath the matching canonical `H:\BIMLogPlugin2021` or `H:\BIMLogPlugin2025` root using a complete source-content digest.
- Build, intermediate, validation, package, receipt, and ZIP output stay beneath that matching H-drive stage.
- Each year is rebuilt twice at the same source digest; a differing ZIP SHA-256 fails the block.
- Existing stage content may be reused only when every source and release-identity hash is unchanged. Historical stages are preserved.
- Package-only installer verification remains mandatory; this build performs no Autodesk installation.

Accepted proof:

- Source digest: `7482cbc6382f4f3385e0a2b80ed451f6a1b5a806a9d32f580c222d14f780decd`
- Navisworks 2021 ZIP SHA-256: `BCCDEADF45D7AA820D1877322500F44AC4473718BEF276A7D93639AB8201A9D3`
- Navisworks 2025 ZIP SHA-256: `CB61DED3EBEE3233C5AB827F33522122A8465F32D83FD71CED84A78B9A4AE979`
- Both repeated builds returned identical hashes and package-only installer PASS.
