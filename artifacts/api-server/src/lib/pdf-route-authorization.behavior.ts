import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@workspace/db";
import { authMiddleware, requireProjectMember, signToken } from "../middlewares/auth";

const here = path.dirname(fileURLToPath(import.meta.url));
const routesRoot = path.resolve(here, "../routes");
const readRoute = (name: string) => fs.readFileSync(path.join(routesRoot, name), "utf8");

const submittal = readRoute("submittal_reports.ts");
const clash = readRoute("clash_reports.ts");
const reports = readRoute("reports.ts");
const meetings = readRoute("meeting_minutes.ts");

assert.match(
  submittal,
  /submittal-reports\/:reportId\/pdf",\s*authMiddleware,\s*requireProjectMember\(\)/,
  "Submittal PDF must require authenticated project membership",
);
assert.match(
  clash,
  /clash-reports\/:reportId\/pdf",\s*authMiddleware,\s*requireProjectMember\(\)/,
  "Clash PDF must require authenticated project membership",
);
for (const [name, source] of Object.entries({ submittal, clash, reports, meetings })) {
  assert.doesNotMatch(source, /req\.query\.token/, `${name} must not accept JWTs from the query string`);
}

type FakeResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
};

const response = (): FakeResponse => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const token = signToken({
  userId: 41,
  email: "member@example.test",
  companyId: 7,
  fullName: "Project Member",
  companyName: "Example",
});

{
  const req = { headers: { authorization: `Bearer ${token}` }, query: {}, params: { projectId: "26" } } as any;
  const res = response();
  let nextCalls = 0;
  authMiddleware(req, res as any, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1, "Bearer authentication must reach project authorization");
  assert.equal(req.user.userId, 41);
}

{
  const req = { headers: {}, query: { token }, params: { projectId: "26" } } as any;
  const res = response();
  let nextCalls = 0;
  authMiddleware(req, res as any, () => { nextCalls += 1; });
  assert.equal(nextCalls, 0, "A query-only JWT must not authenticate");
  assert.equal(res.statusCode, 401);
}

const originalSelect = (db as any).select;
async function runMembership(results: unknown[][]) {
  let index = 0;
  (db as any).select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => results[index++] ?? [],
      }),
    }),
  });
  const req = { user: { userId: 41 }, params: { projectId: "26" } } as any;
  const res = response();
  let nextCalls = 0;
  await requireProjectMember()(req, res as any, () => { nextCalls += 1; });
  return { req, res, nextCalls };
}

try {
  const member = await runMembership([[{ isSuperAdmin: false }], [{ role: "member" }]]);
  assert.equal(member.nextCalls, 1, "An active project member must be authorized");
  assert.equal(member.req.memberRole, "member");

  const superAdmin = await runMembership([[{ isSuperAdmin: true }]]);
  assert.equal(superAdmin.nextCalls, 1, "A verified super administrator must retain the established bypass");
  assert.equal(superAdmin.req.memberRole, "project_admin");

  const nonMember = await runMembership([[{ isSuperAdmin: false }], []]);
  assert.equal(nonMember.nextCalls, 0, "A non-member must be denied");
  assert.equal(nonMember.res.statusCode, 403);
  assert.deepEqual(nonMember.res.body, { error: "Not a member of this project" });
} finally {
  (db as any).select = originalSelect;
}

console.log(JSON.stringify({
  status: "PASS",
  checks: [
    "submittal-route-authenticated-project-scope",
    "clash-route-authenticated-project-scope",
    "query-jwt-denied",
    "authorized-project-member",
    "verified-super-admin",
    "non-member-denied",
  ],
}));
