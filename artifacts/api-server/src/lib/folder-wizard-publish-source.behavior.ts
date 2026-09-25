import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readVerifiedPublishSource } from "./folder-wizard-publish-source";
import type { StorageAdapter } from "./storage-adapter";

const bytes = Buffer.from("synthetic SharePoint proof");
const source = { id: 9, projectId: 5, name: "proof.txt", storageKey: "opaque", byteSize: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"), status: "active" };
const storage = { health: async () => ({ backendType: "durable-filesystem", capabilities: ["bounded-read"], maxReadBytes: 10_485_760 }),
  downloadBounded: async () => bytes } as unknown as StorageAdapter;
assert.deepEqual(await readVerifiedPublishSource(source, storage), bytes);
await assert.rejects(readVerifiedPublishSource({ ...source, sha256: "0".repeat(64) }, storage), /SOURCE_CHANGED/);
await assert.rejects(readVerifiedPublishSource({ ...source, name: "../bad" }, storage), /SOURCE_INVALID/);
await assert.rejects(readVerifiedPublishSource({ ...source, projectId: 0 }, storage), /SOURCE_INVALID/);
await assert.rejects(readVerifiedPublishSource({ ...source, byteSize: 10_485_761 }, storage), /SOURCE_INVALID/);
await assert.rejects(readVerifiedPublishSource(source, { ...storage, health: async () => ({ backendType: "local-test" }) } as StorageAdapter), /CUSTODY_UNAVAILABLE/);
console.log("Folder Wizard source custody contract: PASS");
