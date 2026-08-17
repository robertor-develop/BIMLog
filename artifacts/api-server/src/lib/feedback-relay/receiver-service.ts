import fs from "node:fs";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  RelayProtocolError,
  canonicalRequest,
  canonicalReceipt,
  sha256,
  signReadback,
  signDeletionReceipt,
  signReceipt,
  verifyRequest,
  type NonceAuthority,
  type ReadbackContract,
  type DeletionReceiptContract,
  type ReceiptContract,
  type RelayKeyRing,
  type RequestContract,
  type Signed,
} from "./protocol.js";

export type ReceiverRootAuthority = {
  canonicalRoot: string;
  rootFingerprintSha256: string;
  destinationId: string;
};
export type ReceiverMediaKind =
  | "screenshot"
  | "audio"
  | "document"
  | "transcript"
  | "original";
export type ScannerInspection = {
  verdict: "clean";
  scannerAdapter: string;
  inspectedAt: string;
  inspectedMediaType: string;
  mediaKind: ReceiverMediaKind;
  byteCount: number;
  sha256: string;
};
export type StoredDelivery = {
  requestHash: string;
  requestSignature: string;
  objectRelativePath: string;
  inspection: ScannerInspection;
  receipt: Signed<ReceiptContract>;
  directoryDurability: "fsync" | "rename-recovery";
};
export type PurgeAuthority = {
  policySha256: string;
  approvedBy: string;
  approvedAt: string;
  hold: boolean;
};
export type DeletionReceipt = {
  deletedAt: string;
  objectSha256: string;
  byteCount: number;
  policySha256: string;
  approvedBy: string;
  absenceVerified: true;
  absenceVerifiedAt:string;
  journalSha256:string;
  signed: Signed<DeletionReceiptContract>;
};
type PreparedDeletion = Omit<DeletionReceipt, "absenceVerified"|"absenceVerifiedAt"|"signed"> & {
  absenceVerified: false;
  requestId:string;companyId:string;projectId:string;feedbackId:string;objectId:string;destinationId:string;approvedAt:string;
};
type DeletionJournal =
  | {
      state: "prepared";
      requestId: string;
      objectRelativePath: string;
      receipt: PreparedDeletion;
    }
  | {
      state: "finalized";
      requestId: string;
      objectRelativePath: string;
      receipt: DeletionReceipt;
    };
export type BackupInventory = {
  createdAt: string;
  sourceRootFingerprintSha256: string;
  objects: readonly {
    relativePath: string;
    byteCount: number;
    sha256: string;
  }[];
  inventorySha256: string;
};
export type NonceReservation = {
  token: string;
  status: "new" | "identical-retry";
};
export interface ReceiverNonceAuthority {
  reserve(input: {
    audience: string;
    keyId: string;
    nonce: string;
    timestamp: string;
    requestId: string;
    companyId: string;
    projectId: string;
    requestSha256: string;
  }): Promise<NonceReservation | null>;
  commit(token: string): Promise<void>;
  rollback(token: string): Promise<void>;
}
type DurableNonceRecord={binding:{audience:string;keyId:string;nonce:string;timestamp:string;requestId:string;companyId:string;projectId:string;requestSha256:string};state:"reserved"|"committed";token:string};
export class FilesystemReceiverNonceAuthority implements ReceiverNonceAuthority{
  private readonly root:string;
  constructor(root:string){this.root=canonicalRoot(root);if(!fs.existsSync(this.root)||!fs.statSync(this.root).isDirectory())fail("FEEDBACK_RECEIVER_NONCE_ROOT_REQUIRED","Nonce authority root must already exist");assertTreeNoLinks(this.root);}
  private key(input:DurableNonceRecord["binding"]){return sha256(JSON.stringify([input.audience,input.keyId,input.nonce,input.companyId,input.projectId]));}
  async reserve(input:DurableNonceRecord["binding"]){const key=this.key(input),file=path.join(this.root,`${key}.json`),lock=path.join(this.root,`${key}.lock`);assertNoLinks(this.root,file);try{fs.mkdirSync(lock);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")return null;throw error;}try{if(fs.existsSync(file)){const known=readJson<DurableNonceRecord>(this.root,file);if(known.binding.requestSha256!==input.requestSha256||known.binding.requestId!==input.requestId)return null;if(known.state==="committed")return{token:known.token,status:"identical-retry" as const};return{token:known.token,status:"new" as const};}const record:DurableNonceRecord={binding:input,state:"reserved",token:`${key}.${randomUUID()}`};atomicJson(this.root,file,record);return{token:record.token,status:"new" as const};}finally{fs.rmdirSync(lock);}}
  async commit(token:string){const key=token.split(".")[0];if(!HEX64.test(key))fail("FEEDBACK_RECEIVER_NONCE_TOKEN_INVALID","Nonce token is invalid");const file=path.join(this.root,`${key}.json`),record=readJson<DurableNonceRecord>(this.root,file);if(record.token!==token)fail("FEEDBACK_RECEIVER_NONCE_TOKEN_INVALID","Nonce token is invalid");atomicJson(this.root,file,{...record,state:"committed"});}
  async rollback(token:string){const key=token.split(".")[0];if(!HEX64.test(key))return;const file=path.join(this.root,`${key}.json`);if(!fs.existsSync(file))return;const record=readJson<DurableNonceRecord>(this.root,file);if(record.token===token&&record.state==="reserved")fs.unlinkSync(file);}
}
export type ReceiverFaultHooks = {
  afterNonceReserved?: () => void;
  afterObjectWritten?: () => void;
  afterDeletionPrepared?: () => void;
};

const HEX64 = /^[a-f0-9]{64}$/;
const fail = (code: string, message: string): never => {
  throw new RelayProtocolError(code, message);
};
const canonicalRoot = (value: string) => path.resolve(value);
const rootFingerprint = (root: string) =>
  sha256(
    `bimlog-feedback-receiver-root-v1\n${root.replaceAll("\\", "/").toLowerCase()}`,
  );
function contained(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
function assertNoLinks(root: string, target: string) {
  if (!contained(root, target))
    fail(
      "FEEDBACK_RECEIVER_CONTAINMENT_DENIED",
      "Receiver path escaped its authorized root",
    );
  let current = root;
  for (const part of path
    .relative(root, target)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink())
      fail(
        "FEEDBACK_RECEIVER_REPARSE_DENIED",
        "Receiver custody contains a link or reparse point",
      );
  }
}
function assertTreeNoLinks(root: string, dir = root) {
  assertNoLinks(root, dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (fs.lstatSync(target).isSymbolicLink())
      fail(
        "FEEDBACK_RECEIVER_REPARSE_DENIED",
        "Receiver custody contains a link or reparse point",
      );
    if (entry.isDirectory()) assertTreeNoLinks(root, target);
  }
}
function mkdirSafe(root: string, target: string) {
  assertNoLinks(root, target);
  fs.mkdirSync(target, { recursive: true });
  assertNoLinks(root, target);
}
function syncDirectory(dir: string) {
  try {
    const fd = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return "fsync" as const;
  } catch {
    return "rename-recovery" as const;
  }
}
function atomicWrite(root: string, target: string, bytes: Buffer) {
  assertNoLinks(root, target);
  mkdirSafe(root, path.dirname(target));
  const staging = path.join(root, "99-System", "staging"),
    temporary =
      fs.existsSync(staging) && !contained(staging, target)
        ? path.join(staging, `.stage-${randomUUID()}`)
        : path.join(path.dirname(target), `.stage-${randomUUID()}`);
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, target);
    return syncDirectory(path.dirname(target));
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
}
function atomicJson(root: string, target: string, value: unknown) {
  return atomicWrite(root, target, Buffer.from(JSON.stringify(value), "utf8"));
}
function readJson<T>(root: string, file: string): T {
  assertNoLinks(root, file);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
const MEDIA_KIND: Readonly<Record<string, ReceiverMediaKind>> = {
  "image/png": "screenshot",
  "image/jpeg": "screenshot",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "application/pdf": "document",
  "text/plain": "transcript",
  "application/octet-stream": "original",
};
function verifiedInspection(
  input: ScannerInspection,
  request: RequestContract,
  clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind },
) {
  if (input.verdict !== "clean")
    fail(
      "FEEDBACK_RECEIVER_SCANNER_CLEAN_REQUIRED",
      "Only scanner-clean bytes may enter receiver custody",
    );
  if (
    !/^[A-Za-z0-9._-]{1,80}$/.test(input.scannerAdapter) ||
    /precheck|evidence.?contract/i.test(input.scannerAdapter)
  )
    fail(
      "FEEDBACK_RECEIVER_SCANNER_AUTHORITY_INVALID",
      "A governed malware scanner adapter is required",
    );
  const inspectedAt = new Date(input.inspectedAt);
  if (
    Number.isNaN(inspectedAt.getTime()) ||
    inspectedAt.toISOString() !== input.inspectedAt ||
    input.byteCount !== request.byteCount ||
    input.sha256 !== request.sha256
  )
    fail(
      "FEEDBACK_RECEIVER_INSPECTION_MISMATCH",
      "Scanner inspection does not bind the signed bytes",
    );
  const mediaType = input.inspectedMediaType.trim().toLowerCase();
  if (MEDIA_KIND[mediaType] !== input.mediaKind)
    fail(
      "FEEDBACK_RECEIVER_MEDIA_KIND_MISMATCH",
      "Inspected media type and media kind are inconsistent",
    );
  if (
    clientDeclared &&
    (clientDeclared.mediaType.trim().toLowerCase() !== mediaType ||
      clientDeclared.mediaKind !== input.mediaKind)
  )
    fail(
      "FEEDBACK_RECEIVER_CLIENT_MEDIA_MISMATCH",
      "Client-declared media identity differs from scanner inspection",
    );
  return { ...input, inspectedMediaType: mediaType };
}
function sameSignature(a: string, b: string) {
  const left = Buffer.from(a, "utf8"),
    right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export class FeedbackReceiverCustodyService {
  readonly root: string;
  private readonly system: string;
  private readonly objects: string;
  constructor(
    private readonly authority: ReceiverRootAuthority,
    private readonly senderKeys: RelayKeyRing,
    private readonly receiverKeys: RelayKeyRing,
    private readonly nonces: ReceiverNonceAuthority,
    private readonly maxSkewMs: number,
    private readonly faults: ReceiverFaultHooks = {},
  ) {
    this.root = canonicalRoot(authority.canonicalRoot);
    if (!fs.existsSync(this.root) || !fs.statSync(this.root).isDirectory())
      fail(
        "FEEDBACK_RECEIVER_ROOT_REQUIRED",
        "Authorized receiver root must already exist",
      );
    const physical = fs.realpathSync.native(this.root);
    if (
      canonicalRoot(physical) !== this.root ||
      !HEX64.test(authority.rootFingerprintSha256) ||
      rootFingerprint(this.root) !== authority.rootFingerprintSha256
    )
      fail(
        "FEEDBACK_RECEIVER_ROOT_IDENTITY_MISMATCH",
        "Receiver root identity differs from authority",
      );
    assertTreeNoLinks(this.root);
    this.system = path.join(this.root, "99-System");
    this.objects = path.join(this.root, "01-Active");
    for (const dir of [
      this.system,
      this.objects,
      path.join(this.system, "requests"),
      path.join(this.system, "locks"),
      path.join(this.system, "deletions"),
      path.join(this.system, "staging"),
    ])
      mkdirSafe(this.root, dir);
  }
  static fingerprintRoot(root: string) {
    return rootFingerprint(canonicalRoot(root));
  }
  createUploadStage() {
    const target = path.join(this.system, "staging", `.upload-${randomUUID()}`);
    assertNoLinks(this.root, target);
    const descriptor = fs.openSync(target, "wx", 0o600);
    fs.closeSync(descriptor);
    return target;
  }
  async discardUploadStage(target: string) {
    assertNoLinks(this.root, target);
    if (!contained(path.join(this.system, "staging"), target))
      fail(
        "FEEDBACK_RECEIVER_STAGING_AUTHORITY_DENIED",
        "Upload staging path escaped receiver authority",
      );
    await fs.promises.rm(target, { force: true });
  }
  async deliverStaged(input: {
    signedRequest: Signed<RequestContract>;
    stagedPath: string;
    inspection: ScannerInspection;
    clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind };
    now?: Date;
  }) {
    assertNoLinks(this.root, input.stagedPath);
    if (!contained(path.join(this.system, "staging"), input.stagedPath))
      fail(
        "FEEDBACK_RECEIVER_STAGING_AUTHORITY_DENIED",
        "Upload staging path escaped receiver authority",
      );
    try {
      // The network path is streamed to a bounded private stage first. Async I/O
      // prevents synchronous whole-file work from blocking the receiver loop.
      const bytes = await fs.promises.readFile(input.stagedPath);
      return await this.deliver({
        signedRequest: input.signedRequest,
        bytes,
        inspection: input.inspection,
        clientDeclared: input.clientDeclared,
        now: input.now,
      });
    } finally {
      await this.discardUploadStage(input.stagedPath);
    }
  }
  private indexPath(requestId: string) {
    return path.join(this.system, "requests", `${sha256(requestId)}.json`);
  }
  private deletionPath(requestId: string) {
    return path.join(this.system, "deletions", `${sha256(requestId)}.json`);
  }
  private objectPath(request: RequestContract) {
    return path.join(
      this.objects,
      sha256(request.companyId).slice(0, 16),
      sha256(request.projectId).slice(0, 16),
      sha256(request.feedbackId).slice(0, 16),
      sha256(request.objectId).slice(0, 16),
      request.sha256,
    );
  }
  private async lock<T>(identity: string, work: () => Promise<T>): Promise<T> {
    const lock = path.join(this.system, "locks", sha256(identity));
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        fs.mkdirSync(lock);
        fs.writeFileSync(
          path.join(lock, "owner.json"),
          JSON.stringify({
            pid: process.pid,
            acquiredAt: new Date().toISOString(),
          }),
          { flag: "wx", mode: 0o600 },
        );
        try {
          return await work();
        } finally {
          fs.rmSync(lock, { recursive: true, force: false });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    return fail(
      "FEEDBACK_RECEIVER_LOCK_TIMEOUT",
      "Receiver request is already being processed",
    );
  }
  async authenticateRequest(signed: Signed<RequestContract>, now = new Date()) {
    await verifyRequest(
      signed,
      this.senderKeys,
      { consume: async () => true },
      { now, maxSkewMs: this.maxSkewMs },
    );
    return signed.payload;
  }
  async authorizeHeader(signed: Signed<RequestContract>, now = new Date()) {
    const requestHash = sha256(canonicalRequest(signed.payload));
    const index = this.indexPath(signed.payload.requestId);
    if (fs.existsSync(index)) {
      const stored = readJson<StoredDelivery>(this.root, index);
      if (
        stored.requestHash !== requestHash ||
        !sameSignature(stored.requestSignature, signed.signature)
      )
        fail(
          "FEEDBACK_RECEIVER_REQUEST_CONFLICT",
          "Request identity was reused with divergent authority",
        );
      return signed.payload;
    }
    return this.authenticateRequest(signed, now);
  }
  async deliver(input: {
    signedRequest: Signed<RequestContract>;
    bytes: Buffer;
    inspection: ScannerInspection;
    clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind };
    now?: Date;
  }): Promise<Signed<ReceiptContract>> {
    const request = input.signedRequest.payload,
      now = input.now ?? new Date(),
      requestHash = sha256(canonicalRequest(request)),
      inspection = verifiedInspection(
        input.inspection,
        request,
        input.clientDeclared,
      );
    if (
      input.bytes.length !== request.byteCount ||
      sha256(input.bytes) !== request.sha256 ||
      request.bodySha256 !== request.sha256
    )
      fail(
        "FEEDBACK_RECEIVER_OBJECT_MISMATCH",
        "Delivered bytes do not match the signed request",
      );
    return this.lock(request.requestId, async () => {
      const index = this.indexPath(request.requestId);
      if (fs.existsSync(index)) {
        await this.authorizeHeader(input.signedRequest, now);
        const stored = readJson<StoredDelivery>(this.root, index);
        if (
          stored.requestHash !== requestHash ||
          !sameSignature(stored.requestSignature, input.signedRequest.signature)
        )
          fail(
            "FEEDBACK_RECEIVER_REQUEST_CONFLICT",
            "Request identity was reused with divergent authority",
          );
        const object = path.join(this.root, stored.objectRelativePath);
        assertNoLinks(this.root, object);
        const current = fs.readFileSync(object);
        if (
          current.length !== input.bytes.length ||
          sha256(current) !== sha256(input.bytes) ||
          !current.equals(input.bytes)
        )
          fail(
            "FEEDBACK_RECEIVER_REPLAY_READBACK_MISMATCH",
            "Replay bytes do not match current custody",
          );
        return stored.receipt;
      }
      let reservation: NonceReservation | undefined;
      const nonceAdapter: NonceAuthority = {
        consume: async (details) => {
          reservation = (await this.nonces.reserve(details)) ?? undefined;
          return Boolean(reservation);
        },
      };
      await verifyRequest(input.signedRequest, this.senderKeys, nonceAdapter, {
        now,
        maxSkewMs: this.maxSkewMs,
      });
      if (!reservation)
        fail(
          "FEEDBACK_RECEIVER_NONCE_DENIED",
          "Nonce authority denied request",
        );
      const acceptedReservation = reservation as NonceReservation;
      let committed = false,
        wroteObject = false;
      try {
        this.faults.afterNonceReserved?.();
        await this.nonces.commit(acceptedReservation.token);
        committed = true;
        const object = this.objectPath(request);
        assertNoLinks(this.root, object);
        if (fs.existsSync(object)) {
          const existing = fs.readFileSync(object);
          if (!existing.equals(input.bytes))
            fail(
              "FEEDBACK_RECEIVER_OBJECT_CONFLICT",
              "Existing custody object differs from request",
            );
        } else {
          atomicWrite(this.root, object, input.bytes);
          wroteObject = true;
        }
        this.faults.afterObjectWritten?.();
        const receipt = signReceipt(
          {
            version: "1",
            requestId: request.requestId,
            companyId: request.companyId,
            projectId: request.projectId,
            feedbackId: request.feedbackId,
            objectId: request.objectId,
            byteCount: request.byteCount,
            sha256: request.sha256,
            destinationId: this.authority.destinationId,
            receivedAt: now.toISOString(),
            requestNonce: request.nonce,
            receiverKeyId: this.receiverKeys.activeKeyId,
          },
          this.receiverKeys,
          now,
        );
        const directoryDurability = atomicJson(this.root, index, {
          requestHash,
          requestSignature: input.signedRequest.signature,
          objectRelativePath: path.relative(this.root, object),
          inspection,
          receipt,
          directoryDurability: "rename-recovery",
        } satisfies StoredDelivery);
        if (directoryDurability === "fsync") {
          const stored = readJson<StoredDelivery>(this.root, index);
          stored.directoryDurability = "fsync";
          atomicJson(this.root, index, stored);
        }
        return receipt;
      } catch (error) {
        if (!committed) await this.nonces.rollback(acceptedReservation.token);
        if (wroteObject && !fs.existsSync(index)) {
          const object = this.objectPath(request);
          try {
            assertNoLinks(this.root, object);
            fs.unlinkSync(object);
          } catch {}
        }
        throw error;
      }
    });
  }
  readback(requestId: string, now = new Date()): Signed<ReadbackContract> {
    const stored = readJson<StoredDelivery>(
        this.root,
        this.indexPath(requestId),
      ),
      object = path.join(this.root, stored.objectRelativePath);
    assertNoLinks(this.root, object);
    const bytes = fs.readFileSync(object);
    if (
      bytes.length !== stored.receipt.payload.byteCount ||
      sha256(bytes) !== stored.receipt.payload.sha256
    )
      fail(
        "FEEDBACK_RECEIVER_READBACK_MISMATCH",
        "Custody bytes no longer match their receipt",
      );
    return signReadback(
      {
        version: "1",
        requestId: stored.receipt.payload.requestId,
        companyId: stored.receipt.payload.companyId,
        projectId: stored.receipt.payload.projectId,
        feedbackId: stored.receipt.payload.feedbackId,
        objectId: stored.receipt.payload.objectId,
        byteCount: bytes.length,
        sha256: sha256(bytes),
        destinationId: this.authority.destinationId,
        verifiedAt: now.toISOString(),
        receiptSha256: sha256(canonicalReceipt(stored.receipt.payload)),
        receiverKeyId: this.receiverKeys.activeKeyId,
      },
      this.receiverKeys,
      now,
    );
  }
  recover() {
    const staging = path.join(this.system, "staging");
    let removedStages = 0,
      removedStaleLocks = 0,
      finalizedDeletions = 0;
    assertNoLinks(this.root, staging);
    for (const entry of fs.readdirSync(staging)) {
      const target = path.join(staging, entry);
      assertNoLinks(this.root, target);
      if (fs.lstatSync(target).isFile()) {
        fs.unlinkSync(target);
        removedStages++;
      }
    }
    const locks = path.join(this.system, "locks");
    for (const entry of fs.readdirSync(locks)) {
      const target = path.join(locks, entry),
        ownerPath = path.join(target, "owner.json");
      assertNoLinks(this.root, target);
      if (!fs.lstatSync(target).isDirectory() || !fs.existsSync(ownerPath))
        continue;
      const owner = readJson<{ pid: number }>(this.root, ownerPath);
      let alive = true;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
      }
      if (!alive) {
        fs.rmSync(target, { recursive: true, force: false });
        removedStaleLocks++;
      }
    }
    const deletions = path.join(this.system, "deletions");
    for (const entry of fs.readdirSync(deletions)) {
      const target = path.join(deletions, entry),
        journal = readJson<DeletionJournal>(this.root, target);
      if (journal.state === "prepared") {
        const object = path.join(this.root, journal.objectRelativePath);
        assertNoLinks(this.root, object);
        if (!fs.existsSync(object)) {
          const absenceVerifiedAt=new Date().toISOString(), signed=signDeletionReceipt({version:"1",requestId:journal.receipt.requestId,companyId:journal.receipt.companyId,projectId:journal.receipt.projectId,feedbackId:journal.receipt.feedbackId,objectId:journal.receipt.objectId,byteCount:journal.receipt.byteCount,objectSha256:journal.receipt.objectSha256,destinationId:journal.receipt.destinationId,policySha256:journal.receipt.policySha256,approvedBy:journal.receipt.approvedBy,approvedAt:journal.receipt.approvedAt,deletedAt:journal.receipt.deletedAt,absenceVerifiedAt,journalSha256:journal.receipt.journalSha256,receiverKeyId:this.receiverKeys.activeKeyId},this.receiverKeys,new Date(absenceVerifiedAt));
          atomicJson(this.root, target, {
            ...journal,
            state: "finalized",
            receipt: { ...journal.receipt, absenceVerified: true,absenceVerifiedAt,signed },
          });
          finalizedDeletions++;
        }
      }
    }
    return { removedStages, removedStaleLocks, finalizedDeletions };
  }
  purge(
    requestId: string,
    authority: PurgeAuthority,
    now = new Date(),
  ): DeletionReceipt {
    if (authority.hold)
      fail("FEEDBACK_RECEIVER_HOLD_ACTIVE", "Held custody cannot be purged");
    const approvedAt = new Date(authority.approvedAt);
    if (
      !HEX64.test(authority.policySha256) ||
      !authority.approvedBy.trim() ||
      Number.isNaN(approvedAt.getTime()) ||
      approvedAt.toISOString() !== authority.approvedAt
    )
      fail(
        "FEEDBACK_RECEIVER_PURGE_AUTHORITY_INVALID",
        "Purge authority is invalid",
      );
    const journalPath = this.deletionPath(requestId);
    let journal: DeletionJournal;
    if (fs.existsSync(journalPath)) {
      journal = readJson<DeletionJournal>(this.root, journalPath);
      if (
        journal.receipt.policySha256 !== authority.policySha256 ||
        journal.receipt.approvedBy !== authority.approvedBy
      )
        fail(
          "FEEDBACK_RECEIVER_PURGE_CONFLICT",
          "Purge receipt authority differs from immutable history",
        );
      if (journal.state === "finalized") return journal.receipt;
    } else {
      const stored = readJson<StoredDelivery>(
          this.root,
          this.indexPath(requestId),
        ),
        object = path.join(this.root, stored.objectRelativePath);
      assertNoLinks(this.root, object);
      const bytes = fs.readFileSync(object);
      if (sha256(bytes) !== stored.receipt.payload.sha256)
        fail(
          "FEEDBACK_RECEIVER_READBACK_MISMATCH",
          "Custody bytes changed before purge",
        );
      const preparedBase = {
          deletedAt: now.toISOString(),
          objectSha256: sha256(bytes),
          byteCount: bytes.length,
          policySha256: authority.policySha256,
          approvedBy: authority.approvedBy,
          approvedAt:authority.approvedAt,
          absenceVerified: false,
          requestId,companyId:stored.receipt.payload.companyId,projectId:stored.receipt.payload.projectId,feedbackId:stored.receipt.payload.feedbackId,objectId:stored.receipt.payload.objectId,destinationId:this.authority.destinationId,
        } as const,
        receipt: PreparedDeletion = {...preparedBase,journalSha256:sha256(JSON.stringify(preparedBase))};
      journal = {
        state: "prepared",
        requestId,
        objectRelativePath: stored.objectRelativePath,
        receipt,
      };
      atomicJson(this.root, journalPath, journal);
      this.faults.afterDeletionPrepared?.();
    }
    const object = path.join(this.root, journal.objectRelativePath);
    assertNoLinks(this.root, object);
    if (fs.existsSync(object)) fs.unlinkSync(object);
    if (fs.existsSync(object))
      fail(
        "FEEDBACK_RECEIVER_ABSENCE_UNPROVEN",
        "Purged object absence could not be verified",
      );
    const absenceVerifiedAt=now.toISOString(), signed=signDeletionReceipt({version:"1",requestId:journal.receipt.requestId,companyId:journal.receipt.companyId,projectId:journal.receipt.projectId,feedbackId:journal.receipt.feedbackId,objectId:journal.receipt.objectId,byteCount:journal.receipt.byteCount,objectSha256:journal.receipt.objectSha256,destinationId:journal.receipt.destinationId,policySha256:journal.receipt.policySha256,approvedBy:journal.receipt.approvedBy,approvedAt:journal.receipt.approvedAt,deletedAt:journal.receipt.deletedAt,absenceVerifiedAt,journalSha256:journal.receipt.journalSha256,receiverKeyId:this.receiverKeys.activeKeyId},this.receiverKeys,now);
    const receipt: DeletionReceipt = {...journal.receipt,absenceVerified:true,absenceVerifiedAt,signed};
    atomicJson(this.root, journalPath, {
      ...journal,
      state: "finalized",
      receipt,
    });
    return receipt;
  }
  health() {
    try {
      assertTreeNoLinks(this.root);
      fs.accessSync(this.root, fs.constants.R_OK | fs.constants.W_OK);
      return {
        status: "ok" as const,
        destinationId: this.authority.destinationId,
        rootFingerprintSha256: this.authority.rootFingerprintSha256,
      };
    } catch {
      return {
        status: "unavailable" as const,
        destinationId: this.authority.destinationId,
      };
    }
  }
}

function inventoryAuthority(root: string) {
  const result: { relativePath: string; byteCount: number; sha256: string }[] =
    [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      assertNoLinks(root, target);
      if (entry.isDirectory()) {
        if (entry.name !== "staging" && entry.name !== "locks") walk(target);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(target);
        result.push({
          relativePath: path.relative(root, target).replaceAll("\\", "/"),
          byteCount: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  };
  for (const relative of [
    "01-Active",
    path.join("99-System", "requests"),
    path.join("99-System", "deletions"),
  ]) {
    const dir = path.join(root, relative);
    if (fs.existsSync(dir)) walk(dir);
  }
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
export function createReceiverBackup(
  sourceRoot: string,
  backupRoot: string,
  createdAt = new Date(),
): BackupInventory {
  const source = canonicalRoot(sourceRoot),
    backup = canonicalRoot(backupRoot);
  if (!fs.existsSync(backup) || fs.readdirSync(backup).length)
    fail(
      "FEEDBACK_RECEIVER_BACKUP_ROOT_NOT_EMPTY",
      "Backup root must exist and be empty",
    );
  assertTreeNoLinks(source);
  const objects = inventoryAuthority(source);
  for (const item of objects) {
    const from = path.join(source, item.relativePath),
      to = path.join(backup, item.relativePath);
    assertNoLinks(source, from);
    mkdirSafe(backup, path.dirname(to));
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    if (sha256(fs.readFileSync(to)) !== item.sha256)
      fail(
        "FEEDBACK_RECEIVER_BACKUP_MISMATCH",
        "Backup object verification failed",
      );
  }
  const base = {
      createdAt: createdAt.toISOString(),
      sourceRootFingerprintSha256: rootFingerprint(source),
      objects,
    },
    inventory = { ...base, inventorySha256: sha256(JSON.stringify(base)) };
  atomicJson(backup, path.join(backup, "backup-inventory.json"), inventory);
  return inventory;
}
export function restoreReceiverBackup(
  backupRoot: string,
  isolatedRestoreRoot: string,
): BackupInventory {
  const backup = canonicalRoot(backupRoot),
    restore = canonicalRoot(isolatedRestoreRoot);
  if (!fs.existsSync(restore) || fs.readdirSync(restore).length)
    fail(
      "FEEDBACK_RECEIVER_RESTORE_ROOT_NOT_EMPTY",
      "Restore root must exist and be empty",
    );
  assertTreeNoLinks(backup);
  const inventory = readJson<BackupInventory>(
      backup,
      path.join(backup, "backup-inventory.json"),
    ),
    base = {
      createdAt: inventory.createdAt,
      sourceRootFingerprintSha256: inventory.sourceRootFingerprintSha256,
      objects: inventory.objects,
    };
  if (sha256(JSON.stringify(base)) !== inventory.inventorySha256)
    fail(
      "FEEDBACK_RECEIVER_BACKUP_INVENTORY_INVALID",
      "Backup inventory digest is invalid",
    );
  for (const item of inventory.objects) {
    const from = path.join(backup, item.relativePath),
      to = path.join(restore, item.relativePath);
    assertNoLinks(backup, from);
    mkdirSafe(restore, path.dirname(to));
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    const bytes = fs.readFileSync(to);
    if (bytes.length !== item.byteCount || sha256(bytes) !== item.sha256)
      fail(
        "FEEDBACK_RECEIVER_RESTORE_MISMATCH",
        "Restored object verification failed",
      );
  }
  return inventory;
}
