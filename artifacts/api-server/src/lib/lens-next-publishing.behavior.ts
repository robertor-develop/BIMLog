import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LensNextPublishError, parseLensNextPublishRequest, publishLensNextAction } from "./lens-next-publishing";

type State = { issue: any; receipts: any[]; member: boolean };
class MemoryPool {
  state: State = { issue: { id: 7, viewpoint_id: "vp-7", lifecycle_status: "active", revision_number: 2, mutation_version: 3, status: "open", responsible_company: "Trade A" }, receipts: [], member: true };
  async query() { return { rows: [] }; }
  async connect() {
    const saved = structuredClone(this.state);
    return { release() {}, query: async (sql: string, values: unknown[] = []) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (sql === "ROLLBACK") { this.state = saved; return { rows: [] }; }
      if (sql.includes("FROM lens_next_publish_receipts WHERE actor_user_id")) return { rows: this.state.receipts.filter(r => r.actor_user_id === values[0] && r.idempotency_key === values[1]) };
      if (sql.includes("FROM project_members")) return { rows: this.state.member ? [{ role: "project_admin" }] : [] };
      if (sql.includes("FROM lens_viewpoints WHERE")) return { rows: [structuredClone(this.state.issue)] };
      if (sql.startsWith("UPDATE lens_viewpoints SET status")) { this.state.issue.status = values[0]; this.state.issue.mutation_version++; return { rows: [structuredClone(this.state.issue)] }; }
      if (sql.startsWith("UPDATE lens_viewpoints SET responsible_company")) { this.state.issue.responsible_company = values[0]; this.state.issue.mutation_version++; return { rows: [structuredClone(this.state.issue)] }; }
      if (sql.startsWith("UPDATE lens_viewpoints SET mutation_version")) { this.state.issue.mutation_version++; return { rows: [structuredClone(this.state.issue)] }; }
      if (sql.startsWith("INSERT INTO lens_next_publish_receipts")) { this.state.receipts.push({ actor_user_id: values[2], idempotency_key: values[3], request_hash: values[4], response_payload: JSON.parse(String(values[12])) }); return { rows: [] }; }
      throw new Error(`unexpected SQL: ${sql}`);
    }};
  }
}

const actor = { userId: 11, fullName: "Coordinator", companyName: "BIMCo", isSuperAdmin: false, role: "project_admin", permission: "write" };
const body = (key = "publish-key-0001", action: any = { type: "status", status: "follow_up" }) => ({
  contractVersion: "lens-next-publish.v1", requestId: `request-${key}`, idempotencyKey: key,
  identity: { projectId: 3, serverId: 7, viewpointId: "vp-7", lifecycleStatus: "active", revisionNumber: 2, mutationVersion: 3 },
  action, reason: "Reviewed coordination condition", modelFingerprint: "sha256:model-7",
});

const checks: string[] = [];
const parsed = parseLensNextPublishRequest(body(), 3, 7);
assert.equal(parsed.action.type, "status"); checks.push("strict controlled contract parses");
assert.throws(() => parseLensNextPublishRequest({ ...body(), extra: true }, 3, 7), LensNextPublishError); checks.push("unknown fields denied");
assert.throws(() => parseLensNextPublishRequest({ ...body(), identity: { ...body().identity, extra: true } }, 3, 7), /unsupported fields/); checks.push("unknown identity fields denied");
assert.throws(() => parseLensNextPublishRequest(body("publish-key-nested", { type: "status", status: "follow_up", comment: "hidden payload" }), 3, 7), /unsupported fields/); checks.push("action-specific fields enforced");
assert.throws(() => parseLensNextPublishRequest({ ...body(), identity: { ...body().identity, serverId: 8 } }, 3, 7), /route and immutable/); checks.push("route identity mismatch denied");

const pool = new MemoryPool();
const first = await publishLensNextAction(pool as any, actor, parsed);
assert.equal(first.issue.status, "follow_up");
assert.equal(first.issue.mutationVersion, 4);
assert.equal(pool.state.receipts.length, 1); checks.push("status and immutable receipt commit together");
const replay = await publishLensNextAction(pool as any, actor, parsed);
assert.equal(replay.replayed, true); assert.equal(pool.state.receipts.length, 1); checks.push("identical retry replays once");
await assert.rejects(() => publishLensNextAction(pool as any, actor, parseLensNextPublishRequest(body("publish-key-0001", { type: "comment", comment: "different" }), 3, 7)), /idempotency key/); checks.push("divergent retry conflicts");
await assert.rejects(() => publishLensNextAction(pool as any, actor, parseLensNextPublishRequest(body("publish-key-0002", { type: "comment", comment: "stale" }), 3, 7)), (error: any) => error.code === "LENS_NEXT_VERSION_CONFLICT" && error.current.mutationVersion === 4); checks.push("stale version returns safe current snapshot");
await assert.rejects(() => publishLensNextAction(new MemoryPool() as any, { ...actor, permission: "read" }, parsed), (error: any) => error.status === 403); checks.push("read-only role denied");
const rollbackPool = new MemoryPool();
await assert.rejects(() => publishLensNextAction(rollbackPool as any, actor, parsed, { beforeAudit: async () => { throw new Error("forced audit failure"); } }), /forced audit failure/);
assert.equal(rollbackPool.state.issue.status, "open"); assert.equal(rollbackPool.state.receipts.length, 0); checks.push("audit failure rolls mutation back");
const commentPool = new MemoryPool();
const comment = await publishLensNextAction(commentPool as any, actor, parseLensNextPublishRequest(body("publish-key-comment", { type: "comment", comment: "Coordinate opening at grid B-4" }), 3, 7));
assert.equal(comment.issue.mutationVersion, 4); assert.equal(commentPool.state.issue.status, "open"); checks.push("comment advances workflow version without changing status");
const assignmentPool = new MemoryPool();
const assignment = await publishLensNextAction(assignmentPool as any, actor, parseLensNextPublishRequest(body("publish-key-assign", { type: "assignment", responsibleCompany: "Trade B" }), 3, 7));
assert.equal(assignment.issue.responsibleCompany, "Trade B"); checks.push("assignment publishes atomically");
const inactivePool = new MemoryPool(); inactivePool.state.member = false;
await assert.rejects(() => publishLensNextAction(inactivePool as any, actor, parsed), (error: any) => error.code === "LENS_NEXT_PUBLISH_FORBIDDEN"); checks.push("inactive membership denied inside transaction");

const route = readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");
assert.match(route, /requirePermission\("admin", "write"\)/);
assert.match(route, /lens-next\/issues\/:id\/publish/);
const schema = readFileSync(new URL("../../../../lib/db/src/schema/lens-next-publishing.ts", import.meta.url), "utf8");
assert.match(schema, /actorIdempotencyUnique/); checks.push("route and schema authority mounted");
console.log(JSON.stringify({ status: "PASS", checks: checks.length, details: checks }));
