import assert from "node:assert/strict";
import { parseResponsibilityScope, scopeResponsibilityItems } from "./responsibility-workspace-scope";
import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

function item(key: string, projectId: number, userId: number | null, company: string | null): ResponsibilityWorkspaceItem {
  return {
    key, sourceIdentity: { module: "rfi", recordId: Number(key) },
    project: { id: projectId, name: `Project ${projectId}`, code: `P${projectId}` },
    title: key, status: "open", owner: { userId, person: null, company }, deadline: null,
    sourceUpdatedAt: null, authorizedLink: `/projects/${projectId}/rfis/${key}`, contextGaps: [], lensEvidence: null,
  };
}

const authorized = [item("1", 10, 7, "BIMTECH CORP"), item("2", 11, 8, " bimtech corp "), item("3", 10, 9, "Other")];
assert.deepEqual(scopeResponsibilityItems({ items: authorized, scope: "my_work", userId: 7, companyName: "BIMTECH CORP" }).map(i => i.key), ["1"]);
assert.deepEqual(scopeResponsibilityItems({ items: authorized, scope: "my_company", userId: 7, companyName: "BIMTECH CORP" }).map(i => i.key), ["1", "2"]);
assert.equal(scopeResponsibilityItems({ items: authorized, scope: "authorized_projects", userId: 7, companyName: "BIMTECH CORP" }).length, 3);
assert.equal(parseResponsibilityScope(undefined), "my_work");
assert.throws(() => parseResponsibilityScope("all_companies"), /RESPONSIBILITY_SCOPE_INVALID/);
console.log("C027 responsibility workspace scopes: PASS");
