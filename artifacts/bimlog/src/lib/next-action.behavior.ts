import assert from "node:assert/strict";
import { nextActionReason, selectNextAction, type NextActionCandidate } from "./next-action";

const candidate = (key: string, groups: NextActionCandidate["classification"]["groups"], deadline: string | null = null): NextActionCandidate => ({
  key, title: key, status: "open", deadline, project: { id: 7, name: "Synthetic project", code: "SYN" },
  classification: { groups }, action: { label: "Open source", openLink: `/projects/7/rfis?record=${key}` },
});
const none = { due: false, overdue: false, blocked: false, noResponse: false };

assert.equal(selectNextAction([]), null);
assert.equal(selectNextAction([
  candidate("active", none),
  candidate("blocked", { ...none, blocked: true }),
  candidate("overdue-later", { ...none, overdue: true }, "2026-10-03"),
  candidate("overdue-earlier", { ...none, overdue: true }, "2026-10-01"),
])?.key, "overdue-earlier");
assert.equal(nextActionReason("no_response", "es"), "Aún falta una respuesta");
console.log("UX121 authoritative next-action presentation contract: PASS");
