import { createHash } from "node:crypto";
import type { StorageAdapter } from "./storage-adapter";

const MAX_PUBLISH_BYTES = 10 * 1024 * 1024;
export type PublishSource = {
  id: number; projectId: number; name: string; storageKey: string;
  sha256: string; byteSize: number; status: string;
};

/** The existing Files store is the sole custody authority for a publish request. */
export async function readVerifiedPublishSource(source: PublishSource, storage: StorageAdapter): Promise<Buffer> {
  if (!Number.isSafeInteger(source.id) || source.id <= 0 ||
      !Number.isSafeInteger(source.projectId) || source.projectId <= 0 ||
      !Number.isSafeInteger(source.byteSize) || source.byteSize <= 0 || source.byteSize > MAX_PUBLISH_BYTES ||
      !/^[a-f0-9]{64}$/.test(source.sha256) || !source.storageKey ||
      source.status !== "active" || !source.name || source.name !== source.name.trim() ||
      /[<>:"/\\|?*\x00-\x1f]/.test(source.name) || /[. ]$/.test(source.name)) {
    throw new Error("FOLDER_WIZARD_SOURCE_INVALID");
  }
  const health = await storage.health();
  if (health.backendType === "local-test" || !health.capabilities.includes("bounded-read") ||
      health.maxReadBytes < source.byteSize) throw new Error("FOLDER_WIZARD_SOURCE_CUSTODY_UNAVAILABLE");
  const bytes = await storage.downloadBounded(source.storageKey, source.byteSize);
  if (bytes.byteLength !== source.byteSize || createHash("sha256").update(bytes).digest("hex") !== source.sha256)
    throw new Error("FOLDER_WIZARD_SOURCE_CHANGED");
  return bytes;
}
