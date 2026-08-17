import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  FeedbackReceiverCustodyService,
  FilesystemReceiverNonceAuthority,
  createReceiverBackup,
  restoreReceiverBackup,
  type ReceiverNonceAuthority,
} from "./receiver-service.js";
import {verifyDeletionReceiptDurably} from "./protocol.js";
import {
  assertReadbackMatchesReceipt,
  canonicalRequest,
  sha256,
  signRequest,
  verifyReceipt,
  verifyRequest,
  type NonceAuthority,
  type RelayKeyRing,
  type RequestContract,
} from "./protocol.js";

const disposable = path.join(
    "F:\\BIMLog\\.disposable\\feedback-receiver-tests",
    randomUUID(),
  ),
  root = path.join(disposable, "receiver"),
  backup = path.join(disposable, "backup"),
  restore = path.join(disposable, "restore");
for (const p of [root, backup, restore]) fs.mkdirSync(p, { recursive: true });
let passed = 0;
const check = async (name: string, fn: () => unknown | Promise<unknown>) => {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
};
const code = async (expected: string, fn: () => unknown | Promise<unknown>) =>
  assert.rejects(
    async () => fn(),
    (e: unknown) =>
      Boolean(e && typeof e === "object" && "code" in e && e.code === expected),
  );
const now = new Date("2026-08-17T15:00:00.000Z"),
  senderSecret = Buffer.from("sender-0123456789abcdef0123456789"),
  receiverSecret = Buffer.from("receiver-0123456789abcdef01234567");
const keys = (id: string, secret: Buffer): RelayKeyRing => ({
  activeKeyId: id,
  keys: [
    {
      id,
      secret,
      status: "active",
      notBefore: new Date("2026-01-01T00:00:00.000Z"),
      notAfter: new Date("2027-01-01T00:00:00.000Z"),
    },
  ],
});
const senderKeys = keys("sender-key", senderSecret),
  receiverKeys = keys("receiver-key", receiverSecret);
class MemoryNonces implements ReceiverNonceAuthority {
  bound = new Map<string, string>();
  pending = new Map<string, { key: string; hash: string }>();
  async reserve(value: any) {
    const key = `${value.audience}:${value.keyId}:${value.nonce}`,
      known = this.bound.get(key);
    if (known)
      return known === value.requestSha256
        ? { token: `retry:${key}`, status: "identical-retry" as const }
        : null;
    const token = randomUUID();
    this.pending.set(token, { key, hash: value.requestSha256 });
    return { token, status: "new" as const };
  }
  async commit(token: string) {
    if (token.startsWith("retry:")) return;
    const value = this.pending.get(token);
    if (!value) throw new Error("reservation missing");
    this.bound.set(value.key, value.hash);
    this.pending.delete(token);
  }
  async rollback(token: string) {
    this.pending.delete(token);
  }
}
const nonces = new MemoryNonces();
const authority = {
  canonicalRoot: root,
  rootFingerprintSha256: FeedbackReceiverCustodyService.fingerprintRoot(root),
  destinationId: "receiver-test",
};
const service = new FeedbackReceiverCustodyService(
  authority,
  senderKeys,
  receiverKeys,
  nonces,
  30000,
);
const bytes = Buffer.from("opaque receiver evidence bytes"),
  request = (
    id: string,
    nonce: string,
    requestId = `request-${id}`,
  ): RequestContract => ({
    version: "1",
    method: "PUT",
    path: `/v1/objects/${id}`,
    query: "",
    audience: "receiver-test",
    keyId: "sender-key",
    timestamp: now.toISOString(),
    nonce,
    requestId,
    companyId: "company-test",
    projectId: "project-test",
    feedbackId: "FB-TEST",
    objectId: id,
    byteCount: bytes.length,
    sha256: sha256(bytes),
    bodySha256: sha256(bytes),
  });
const inspection = {
  verdict: "clean" as const,
  scannerAdapter: "fixture-malware-scanner",
  inspectedAt: now.toISOString(),
  inspectedMediaType: "application/pdf",
  mediaKind: "document" as const,
  byteCount: bytes.length,
  sha256: sha256(bytes),
};
try {
  await check("filesystem nonce authority survives instance restart",async()=>{const nonceRoot=path.join(disposable,"nonce-authority");fs.mkdirSync(nonceRoot);const binding={audience:"receiver",keyId:"key-active",nonce:"restart-nonce",timestamp:now.toISOString(),requestId:"restart-request",companyId:"company",projectId:"project",requestSha256:"d".repeat(64)};const first=new FilesystemReceiverNonceAuthority(nonceRoot),reserved=await first.reserve(binding);assert.ok(reserved);await first.commit(reserved.token);const restarted=new FilesystemReceiverNonceAuthority(nonceRoot);assert.equal((await restarted.reserve(binding))?.status,"identical-retry");assert.equal(await restarted.reserve({...binding,requestSha256:"e".repeat(64)}),null);});
  await check("external root authority and sanitized health are bound", () =>
    assert.deepEqual(service.health(), {
      status: "ok",
      destinationId: "receiver-test",
      rootFingerprintSha256: authority.rootFingerprintSha256,
    }),
  );
  await check("invalid root fingerprint fails closed", () =>
    assert.throws(
      () =>
        new FeedbackReceiverCustodyService(
          { ...authority, rootFingerprintSha256: "0".repeat(64) },
          senderKeys,
          receiverKeys,
          nonces,
          30000,
        ),
      /root identity differs/,
    ),
  );
  const firstRequest = request("object-one", "nonce-one", "request-one"),
    signedFirst = signRequest(firstRequest, senderKeys, now);
  let firstReceipt: any;
  await check(
    "delivery atomically projects scanner-clean opaque bytes and returns signed scoped receipt",
    async () => {
      firstReceipt = await service.deliver({
        signedRequest: signedFirst,
        bytes,
        inspection,
        clientDeclared: { mediaType: "application/pdf", mediaKind: "document" },
        now,
      });
      const verified = verifyReceipt(firstReceipt, receiverKeys, now);
      assert.equal(verified.sha256, sha256(bytes));
      assert.deepEqual(
        [verified.requestId, verified.companyId, verified.projectId],
        [
          firstRequest.requestId,
          firstRequest.companyId,
          firstRequest.projectId,
        ],
      );
      const names: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          names.push(e.name);
          if (e.isDirectory()) walk(path.join(d, e.name));
        }
      };
      walk(path.join(root, "01-Active"));
      assert.equal(names.includes("object-one"), false);
      assert.equal(names.includes("FB-TEST"), false);
    },
  );
  await check(
    "identical replay returns immutable receipt without nonce reuse or rewrite",
    async () =>
      assert.deepEqual(
        await service.deliver({
          signedRequest: signedFirst,
          bytes,
          inspection,
          now,
        }),
        firstReceipt,
      ),
  );
  await check("divergent request identity conflicts", () =>
    code("FEEDBACK_RECEIVER_REQUEST_CONFLICT", () =>
      service.deliver({
        signedRequest: signRequest(
          request("object-two", "nonce-two", "request-one"),
          senderKeys,
          now,
        ),
        bytes,
        inspection,
        now,
      }),
    ),
  );
  await check(
    "concurrent delivery serializes to one receipt and one nonce",
    async () => {
      const r = request(
          "object-concurrent",
          "nonce-concurrent",
          "request-concurrent",
        ),
        signed = signRequest(r, senderKeys, now);
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          service.deliver({ signedRequest: signed, bytes, inspection, now }),
        ),
      );
      assert.equal(new Set(results.map((v) => JSON.stringify(v))).size, 1);
    },
  );
  await check(
    "scanner authority and media inconsistencies fail with zero residue",
    async () => {
      for (const [requestId, bad, expected] of [
        [
          "request-scan",
          { ...inspection, verdict: "quarantined" },
          "FEEDBACK_RECEIVER_SCANNER_CLEAN_REQUIRED",
        ],
        [
          "request-precheck",
          {
            ...inspection,
            scannerAdapter: "feedback-evidence-contract-precheck",
          },
          "FEEDBACK_RECEIVER_SCANNER_AUTHORITY_INVALID",
        ],
        [
          "request-kind",
          { ...inspection, mediaKind: "audio" },
          "FEEDBACK_RECEIVER_MEDIA_KIND_MISMATCH",
        ],
      ] as const) {
        const r = request(
          `object-${requestId}`,
          `nonce-${requestId}`,
          requestId,
        );
        await code(expected, () =>
          service.deliver({
            signedRequest: signRequest(r, senderKeys, now),
            bytes,
            inspection: bad as any,
            now,
          }),
        );
        assert.equal(
          fs.existsSync(
            path.join(
              root,
              "99-System",
              "requests",
              `${sha256(requestId)}.json`,
            ),
          ),
          false,
        );
      }
      const r = request(
        "object-client-kind",
        "nonce-client-kind",
        "request-client-kind",
      );
      await code("FEEDBACK_RECEIVER_CLIENT_MEDIA_MISMATCH", () =>
        service.deliver({
          signedRequest: signRequest(r, senderKeys, now),
          bytes,
          inspection,
          clientDeclared: { mediaType: "audio/mpeg", mediaKind: "audio" },
          now,
        }),
      );
    },
  );
  await check("byte mutation rolls back with zero request index", async () => {
    const r = request("object-bad", "nonce-bad", "request-bad");
    await code("FEEDBACK_RECEIVER_OBJECT_MISMATCH", () =>
      service.deliver({
        signedRequest: signRequest(r, senderKeys, now),
        bytes: Buffer.from("wrong"),
        inspection,
        now,
      }),
    );
    assert.equal(
      fs.existsSync(
        path.join(
          root,
          "99-System",
          "requests",
          `${sha256("request-bad")}.json`,
        ),
      ),
      false,
    );
  });
  await check(
    "nonce reservation rolls back on pre-write failure and exact retry succeeds",
    async () => {
      const failureRoot = path.join(disposable, "reservation-failure");
      fs.mkdirSync(failureRoot);
      const failureAuthority = {
        ...authority,
        canonicalRoot: failureRoot,
        rootFingerprintSha256:
          FeedbackReceiverCustodyService.fingerprintRoot(failureRoot),
      };
      const failureNonces = new MemoryNonces();
      const r = request(
          "object-reservation",
          "nonce-reservation",
          "request-reservation",
        ),
        signed = signRequest(r, senderKeys, now);
      const failing = new FeedbackReceiverCustodyService(
        failureAuthority,
        senderKeys,
        receiverKeys,
        failureNonces,
        30000,
        {
          afterNonceReserved: () => {
            throw new Error("forced reservation failure");
          },
        },
      );
      await assert.rejects(
        () =>
          failing.deliver({ signedRequest: signed, bytes, inspection, now }),
        /forced reservation failure/,
      );
      assert.equal(failureNonces.pending.size, 0);
      const restarted = new FeedbackReceiverCustodyService(
        failureAuthority,
        senderKeys,
        receiverKeys,
        failureNonces,
        30000,
      );
      assert.equal(
        (
          await restarted.deliver({
            signedRequest: signed,
            bytes,
            inspection,
            now,
          })
        ).payload.requestId,
        r.requestId,
      );
    },
  );
  await check(
    "committed nonce permits exact recovery after object-write crash without divergent reuse",
    async () => {
      const failureRoot = path.join(disposable, "post-write-failure");
      fs.mkdirSync(failureRoot);
      const failureAuthority = {
        ...authority,
        canonicalRoot: failureRoot,
        rootFingerprintSha256:
          FeedbackReceiverCustodyService.fingerprintRoot(failureRoot),
      };
      const failureNonces = new MemoryNonces();
      const r = request(
          "object-post-write",
          "nonce-post-write",
          "request-post-write",
        ),
        signed = signRequest(r, senderKeys, now);
      const failing = new FeedbackReceiverCustodyService(
        failureAuthority,
        senderKeys,
        receiverKeys,
        failureNonces,
        30000,
        {
          afterObjectWritten: () => {
            throw new Error("forced post-write failure");
          },
        },
      );
      await assert.rejects(
        () =>
          failing.deliver({ signedRequest: signed, bytes, inspection, now }),
        /forced post-write failure/,
      );
      const restarted = new FeedbackReceiverCustodyService(
        failureAuthority,
        senderKeys,
        receiverKeys,
        failureNonces,
        30000,
      );
      assert.equal(
        (
          await restarted.deliver({
            signedRequest: signed,
            bytes,
            inspection,
            now,
          })
        ).payload.requestId,
        r.requestId,
      );
      const divergent = { ...r, objectId: "divergent" };
    await code("FEEDBACK_RECEIVER_REQUEST_CONFLICT", () =>
        restarted.deliver({
          signedRequest: signRequest(divergent, senderKeys, now),
          bytes,
          inspection,
          now,
        }),
      );
    },
  );
  await check("readback is signed and receipt-bound", () =>
    assert.doesNotThrow(() =>
      assertReadbackMatchesReceipt(
        service.readback("request-one", now).payload,
        firstReceipt,
      ),
    ),
  );
  await check(
    "crash recovery removes staging residue and proven-dead process locks",
    () => {
      const stage = path.join(root, "99-System", "staging", "orphan");
      fs.writeFileSync(stage, "partial");
      const stale = path.join(root, "99-System", "locks", "stale");
      fs.mkdirSync(stale);
      fs.writeFileSync(
        path.join(stale, "owner.json"),
        JSON.stringify({ pid: 2147483647 }),
      );
      assert.deepEqual(service.recover(), {
        removedStages: 1,
        removedStaleLocks: 1,
        finalizedDeletions: 0,
      });
      assert.equal(fs.existsSync(stage), false);
      assert.equal(fs.existsSync(stale), false);
    },
  );
  await check("reparse traversal is denied", () => {
    const outside = path.join(disposable, "outside");
    fs.mkdirSync(outside);
    const link = path.join(root, "01-Active", "linked");
    fs.symlinkSync(outside, link, "junction");
    assert.equal(service.health().status, "unavailable");
    assert.throws(
      () =>
        new FeedbackReceiverCustodyService(
          authority,
          senderKeys,
          receiverKeys,
          nonces,
          30000,
        ),
      /link or reparse/,
    );
    fs.unlinkSync(link);
  });
  await check("hold defeats governed purge", () =>
    code("FEEDBACK_RECEIVER_HOLD_ACTIVE", () =>
      service.purge(
        "request-one",
        {
          policySha256: "a".repeat(64),
          approvedBy: "operator",
          approvedAt: now.toISOString(),
          hold: true,
        },
        now,
      ),
    ),
  );
  await check(
    "governed purge verifies absence and emits signed deletion receipt",
    async () => {
      const purgeAuthority = {
        policySha256: "a".repeat(64),
        approvedBy: "operator",
        approvedAt: now.toISOString(),
        hold: false,
      };
      const deleted = service.purge("request-one", purgeAuthority, now);
      assert.equal(deleted.absenceVerified, true);
      const durable=verifyDeletionReceiptDurably(deleted.signed,receiverKeys,now);assert.equal(durable.canonicalSha256.length,64);assert.equal(deleted.signed.payload.approvedBy,"operator");assert.equal(deleted.signed.payload.journalSha256,deleted.journalSha256);
      assert.deepEqual(
        service.purge("request-one", purgeAuthority, now),
        deleted,
      );
      assert.throws(
        () =>
          service.purge(
            "request-one",
            { ...purgeAuthority, approvedBy: "other" },
            now,
          ),
        /authority differs/,
      );
    },
  );
  await check(
    "prepared purge survives crash without false absence and restart finalizes",
    async () => {
      const purgeRoot = path.join(disposable, "purge-crash");
      fs.mkdirSync(purgeRoot);
      const purgeAuthorityRoot = {
        ...authority,
        canonicalRoot: purgeRoot,
        rootFingerprintSha256:
          FeedbackReceiverCustodyService.fingerprintRoot(purgeRoot),
      };
      const purgeNonces = new MemoryNonces(),
        r = request(
          "object-purge-crash",
          "nonce-purge-crash",
          "request-purge-crash",
        ),
        signed = signRequest(r, senderKeys, now);
      const failing = new FeedbackReceiverCustodyService(
        purgeAuthorityRoot,
        senderKeys,
        receiverKeys,
        purgeNonces,
        30000,
        {
          afterDeletionPrepared: () => {
            throw new Error("forced purge crash");
          },
        },
      );
      await failing.deliver({ signedRequest: signed, bytes, inspection, now });
      const governed = {
        policySha256: "b".repeat(64),
        approvedBy: "operator",
        approvedAt: now.toISOString(),
        hold: false,
      };
      assert.throws(
        () => failing.purge(r.requestId, governed, now),
        /forced purge crash/,
      );
      const deletionPath = path.join(
        purgeRoot,
        "99-System",
        "deletions",
        `${sha256(r.requestId)}.json`,
      );
      assert.equal(
        JSON.parse(fs.readFileSync(deletionPath, "utf8")).receipt
          .absenceVerified,
        false,
      );
      const restarted = new FeedbackReceiverCustodyService(
        purgeAuthorityRoot,
        senderKeys,
        receiverKeys,
        purgeNonces,
        30000,
      );
      assert.equal(
        restarted.purge(r.requestId, governed, now).absenceVerified,
        true,
      );
      assert.equal(
        JSON.parse(fs.readFileSync(deletionPath, "utf8")).receipt
          .absenceVerified,
        true,
      );
    },
  );
  await check(
    "backup inventory and isolated restore preserve exact remaining bytes",
    () => {
      const inventory = createReceiverBackup(root, backup, now);
      assert.ok(inventory.objects.length >= 1);
      assert.deepEqual(
        restoreReceiverBackup(backup, restore).objects,
        inventory.objects,
      );
      for (const item of inventory.objects)
        assert.equal(
          sha256(fs.readFileSync(path.join(restore, item.relativePath))),
          item.sha256,
        );
    },
  );
  await check("non-empty restore destination fails closed", () => {
    const target = path.join(disposable, "nonempty");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "owned"), "x");
    assert.throws(
      () => restoreReceiverBackup(backup, target),
      /must exist and be empty/,
    );
  });
  await check("no raw identifiers or key material enter custody files", () => {
    const all: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else all.push(fs.readFileSync(p).toString("utf8"));
      }
    };
    walk(root);
    assert.equal(
      all.some(
        (v) =>
          v.includes(senderSecret.toString()) ||
          v.includes(receiverSecret.toString()),
      ),
      false,
    );
  });
  console.log(`feedback receiver custody behavior: ${passed}/${passed}`);
} finally {
  fs.rmSync(disposable, { recursive: true, force: true });
}
