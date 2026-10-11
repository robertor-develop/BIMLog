import assert from "node:assert/strict";
import { chooseRoleAwareTodayAction, type TodayCandidate } from "./today-action";
const rows: TodayCandidate[] = [
  { kind:"attention", title:"A", detail:"", href:"/a" },
  { kind:"rfi", title:"R", detail:"", href:"/r" },
  { kind:"submittal", title:"S", detail:"", href:"/s" },
];
assert.equal(chooseRoleAwareTodayAction("document_controller", rows)?.kind, "submittal");
assert.equal(chooseRoleAwareTodayAction("field_team", rows)?.kind, "rfi");
assert.equal(chooseRoleAwareTodayAction("project_admin", rows)?.kind, "attention");
assert.equal(chooseRoleAwareTodayAction(null, []) , null);
console.log("today action behavior: PASS");
