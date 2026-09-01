import assert from "node:assert/strict";
import { normalizeJobWorkPackages, summarizeJobWorkPackages } from "./job-work-package-builder";

const rows = normalizeJobWorkPackages([
  { id: "L10-EAST", apuDraftId: "APU-DRAFT", title: "Level 10 east", floor: "10", zone: "East", task: "Draft ductwork", deliverable: "Shop drawings" },
  { id: "L11-WEST", apuDraftId: "APU-COORD", title: "Level 11 west", floor: "11", zone: "West", task: "Coordinate clashes", deliverable: "Federated model" },
], new Map([["APU-DRAFT", "BASE"], ["APU-COORD", "CO-1"]]));
assert.deepEqual(summarizeJobWorkPackages(rows), { total: 2, floors: 2, zones: 2, tasks: 2, deliverables: 2 });
assert.equal(rows[1].contractId, "CO-1");
assert.throws(() => normalizeJobWorkPackages([{ id: "BAD", apuDraftId: "MISSING" }], new Map()), /belong to an APU/);
assert.throws(() => normalizeJobWorkPackages([{ id: "SAME", apuDraftId: "A" }, { id: "SAME", apuDraftId: "A" }], new Map([["A", "BASE"]])), /IDs must be unique/);
console.log("Job work-package builder behavior: PASS");
