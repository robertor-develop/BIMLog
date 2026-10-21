import assert from "node:assert/strict";
import { validateEmptyStateGuidance } from "./ActionableEmptyState.tsx";

assert.equal(validateEmptyStateGuidance({ title: "No RFIs", reason: "No question has been submitted.", actor: "Project members may create one.", actionLabel: "Create RFI", destination: "/rfis/new" }), true);
assert.equal(validateEmptyStateGuidance({ title: "No RFIs", reason: "", actor: "Member", actionLabel: "Create", destination: "/rfis/new" }), false);
console.log("ACTIONABLE_EMPTY_STATE_RESULT=PASS reason actor action and destination are required");
