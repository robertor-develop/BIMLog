import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileCustodyState, fileDownloadFailure } from "../artifacts/api-server/src/lib/file-custody.ts";

const hash = "a".repeat(64);
assert.equal(fileCustodyState({ storagePath: "synthetic/fixture.pdf", fileHash: hash, fileSizeBytes: 123, source: "upload" }), "portable");
assert.equal(fileCustodyState({ storagePath: null, fileHash: null, fileSizeBytes: null, source: "system-generated" }), "generated_on_demand");
assert.equal(fileCustodyState({ storagePath: null, fileHash: null, fileSizeBytes: null, source: "legacy" }), "legacy_binary_missing");
assert.equal(fileCustodyState({ storagePath: "synthetic/fixture.pdf", fileHash: null, fileSizeBytes: 123, source: "upload" }), "custody_incomplete");
assert.equal(fileDownloadFailure("legacy_binary_missing").body.code, "FILE_BINARY_NOT_RETAINED");
assert.equal(fileDownloadFailure("custody_incomplete").body.code, "FILE_CUSTODY_INCOMPLETE");

const routes = readFileSync("artifacts/api-server/src/routes/files.ts", "utf8");
assert.match(routes, /router\.get\("\/projects\/:projectId\/files", authMiddleware, requireProjectMember\(\)/);
assert.match(routes, /router\.get\("\/projects\/:projectId\/files\/custody-summary", authMiddleware, requireProjectMember\(\)/);
assert.match(routes, /router\.get\("\/projects\/:projectId\/files\/:fileId\/download", authMiddleware, requireProjectMember\(\)/);
assert.match(routes, /router\.patch\("\/projects\/:projectId\/files\/:fileId", authMiddleware, requirePermission\("admin", "write"\)/);
assert.match(routes, /router\.delete\("\/projects\/:projectId\/files\/:fileId", authMiddleware, requirePermission\("admin", "write"\)/);
assert.match(routes, /filePath = await storage\.upload/);
assert.match(routes, /await storage\.delete\(filePath\)/);
assert.match(routes, /FILE_BINARY_NOT_RETAINED|fileDownloadFailure/);

const receipt = JSON.parse(readFileSync("evidence/ga-final-20261015/BLOCK02_GAUNTLET_ACCEPTANCE.json", "utf8"));
assert.equal(receipt.productionDataMutations, 0);
assert.equal(receipt.protectedProjectsChanged, false);
assert.equal(receipt.publicationCadence.combinedUnpublishedBuilds, 10);
console.log("GA-F02-B010 synthetic file lifecycle and Block 2 acceptance: PASS");
