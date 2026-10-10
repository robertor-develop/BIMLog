# Launch Readiness Block 2 — LR006–LR010

## Outcome

The three public legal documents now show one safe public supplier identity. The endpoint defaults to the supplier name, public contact, and Florida jurisdiction already published across the legal pages, while validated public runtime values can replace those fields independently. Protected supplier registration, tax identity, billing contact, registered address, configuration keys, provider credentials, and launch-verification evidence are never returned by this endpoint.

## Builds

- LR006 derives a safe public projection with stable published defaults and bounded runtime overrides.
- LR007 exposes the safe projection through a no-store, nosniff public endpoint.
- LR008 strictly validates the public response and rejects unknown or partial shapes.
- LR009 uses one bilingual, accessible identity component across Terms, Privacy, and Legal Notice.
- LR010 binds the complete path to the permanent pre-push gate and ten-build publication boundary.

## Acceptance

Focused behavior, API and frontend typechecks, the complete pre-push gate, exact source publication, and authenticated Chrome production smoke are required. Production acceptance must verify all three legal routes, confirm that the public identity is available without protected-profile completion, and confirm that no protected supplier field appears in the browser response.
