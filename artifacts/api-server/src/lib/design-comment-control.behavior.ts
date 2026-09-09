import assert from "node:assert/strict";
import { reconcileDesignComment } from "./design-comment-control";

const comment = { id: "comment-1", projectId: 7, companyId: 3, source: { provider: "procore", recordId: "observation-1", revision: 1, snapshotSha256: "a".repeat(64) }, target: { coordinationFileId: "file-1", revisionId: "revision-2", locationRef: "level-02" }, author: { kind: "contact", id: "contact-30" }, text: "Clearance must be coordinated.", disposition: "open", createdAt: "2026-09-09T14:00:00Z" } as const;
assert.equal(reconcileDesignComment(comment, null).result, "created");
assert.equal(reconcileDesignComment(comment, comment).result, "idempotent");
assert.throws(() => reconcileDesignComment({ ...comment, text: "Changed without a new revision" }, comment));
assert.throws(() => reconcileDesignComment({ ...comment, projectId: 8 }, comment));
console.log("design comment control behavior: PASS");
