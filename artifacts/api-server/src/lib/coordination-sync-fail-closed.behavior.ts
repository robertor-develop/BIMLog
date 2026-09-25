import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../routes/coordination.ts", import.meta.url), "utf8");
const guard = route.indexOf('destinationAction === "queued_sync"');
const eventWrite = route.indexOf("db.insert(coordinationIntakeEventsTable).values({", guard);
assert.ok(guard > 0 && eventWrite > guard, "Queued sync must be rejected before durable event creation");
assert.match(route.slice(guard, eventWrite), /COORDINATION_SYNC_NOT_CONFIGURED/);
assert.doesNotMatch(route.slice(guard, eventWrite), /fileCache\.delete\(cacheKey\)/);
const ui = readFileSync(new URL("../../../bimlog/src/pages/project/CoordinationHub.tsx", import.meta.url), "utf8");
assert.match(ui, /aria-describedby="coordination-sync-unavailable"/);
assert.match(ui, /SharePoint sync is not configured yet/);
console.log("Coordination sync refuses false success without losing staged bytes: PASS");
