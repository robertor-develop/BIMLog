---
name: Foundational Settings scalar-only save vs UpsertConventionBody.fields
description: Why UpsertConventionBody.fields must stay optional, and how the scalar-only save path is wired
---

# Foundational Settings (scalar-only) convention save

The "Foundational Settings" editor (EditFoundationScreen, inside ConventionBuilder.tsx)
PUTs to the SAME endpoint as the full wizard: `PUT /api/v1/projects/:id/conventions`.
But it sends a SCALAR-ONLY body (separator, isActive, enforceUppercase, applyCharLimits,
companyCode, userGuidance) with NO `fields` key — intentionally, so it can never wipe the
saved naming dictionaries (Level/Sequence/Status/Revision/etc.).

## Rule
`UpsertConventionBody.fields` MUST be `.optional()` — in BOTH `lib/api-spec/openapi.yaml`
(remove `fields` from the schema's `required:` list) and the orval-generated
`lib/api-zod/src/generated/api.ts`. If `fields` is required, the scalar-only save is
rejected at zod validation with HTTP 400 ("fields Required") and Foundational Settings
cannot save for anyone, on any project.

**Why:** the editor was made scalar-only (data-integrity fix) but the zod schema still
required `fields`, so every Foundational save silently 400'd. The data was protected only
because the request never reached the handler.

**How to apply:** any regen of api-zod from openapi.yaml will revert this unless the spec
is also fixed. Keep spec + generated file in sync. `@workspace/api-zod` exports
`src/index.ts` directly, so api-server (tsx) and bimlog (vite) read source — edits hot
reload, no build needed, but restart api-server to be certain.

## The backend guard (Decision 2)
In `conventions.ts` the signal is `hasFields = Array.isArray(body.fields) && body.fields.length > 0`.
`undefined` and `[]` both yield `hasFields=false`, which skips delete+rebuild of
naming_fields AND skips verifyCompletionPayload — i.e. a no-op for the dictionaries. Only a
non-empty fields array triggers the delete/rebuild (and integrity validation on a completed
convention). Treat undefined == [] == "leave naming_fields untouched".
