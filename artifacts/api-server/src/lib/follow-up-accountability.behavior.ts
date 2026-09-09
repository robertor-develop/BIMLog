import assert from "node:assert/strict";
import { evaluateAccountability } from "./follow-up-accountability";

const item = { id: "action-1", projectId: 7, companyId: 3, accountableCompanyId: 20, accountableContactId: 30, assignedUserId: 11, dueAt: "2026-09-10T12:00:00Z", status: "open", lastReminderAt: null } as const;
assert.deepEqual(evaluateAccountability(item, "2026-09-09T12:00:00Z"), { state: "not_due", escalationProposed: false });
assert.deepEqual(evaluateAccountability(item, "2026-09-10T12:00:00Z"), { state: "due", escalationProposed: false });
assert.deepEqual(evaluateAccountability(item, "2026-09-11T12:00:00Z"), { state: "overdue", escalationProposed: true });
assert.deepEqual(evaluateAccountability({ ...item, status: "completed" }, "2026-09-11T12:00:00Z"), { state: "closed", escalationProposed: false });
console.log("follow-up accountability behavior: PASS");
