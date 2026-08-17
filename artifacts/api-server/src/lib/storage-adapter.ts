import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type StorageHealth = { backendId: string; backendType: "durable-filesystem" | "local-test"; healthy: true; capabilities: readonly string[]; backupContract: { required: true; format: "opaque-key-v1"; integrity: "sha256"; restoreVerification: "exact-bytes-and-sha256" } };
export interface StorageAdapter { upload(bytes: Buffer, projectId: number | string, filename: string): Promise<string>; download(key: string): Promise<Buffer>; delete(key: string, options?: { retentionHold?: boolean }): Promise<void>; health(): Promise<StorageHealth>; }
const KEY = /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/;
const CAPABILITIES = ["exact-bytes", "atomic-create", "shared-root", "restart-persistence", "sha256-verification"] as const;

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly backendId: string;
  private readonly backendType: StorageHealth["backendType"];
  constructor(root: string, options: { backendId?: string; backendType?: StorageHealth["backendType"]; requireManifest?: boolean } = {}) {
    if (!path.isAbsolute(root)) throw new Error("STORAGE_ROOT_MUST_BE_ABSOLUTE");
    this.root = path.resolve(root); this.backendId = options.backendId ?? "local-test"; this.backendType = options.backendType ?? "local-test";
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(this.backendId)) throw new Error("STORAGE_BACKEND_ID_INVALID");
    fs.mkdirSync(this.root, { recursive: true }); this.assertSafeRoot();
    if (options.requireManifest) {
      let manifest: unknown; try { manifest = JSON.parse(fs.readFileSync(path.join(this.root, ".bimlog-feedback-storage.json"), "utf8")); } catch { throw new Error("FEEDBACK_STORAGE_MANIFEST_REQUIRED"); }
      const value = manifest as Record<string, unknown>;
      if (value.schemaVersion !== 1 || value.backendId !== this.backendId || value.backendType !== "durable-filesystem" || value.backupRequired !== true) throw new Error("FEEDBACK_STORAGE_MANIFEST_INVALID");
    }
  }
  private assertSafeRoot() { const stat = fs.lstatSync(this.root); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("STORAGE_ROOT_UNSAFE"); }
  private resolveKey(key: string) { if (!KEY.test(key)) throw new Error("STORAGE_KEY_INVALID"); const result = path.resolve(this.root, ...key.split("/")); if (!result.startsWith(`${this.root}${path.sep}`)) throw new Error("STORAGE_KEY_ESCAPE"); return result; }
  async upload(bytes: Buffer, _projectId: number | string, _filename: string) {
    this.assertSafeRoot(); const digest = createHash("sha256").update(bytes).digest("hex"); const id = createHash("sha256").update(`${randomUUID()}\n${digest}`).digest("hex");
    const key = `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`; const destination = this.resolveKey(key); fs.mkdirSync(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.pending`; const handle = fs.openSync(temporary, "wx", 0o600);
    try { fs.writeFileSync(handle, bytes); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    try { fs.renameSync(temporary, destination); } catch (error) { try { fs.unlinkSync(temporary); } catch {} throw error; }
    return key;
  }
  async download(key: string) { this.assertSafeRoot(); return fs.readFileSync(this.resolveKey(key)); }
  async delete(key: string, options: { retentionHold?: boolean } = {}) { if (options.retentionHold) throw new Error("STORAGE_RETENTION_HOLD_ACTIVE"); try { fs.unlinkSync(this.resolveKey(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  async health(): Promise<StorageHealth> { this.assertSafeRoot(); const probe = path.join(this.root, `.health-${randomUUID()}`); const handle = fs.openSync(probe, "wx", 0o600); try { fs.writeFileSync(handle, "bimlog-storage-health-v1"); fs.fsyncSync(handle); } finally { fs.closeSync(handle); } fs.unlinkSync(probe); return { backendId: this.backendId, backendType: this.backendType, healthy: true, capabilities: CAPABILITIES, backupContract: { required: true, format: "opaque-key-v1", integrity: "sha256", restoreVerification: "exact-bytes-and-sha256" } }; }
}

export function createStorageFromEnvironment(environment: NodeJS.ProcessEnv = process.env): StorageAdapter {
  const production = environment.NODE_ENV === "production", backend = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND ?? (production ? undefined : "local-test"), root = environment.BIMLOG_FEEDBACK_UPLOAD_ROOT ?? (production ? undefined : path.resolve(".tmp", "uploads"));
  if (production && backend !== "durable-filesystem") throw new Error("FEEDBACK_DURABLE_STORAGE_REQUIRED");
  if (!root) throw new Error("FEEDBACK_STORAGE_ROOT_REQUIRED");
  if (backend === "durable-filesystem") { const backendId = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND_ID; if (!backendId) throw new Error("FEEDBACK_STORAGE_BACKEND_ID_REQUIRED"); return new LocalDiskStorageAdapter(path.resolve(root), { backendId, backendType: "durable-filesystem", requireManifest: production }); }
  if (production || backend !== "local-test") throw new Error("FEEDBACK_STORAGE_BACKEND_UNAPPROVED");
  return new LocalDiskStorageAdapter(path.resolve(root));
}
export const storage: StorageAdapter = createStorageFromEnvironment();
