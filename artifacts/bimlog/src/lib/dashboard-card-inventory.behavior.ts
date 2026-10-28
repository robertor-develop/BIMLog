import assert from "node:assert/strict";
import fs from "node:fs";
import { dashboardCardDestination, dashboardCardInventory } from "./dashboard-card-inventory";

assert.equal(new Set(dashboardCardInventory.map(card => card.id)).size, dashboardCardInventory.length);
assert.ok(dashboardCardInventory.length >= 19, "inventory must cover operational, onboarding, stat, activity, and project cards");
assert.ok(dashboardCardInventory.every(card => card.source && card.destination && card.evidence));
assert.ok(dashboardCardInventory.every(card => ["records", "action", "guided"].includes(card.kind)));
assert.equal(dashboardCardDestination("open-rfis"), "/pending?type=rfis");
assert.equal(dashboardCardDestination("files-processed"), "/pending?type=files");
assert.throws(() => dashboardCardDestination("missing"), /Unknown dashboard card/);
const source = fs.readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
for (const label of ["Active Projects", "Files Processed", "Open RFIs", "Pending Submittals", "Compliance Rate", "Total Clashes", "Open Clashes", "Submittal Tracking", "Open Submittals"]) assert.match(source, new RegExp(label, "i"));
console.log(`DASHBOARD_CARD_INVENTORY_P016=PASS cards=${dashboardCardInventory.length}`);
