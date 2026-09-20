import assert from "node:assert/strict";
import { validateFinalBrowserAcceptance } from "./block24-final-release-contract";

const commit = "c".repeat(40);
const accepted = { visibleChrome: true, authenticatedSuperAdmin: true, healthStatus: 200, readyStatus: 200, liveSourceCommit: commit, expectedSourceCommit: commit, dashboard: true, projectWorkspace: true, lensNext: true, sessionReload: true, twoTabContinuity: true, consoleErrors: 0, pageErrors: 0 } as const;
assert.deepEqual(validateFinalBrowserAcceptance(accepted), []);
assert.ok(validateFinalBrowserAcceptance({ ...accepted, liveSourceCommit: "d".repeat(40) }).includes("live source identity mismatch"));
assert.ok(validateFinalBrowserAcceptance({ ...accepted, twoTabContinuity: false } as never).includes("session continuity failed"));
console.log("block24 build118 authenticated visible-Chrome acceptance contract: PASS");
