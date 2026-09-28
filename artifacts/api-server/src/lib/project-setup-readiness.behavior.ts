import assert from "node:assert/strict";
import { projectSetupReadiness, type SetupReadinessCheck } from "./project-setup-readiness";

const checks: SetupReadinessCheck[] = [
  { key: "catalogs", scope: "core", required: true, ready: true, detail: "Canonical catalogs resolved." },
  { key: "templates", scope: "core", required: true, ready: true, detail: "Published workflow selected." },
  { key: "budget", scope: "commercial", required: true, ready: false, detail: "Budget remains optional for core activation." },
  { key: "providers", scope: "integration", required: false, ready: false, detail: "Optional provider is not configured." },
  { key: "lens_company", scope: "integration", required: true, ready: true, detail: "Responsible company resolves canonically." },
];
const first = projectSetupReadiness({ projectId: 60, revision: 7, checks });
const reopened = projectSetupReadiness(JSON.parse(JSON.stringify({ projectId: 60, revision: 7, checks })));
assert.deepEqual(reopened, first);
assert.equal(first.coreReady, true);
assert.equal(first.commercialReady, false);
assert.equal(first.lensReady, true, "optional provider gap must not block Lens or core work");
assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
assert.throws(() => projectSetupReadiness({ projectId: 60, revision: 7, checks: [...checks, checks[0]] }), /SETUP_READINESS_CHECK_INVALID/);
console.log("C024 resumable project setup readiness: PASS");
