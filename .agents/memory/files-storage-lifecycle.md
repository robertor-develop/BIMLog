---
name: api-server files storage lifecycle
description: How uploaded file bytes flow through disk in api-server files.ts; what is and isn't persisted; the storage-adapter seam.
---

# api-server Files storage lifecycle

The Files feature does NOT keep uploaded bytes as durable content. Disk is used
only transiently during the POST upload request: write -> read for SHA-256 ->
read for pdf-parse text extraction (`processFileFromDisk`) -> conditional delete.

- The on-disk path is **never persisted** to the DB (no storage_path column). The
  file row stores metadata + `fileHash` + `extractedText` only.
- The download ROUTE (`GET .../:fileId/download`) only generates a PDF on the fly
  for `source === "system-generated"` RFI response docs; for user-uploaded files it
  returns 501. So nothing reads user bytes back off disk after upload completes.
- Final disk state per branch: missing-file -> nothing; missing document_relationship
  -> written then deleted; duplicate -> written then deleted; invalid-name (rejected)
  -> kept on disk; success -> kept on disk.

**Storage seam:** all disk I/O goes through `lib/storage-adapter.ts`
(`StorageAdapter` interface + `LocalDiskStorageAdapter`, exported `storage`).
Adapter owns the path/naming: `uploads/projects/<projectId>/files/<Date.now()>-<Math.random().toString(36).slice(2,10)><ext>`,
ext from `path.extname(originalname)`. A future OneDrive impl must satisfy the same
buffer-based interface.

**Why these constraints matter:**
- multer uses `memoryStorage` (buffer-based) because the adapter interface is
  buffer-in; switching back to diskStorage would break the OneDrive seam. Tradeoff:
  ingress buffers the whole file in RAM. No upload size limit is configured (matches
  original) — large BIM files (nwd/rvt) ride in memory.
- Hash is computed from `req.file.buffer`, not a disk re-read.
- `storage.upload` write failures must map to 500, not the handler's generic 400.
