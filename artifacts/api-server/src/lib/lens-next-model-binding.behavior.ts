import assert from "node:assert/strict";
import { normalizeLensNextModelKey, uniquePlatformProjectMatch } from "./lens-next-model-binding";

const projects = [
  { id: 26, name: "ELARA EAST", code: "ELA01", location: "1185 River Avenue" },
  { id: 35, name: "521 East Tremont", code: "521ET" },
];
assert.equal(normalizeLensNextModelKey("1185-river-av-model-06-11-26"), "1185-river-av-model-06-11-26");
assert.equal(uniquePlatformProjectMatch("1185-river-av-model-06-11-26", projects)?.id, 26);
assert.equal(uniquePlatformProjectMatch("521-east-tremont-federated", projects)?.id, 35);
assert.equal(uniquePlatformProjectMatch("unrelated-model", projects), null);
assert.equal(uniquePlatformProjectMatch("shared", [{ id: 1, name: "Shared", code: null }, { id: 2, name: "Shared", code: null }]), null);
assert.throws(() => normalizeLensNextModelKey("../bad"));
console.log("PASS Lens Next Build 2 authoritative model-binding resolution");
