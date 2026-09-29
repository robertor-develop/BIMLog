import assert from "node:assert/strict";
import { rfiTimingPresentation, rfiWorkflowSummary, safeRfiReturnTarget } from "./rfi-experience";

const now = new Date("2026-09-29T12:00:00Z");
assert.equal(rfiTimingPresentation({ status: "open", createdAt: "2026-08-01", sendStatus: "draft" }, "en", now).kind, "draft");
assert.equal(rfiTimingPresentation({ status: "open", createdAt: "2026-08-01", sendStatus: "sent" }, "en", now).kind, "age");
assert.equal(rfiTimingPresentation({ status: "open", createdAt: "2026-09-20", sentAt: "2026-09-21", dueDate: "2026-09-28" }, "en", now).isOverdue, true);
assert.equal(rfiTimingPresentation({ status: "closed", createdAt: "2026-08-01", dueDate: "2026-08-02" }, "en", now).isOverdue, false);
assert.equal(rfiWorkflowSummary({ recordState: "sent", submittedBy: "BIMTech", submittedTo: "Architect", canRespond: true, canClose: false, canReopen: false, canEdit: true }, "en").nextActor, "Architect");
assert.equal(rfiWorkflowSummary({ recordState: "closed", submittedBy: "BIMTech", submittedTo: "Architect", canRespond: false, canClose: false, canReopen: true, canEdit: true }, "en").primaryAction, "Reopen RFI");
assert.equal(safeRfiReturnTarget(58, "/projects/58/operations?taskId=9"), "/projects/58/operations?taskId=9");
assert.equal(safeRfiReturnTarget(58, "/projects/59/operations?taskId=9"), null);
assert.equal(safeRfiReturnTarget(58, "https://example.com"), null);
console.log("UX046–UX050 RFI experience PASS");
