import assert from "node:assert/strict";
import { previewCompatibility, rollbackRollout, type RolloutState } from "./ux-reversible-rollout";

const requests = [
  { client: "web", path: "/setup-guide" },
  { client: "web", path: "/projects/58/submittal-tracker" },
  { client: "native-2021", path: "/api/v1/lens-next/local-upload" },
  { client: "native-2025", path: "/api/v1/lens-next/local-upload" },
] as const;
const preview = previewCompatibility(requests, ["/help?topic=getting-started&view=manual", "/projects/58/submittals?view=tracking", "/api/v1/lens-next/local-upload"], {
  "/setup-guide": "/help?topic=getting-started&view=manual",
  "/projects/58/submittal-tracker": "/projects/58/submittals?view=tracking",
});
assert.equal(preview.status, "compatible");
assert.equal(preview.writesPerformed, 0);
assert.deepEqual(preview.resolutions.map((item) => item.client), ["web", "web", "native-2021", "native-2025"]);
assert.equal(previewCompatibility([{ client: "web", path: "/removed" }], [], {}).status, "blocked");

const before: RolloutState = { version: "ux090", routeAliases: { "/setup-guide": "/help" }, enabledCohortIds: ["qa"], businessEventCursor: "event-100" };
const current: RolloutState = { version: "ux094", routeAliases: { "/setup-guide": "/help?view=manual" }, enabledCohortIds: ["qa", "pilot"], businessEventCursor: "event-128" };
assert.deepEqual(rollbackRollout(current, before), { ...before, businessEventCursor: "event-128" });
console.log("UX094 legacy compatibility and reversible rollout: PASS");
