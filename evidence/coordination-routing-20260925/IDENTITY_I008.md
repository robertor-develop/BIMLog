# Identity invitation checkpoint I006–I008

Baseline: c49ea8a5880227b10c8223787d4cbe9e88cf9e3d (pushed, not published).

I006: 9ca6ce63 adds hashed expiring credentials and purpose to the existing invitation authority.
I007: 73ef50f2 connects issuance, rotation, fresh inviter authority and email delivery status.
I008 connects registration and authenticated acceptance, preserves fragments across sign-in and distinguishes joining from genuine company creation. External collaboration never transfers company identity. Registration no longer accepts every pending invitation merely from a typed email. Legacy links require reissue.

Actual isolated PostgreSQL and real HTTP registration tests: PASS. Cases include pending link required, company joining without duplication, repeated registration refusal, new-founder scoped PMO, normalized-name collision, wrong account, rotated/expired/revoked links, revoked inviter authority, inactive membership, concurrent replay, single membership/audit and external company preservation. `artifacts/api-server/scripts/test-invitation-lifecycle.ts` uses disposable unique schemas in the existing F-rooted loopback test database and cleans them afterward. No production data is used.

API/frontend typechecks: PASS before final metadata reconciliation; exact release gate remains required. Source contract test updated to require token possession and revocation rather than obsolete automatic joining text.

Local actual-component Chrome: registration displays the fixed destination company and explicit no-duplicate guidance; Spanish sign-in corrected; registration/login retain the invitation fragment. Screenshot capture recovered and the desktop Spanish valid/error states were visually inspected. A same-tab replacement link exposed stale company/credential state; the hashchange reset and cancellation fix passed the exact valid-to-invalid-to-valid-to-invalid retest, clearing the old company and disabling invalid acceptance. Console warning/error list empty. Responsive and production QA remain unverified. Synthetic UI harness is external under F:/BIMLog/TestProof/invitation-ui-harness.tsx and is not production evidence.

Read-only Replit preflight found no configured SENDGRID_API_KEY. Production email history contains four skipped sends for that exact reason in the last fourteen days. Approved sender configuration is required for actual email delivery acceptance; no secret was read, replaced or inferred. The release suite passed through typechecks but failed its document-hash check after OPEN_LOOP changed during the run; reconcile metadata and repeat against the final clean commit, without waiving the check.

Ten unpublished changes are reached at I008, including two preserved consolidation commits. Do not start I009 before publishing this verified checkpoint. Exact-head release, push, schema correspondence and publication have not yet occurred for I006–I008. Native Lens Next and installers are unchanged.

Remaining I009–I010: visible resend/reissue recovery, remaining integration and security acceptance, verified production company/binding correction, actual email receipt, authenticated multi-role production smoke. Production sender configuration and customer account success are not established by local tests.
