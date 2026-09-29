# UX011-UX015 validation

Five builds were implemented sequentially: UX011 project directory eligibility (76c48253), UX012 shared creation (3800dd8f), UX013 safe company-only entries (04740eab), UX014 governed discipline states (1f70d6d6), UX015 account identity (e06c8c68). Subsequent acceptance corrections retain RFI member recipients, contact selection, manual Transmittal phone/email and bilingual responsive layout.

Local behavior tests cover company identities, historical selections, placeholder boundaries and company-profile projection. The real Express/API integration test uses an isolated retained schema on local PostgreSQL only: repeated company/contact creation reuses IDs, unrelated users are denied, placeholder invitations fail before sending, and branding changes preserve current company binding and existing directory names. No production data or provider delivery is involved.

Chrome exercised the actual shared picker, Transmittals, Change Orders, discipline selector and Company Profile with synthetic transport on localhost. Company and contact creation returned selected results, and the same company appeared across document forms. Error/loading/empty states remained distinct; failed creation retained its draft; denied creation controls were absent. English and Spanish were checked, including inspected 390px Spanish picker and profile screenshots without horizontal overflow. These are local component checks, not authenticated production smoke or full provider acceptance.

Evidence: F:/BIMLog/Evidence/ux-audit-20260928/UX-B03-*.png and matching text snapshots. Permanent regression command: test:ux-block03. The exact final source release-gate receipt and push outcome are recorded externally after completion.

Publication cadence: UX001-UX010 are live; this push adds five unpublished builds. Publish after UX020 and run full authenticated Chrome smoke then. Broader Intake/APU/staffing/contract requirements remain in the program. No Replit Agents were used.
