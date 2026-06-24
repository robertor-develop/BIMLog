---
name: RFI-from-viewpoint create atomicity
description: How the from-viewpoint (and any multi-side-effect RFI create) flow avoids orphan rows/files
---

Multi-side-effect create flows (RFI row + filesTable row + on-disk upload) must be ordered so a failure never leaves an orphan:

1. Validate ALL inputs (including decoding/zero-byte-checking the image) BEFORE any persistence. Return 400 for validation failures.
2. `storage.upload` returns the storagePath; the on-disk file is the only non-transactional side effect.
3. Wrap the RFI insert + activity-log insert + filesTable insert in a single `db.transaction(async (tx) => ...)`.
4. `createRfiForProject(projectId, input, user, dbx=db)` takes an optional executor typed `Pick<typeof db, "insert">`; pass `tx` to run its inserts inside the transaction. Default `db` keeps the normal create route non-transactional (unchanged behavior).
5. On transaction rollback OR helper returning `!ok` (422/409), call `storage.delete(storagePath)` to compensate the uploaded disk file.

**Why:** code review (architect) flagged that creating the RFI first, then uploading/inserting the file, leaves an orphan RFI when image handling fails (esp. zero-byte → 400 after the RFI already exists).

**Status mapping:** validation = 400; storage/DB/unexpected failures inside the side-effect block = 500. Do NOT blanket-return 400 from the outer catch for server errors.
