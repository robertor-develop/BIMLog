import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureLensIssueViewpointsSchema, LENS_ISSUE_VIEWPOINTS_SQL } from "./lens-issue-viewpoints-migration";

assert.match(LENS_ISSUE_VIEWPOINTS_SQL, /CREATE TABLE IF NOT EXISTS lens_issue_viewpoints/);
assert.match(LENS_ISSUE_VIEWPOINTS_SQL, /CREATE TABLE IF NOT EXISTS lens_issue_viewpoint_revisions/);
assert.match(LENS_ISSUE_VIEWPOINTS_SQL, /WHERE is_primary AND lifecycle_status='active'/);
assert.match(LENS_ISSUE_VIEWPOINTS_SQL, /'legacy-primary-' \|\| issue\.id::text/);
assert.doesNotMatch(LENS_ISSUE_VIEWPOINTS_SQL, /UPDATE\s+lens_viewpoints/i);

const calls: string[] = [];
let released = false;
await ensureLensIssueViewpointsSchema({ connect: async () => ({ query: async sql => { calls.push(sql); }, release: () => { released = true; } }) });
assert.deepEqual(calls.slice(0, 2), ["BEGIN", "SELECT pg_advisory_xact_lock(hashtext('bimlog:lens-issue-viewpoints:v1'))"]);
assert.equal(calls.at(-1), "COMMIT");
assert.equal(released, true);

const failed: string[] = [];
await assert.rejects(ensureLensIssueViewpointsSchema({ connect: async () => ({ query: async sql => { failed.push(sql); if (sql === LENS_ISSUE_VIEWPOINTS_SQL) throw new Error("forced"); }, release: () => undefined }) }), /forced/);
assert.equal(failed.at(-1), "ROLLBACK");
const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
assert.ok(appSource.indexOf("const livingBriefAndLensStartupBarrier") < appSource.indexOf("const lensIssueViewpointsStartupBarrier"));
assert.match(appSource, /startupBarrier = Promise\.all\(\[[\s\S]*lensIssueViewpointsStartupBarrier/);
console.log("Lens Build 006 additive multi-viewpoint schema and immutable primary backfill: PASS");
