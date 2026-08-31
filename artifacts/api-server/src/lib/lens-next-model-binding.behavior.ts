import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeLensNextModelKey, selectSingleAuthorizedLensNextBinding } from "./lens-next-model-binding";

assert.equal(normalizeLensNextModelKey("1185-river-av-model-06-11-26"), "1185-river-av-model-06-11-26");
assert.throws(() => normalizeLensNextModelKey("../bad"));
assert.equal(selectSingleAuthorizedLensNextBinding([26], [23, 26, 27, 35]), 26);
assert.equal(selectSingleAuthorizedLensNextBinding([30], [23, 26, 27, 35]), null);
assert.equal(selectSingleAuthorizedLensNextBinding([26, 35], [23, 26, 27, 35]), null);
assert.equal(selectSingleAuthorizedLensNextBinding([26, 26], [26]), 26);
const routeSource = readFileSync(fileURLToPath(new URL("../routes/projects.ts", import.meta.url)), "utf8");
assert.doesNotMatch(routeSource, /uniquePlatformProjectMatch|unique_platform_identity/);
assert.match(routeSource, /explicitProjectId/);
assert.match(routeSource, /explicit_project_not_authorized/);
assert.match(routeSource, /projectId: null, modelBindingKey, source: "explicit_user_selection_required"/);
assert.match(routeSource, /selectSingleAuthorizedLensNextBinding/);
console.log("PASS Lens Next authoritative model-binding resolution requires exact authority and keeps same-model projects distinct");
