import fs from "node:fs";
import { constants as bufferConstants } from "node:buffer";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const PROVEN = ["exact-bytes", "atomic-create", "shared-root", "restart-persistence", "sha256-verification", "bounded-read"] as const;
type Capability = typeof PROVEN[number];
export type StorageHealth = { backendId: string; backendType: "durable-filesystem" | "local-test"; healthy: true; capabilities: readonly Capability[]; maxReadBytes: number; backupContract: { required: true; format: "opaque-key-v1"; integrity: "sha256"; restoreVerification: "exact-bytes-and-sha256" } };
export interface StorageAdapter { upload(bytes: Buffer, projectId: number | string, filename: string): Promise<string>; download(key: string): Promise<Buffer>; downloadBounded(key: string, maxBytes: number): Promise<Buffer>; delete(key: string, options?: { retentionHold?: boolean }): Promise<void>; health(): Promise<StorageHealth>; }
const KEY = /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/;
const MAX_BOUNDED_DOWNLOAD_BYTES = Math.min(bufferConstants.MAX_LENGTH, 0x7fffffff);
type Options = { backendId?: string; backendType?: StorageHealth["backendType"]; capabilities?: readonly Capability[]; maxReadBytes?: number; faultAt?: "write" | "fsync" };

function assertNoLinks(target: string) {
  const absolute = path.resolve(target), parsed = path.parse(absolute); let cursor = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment); if (!fs.existsSync(cursor)) break;
    const stat = fs.lstatSync(cursor); if (stat.isSymbolicLink() || (stat.mode & 0o170000) === 0o120000) throw storageError("STORAGE_REPARSE_COMPONENT_DENIED");
  }
}
function strictChild(parent: string, child: string) { const prefix = `${path.resolve(parent)}${path.sep}`; const resolved = path.resolve(child); if (!resolved.startsWith(prefix)) throw new Error("STORAGE_PATH_ESCAPE"); return resolved; }
function ensureDirectory(target: string) { try { fs.mkdirSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; } const stat = fs.lstatSync(target); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("STORAGE_REPARSE_COMPONENT_DENIED"); }
function storageError(code: string) { return Object.assign(new Error(code), { code }); }
function sameObject(left: fs.BigIntStats, right: fs.BigIntStats) { return left.dev === right.dev && left.ino === right.ino; }

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string; private readonly backendId: string; private readonly backendType: StorageHealth["backendType"]; private readonly capabilities: readonly Capability[]; private readonly maxReadBytes: number; private readonly faultAt?: Options["faultAt"];
  constructor(root: string, options: Options = {}) {
    if (!path.isAbsolute(root)) throw new Error("STORAGE_ROOT_MUST_BE_ABSOLUTE");
    this.root = path.resolve(root); this.backendId = options.backendId ?? "local-test"; this.backendType = options.backendType ?? "local-test"; this.capabilities = Object.freeze([...(options.capabilities ?? PROVEN)]); this.maxReadBytes = options.maxReadBytes ?? MAX_BOUNDED_DOWNLOAD_BYTES; this.faultAt = options.faultAt;
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(this.backendId) || this.capabilities.some(value => !PROVEN.includes(value)) || new Set(this.capabilities).size !== this.capabilities.length || (this.backendType === "durable-filesystem" && !this.capabilities.includes("bounded-read")) || !Number.isSafeInteger(this.maxReadBytes) || this.maxReadBytes <= 0 || this.maxReadBytes > MAX_BOUNDED_DOWNLOAD_BYTES) throw new Error("STORAGE_BINDING_INVALID");
    assertNoLinks(this.root); fs.mkdirSync(this.root, { recursive: true }); this.assertSafe(this.root);
  }
  private assertSafe(target: string) { strictChild(path.dirname(this.root), this.root); assertNoLinks(this.root); assertNoLinks(target); const stat = fs.lstatSync(this.root); if (!stat.isDirectory()) throw new Error("STORAGE_ROOT_UNSAFE"); }
  private resolveKey(key: string) { if (!KEY.test(key)) throw new Error("STORAGE_KEY_INVALID"); const result = strictChild(this.root, path.join(this.root, ...key.split("/"))); this.assertSafe(path.dirname(result)); return result; }
  async upload(bytes: Buffer, _projectId: number | string, _filename: string) {
    const digest = createHash("sha256").update(bytes).digest("hex"), id = createHash("sha256").update(`${randomUUID()}\n${digest}`).digest("hex"), key = `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`;
    const destination = this.resolveKey(key); const first = path.dirname(path.dirname(destination)), second = path.dirname(destination);
    this.assertSafe(first); ensureDirectory(first); this.assertSafe(first); ensureDirectory(second); this.assertSafe(second);
    const temporary = `${destination}.${randomUUID()}.pending`; let handle: number | undefined;
    try {
      handle = fs.openSync(temporary, "wx", 0o600); if (this.faultAt === "write") throw new Error("STORAGE_FORCED_WRITE_FAILURE"); fs.writeFileSync(handle, bytes); if (this.faultAt === "fsync") throw new Error("STORAGE_FORCED_FSYNC_FAILURE"); fs.fsyncSync(handle); fs.closeSync(handle); handle = undefined; fs.renameSync(temporary, destination);
    } catch (error) { if (handle !== undefined) try { fs.closeSync(handle); } catch {} try { fs.unlinkSync(temporary); } catch {} try { fs.unlinkSync(destination); } catch {} throw error; }
    return key;
  }
  async download(key: string) { const target = this.resolveKey(key); this.assertSafe(target); return fs.readFileSync(target); }
  async downloadBounded(key: string, maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BOUNDED_DOWNLOAD_BYTES) throw storageError("STORAGE_MAX_BYTES_INVALID");
    if (maxBytes > this.maxReadBytes) throw storageError("STORAGE_MAX_BYTES_EXCEEDS_BACKEND_LIMIT");
    const target = this.resolveKey(key); let descriptor: number | undefined; let result: Buffer | undefined; let failure: unknown;
    try {
      this.assertSafe(target);
      const noFollow = (fs.constants as typeof fs.constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
      descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
      const opened = fs.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile()) throw storageError("STORAGE_OBJECT_UNSAFE");
      if (opened.size < 0n || opened.size > BigInt(maxBytes)) throw storageError("STORAGE_OBJECT_TOO_LARGE");
      this.assertSafe(target);
      const pathAfterOpen = fs.lstatSync(target, { bigint: true });
      if (pathAfterOpen.isSymbolicLink() || !sameObject(opened, pathAfterOpen)) throw storageError("STORAGE_OBJECT_CHANGED");
      const expected = Number(opened.size); result = Buffer.allocUnsafe(expected); let offset = 0;
      while (offset < expected) {
        const count = fs.readSync(descriptor, result, offset, Math.min(64 * 1024, expected - offset), offset);
        if (count <= 0) throw storageError("STORAGE_OBJECT_CHANGED");
        offset += count;
      }
      if (expected === 0) {
        const probe = Buffer.allocUnsafe(1);
        if (fs.readSync(descriptor, probe, 0, 1, 0) !== 0) throw storageError("STORAGE_OBJECT_CHANGED");
      } else {
        const firstByte = result[0];
        const grew = fs.readSync(descriptor, result, 0, 1, expected) !== 0;
        result[0] = firstByte;
        if (grew) throw storageError(expected === maxBytes ? "STORAGE_OBJECT_TOO_LARGE" : "STORAGE_OBJECT_CHANGED");
      }
      const completed = fs.fstatSync(descriptor, { bigint: true });
      this.assertSafe(target);
      const pathAfterRead = fs.lstatSync(target, { bigint: true });
      if (!sameObject(opened, completed) || !sameObject(opened, pathAfterRead) || completed.size !== opened.size || completed.mtimeNs !== opened.mtimeNs || completed.ctimeNs !== opened.ctimeNs) throw storageError("STORAGE_OBJECT_CHANGED");
    } catch (error) { failure = error; }
    finally {
      if (descriptor !== undefined) try { fs.closeSync(descriptor); } catch (error) { if (failure === undefined) failure = error; }
    }
    if (failure !== undefined) {
      const code = (failure as NodeJS.ErrnoException).code;
      if (typeof code === "string" && code.startsWith("STORAGE_")) throw storageError(code);
      throw storageError("STORAGE_OBJECT_READ_FAILED");
    }
    return result!;
  }
  async delete(key: string, options: { retentionHold?: boolean } = {}) { if (options.retentionHold) throw new Error("STORAGE_RETENTION_HOLD_ACTIVE"); const target = this.resolveKey(key); this.assertSafe(target); try { fs.unlinkSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  async health(): Promise<StorageHealth> { this.assertSafe(this.root); const probe = strictChild(this.root, path.join(this.root, `.health-${randomUUID()}`)); let handle: number | undefined; try { handle = fs.openSync(probe, "wx", 0o600); fs.writeFileSync(handle, "bimlog-storage-health-v1"); fs.fsyncSync(handle); fs.closeSync(handle); handle = undefined; } finally { if (handle !== undefined) try { fs.closeSync(handle); } catch {} try { fs.unlinkSync(probe); } catch {} } return { backendId: this.backendId, backendType: this.backendType, healthy: true, capabilities: this.capabilities, maxReadBytes: this.maxReadBytes, backupContract: { required: true, format: "opaque-key-v1", integrity: "sha256", restoreVerification: "exact-bytes-and-sha256" } }; }
}

function forbiddenProductionRoot(root: string) { const value = path.resolve(root).toLowerCase(), cwd = path.resolve(process.cwd()).toLowerCase(), tmp = path.resolve(os.tmpdir()).toLowerCase(); return value === cwd || value.startsWith(`${cwd}${path.sep}`) || value === tmp || value.startsWith(`${tmp}${path.sep}`) || /[\\/](worktrees?|repositories?|artifacts?|build|dist|cache|tmp|temp)([\\/]|$)/i.test(value); }
export function createStorageFromEnvironment(environment: NodeJS.ProcessEnv = process.env): StorageAdapter {
  const production = environment.NODE_ENV === "production", backend = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND ?? (production ? undefined : "local-test"), root = environment.BIMLOG_FEEDBACK_UPLOAD_ROOT ?? (production ? undefined : path.resolve(".tmp", "uploads"));
  if (production && backend !== "durable-filesystem") throw new Error("FEEDBACK_DURABLE_STORAGE_REQUIRED"); if (!root) throw new Error("FEEDBACK_STORAGE_ROOT_REQUIRED");
  if (backend === "durable-filesystem") {
    const backendId = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND_ID, authorityPath = environment.BIMLOG_FEEDBACK_STORAGE_AUTHORITY_MANIFEST, authoritySha256 = environment.BIMLOG_FEEDBACK_STORAGE_AUTHORITY_SHA256; if (!backendId) throw new Error("FEEDBACK_STORAGE_BACKEND_ID_REQUIRED");
    if (production && (forbiddenProductionRoot(root) || !authorityPath || path.resolve(authorityPath) === path.resolve(root) || path.resolve(authorityPath).startsWith(`${path.resolve(root)}${path.sep}`))) throw new Error("FEEDBACK_STORAGE_AUTHORITY_REQUIRED");
    let capabilities: readonly Capability[] = PROVEN, maxReadBytes = MAX_BOUNDED_DOWNLOAD_BYTES;
    if (production) { let manifest: Record<string, unknown>, manifestBytes: Buffer; try { manifestBytes = fs.readFileSync(path.resolve(authorityPath!)); manifest = JSON.parse(manifestBytes.toString("utf8")); } catch { throw new Error("FEEDBACK_STORAGE_AUTHORITY_INVALID"); } const declared = Array.isArray(manifest.capabilities) ? manifest.capabilities : []; const hash = createHash("sha256").update(manifestBytes).digest("hex"), fields = new Set(["schemaVersion", "backendId", "dataRoot", "backupRequired", "capabilities", "maxReadBytes"]); if (!/^[a-f0-9]{64}$/.test(authoritySha256 ?? "") || hash !== authoritySha256 || Object.keys(manifest).length !== fields.size || Object.keys(manifest).some(field => !fields.has(field)) || manifest.schemaVersion !== 1 || manifest.backendId !== backendId || typeof manifest.dataRoot !== "string" || path.resolve(manifest.dataRoot) !== path.resolve(root) || manifest.backupRequired !== true || declared.length === 0 || !declared.includes("bounded-read") || new Set(declared).size !== declared.length || declared.some(value => typeof value !== "string" || !PROVEN.includes(value as Capability)) || !Number.isSafeInteger(manifest.maxReadBytes) || (manifest.maxReadBytes as number) <= 0 || (manifest.maxReadBytes as number) > MAX_BOUNDED_DOWNLOAD_BYTES) throw new Error("FEEDBACK_STORAGE_AUTHORITY_INVALID"); capabilities = declared as Capability[]; maxReadBytes = manifest.maxReadBytes as number; }
    return new LocalDiskStorageAdapter(path.resolve(root), { backendId, backendType: "durable-filesystem", capabilities, maxReadBytes });
  }
  if (production || backend !== "local-test") throw new Error("FEEDBACK_STORAGE_BACKEND_UNAPPROVED"); return new LocalDiskStorageAdapter(path.resolve(root));
}
export const storage: StorageAdapter = createStorageFromEnvironment();
