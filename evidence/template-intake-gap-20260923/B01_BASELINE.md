# Build 01 — exact baseline and rejected field package

Date: 2026-09-23. Scope: read-only source, deployed UI and supplied test material. No customer data was changed.

## Identity

- Isolated source worktree started clean at `49e0c9013028fd007ef81ae27603e33c52ca224e`, equal to fetched GitHub `origin/master` before this audit block.
- Authenticated `https://bimlog.app/company-workflows`, `.../company-workflow-governance`, and `.../projects/53/intake` displayed `v1.05.N18-P36` under Roberto Rodriguez's RRY Asociados session. This is **not** Lorena's or Rubén's BIMTECH account.
- Current production-health API could not be freshly read from this environment: PowerShell network access was denied and the Chrome direct endpoint was blocked by the client. Prior release evidence is not substituted for a current health receipt.
- No Native/installer source is in scope; Lens Next remains paused after its already-published Build 10 hotfix. Its remaining Builds 11–25 are not completed by this audit.

## Field-package finding

- `C:/Users/soporte/Downloads/BIMLog_Job_Intake_Guia_Actualizada_2026-09-18.pdf` is 15 landscape pages. Its walkthrough starts with catalogs, then Intake/contracts/APU/budget/EDT/operations. It does not instruct a user to create, save, independently approve, publish, activate, version or supersede a company Delivery Workflow or Workflow Governance Policy.
- The PDF says a reusable workflow is selected if valid, but does not demonstrate that a company template exists or is selectable. The accompanying L04 screenshot tells Lorena to select a canonical client "en L02" while checking floors; the client belongs to project/contract authority, not to a floor.
- The guide and smoke result are rejected as acceptance evidence. Rubén and Lorena's 2026-09-23 field feedback is a product/test-package finding, not user error.

## Evidence boundary

The live pages prove discoverability and visible state under Roberto's RRY session only. They do not prove BIMTECH template content, Lorena's PMO permissions, a separate Finance checker, or the complete new-project path. This build does not create synthetic records or make a publication claim.
