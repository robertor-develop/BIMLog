# Launch Readiness Block 2 — LR006–LR010

## Outcome

The three public legal documents now show one complete-only, runtime-configured supplier identity. The public response contains only the supplier display name, public support email, and invoice jurisdiction. Protected supplier registration, tax identity, billing contact, registered address, configuration keys, provider credentials, and launch-verification evidence are never returned by this endpoint.

## Builds

- LR006 derives a complete-only public projection from the protected supplier profile.
- LR007 exposes the safe projection through a no-store, nosniff public endpoint.
- LR008 strictly validates the public response and rejects unknown or partial shapes.
- LR009 uses one bilingual, accessible identity component across Terms, Privacy, and Legal Notice.
- LR010 binds the complete path to the permanent pre-push gate and ten-build publication boundary.

## Acceptance

Focused behavior, API and frontend typechecks, the complete pre-push gate, exact source publication, and authenticated Chrome production smoke are required. Production acceptance must verify all three legal routes and confirm that no protected supplier field appears in the browser response.
