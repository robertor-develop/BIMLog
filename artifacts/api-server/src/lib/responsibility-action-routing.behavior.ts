import assert from "node:assert/strict";
import { responsibilityActionRoute } from "./responsibility-action-routing";
import type { CoordinatorActionModule } from "./coordinator-action-register";
import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

const labels: Record<CoordinatorActionModule, string> = { rfi: "Open RFI", submittal: "Open Submittal", meeting: "Open Meeting", schedule: "Open Schedule Item", lens: "Open Lens Issue" };
for (const [index, module] of (Object.keys(labels) as CoordinatorActionModule[]).entries()) {
  const item: ResponsibilityWorkspaceItem = {
    key: `4:${module}:${index + 1}`, sourceIdentity: { module, recordId: index + 1 }, project: { id: 4, name: "P", code: "P" },
    title: module, status: "open", owner: { userId: 1, person: "Owner", company: "BIMTECH" }, deadline: null, sourceUpdatedAt: null,
    authorizedLink: `/projects/4/${module}/${index + 1}`, contextGaps: [],
    lensEvidence: module === "rfi" ? { serverId: 9, displayId: "VP-9", authorizedLink: "/projects/4/clash-reports?view=lens&viewpoint=9" } : null,
  };
  const route = responsibilityActionRoute(item);
  assert.equal(route.label, labels[module]);
  assert.equal(route.sourceActionKey, item.key);
  assert.equal(route.mutationMode, "OWNING_MODULE_ONLY");
  assert.equal(route.createsParallelTask, false);
  assert.equal(route.publishesDocument, false);
  if (module === "rfi") assert.equal(route.lensEvidenceLink, item.lensEvidence?.authorizedLink);
}
const escaped = { project: { id: 4 }, authorizedLink: "/projects/5/rfis/1" } as ResponsibilityWorkspaceItem;
assert.throws(() => responsibilityActionRoute(escaped), /RESPONSIBILITY_ROUTE_SCOPE_INVALID/);
console.log("C029 owning-module responsibility routing: PASS");
