import assert from "node:assert/strict";
import fs from "node:fs";
import { dashboardCardDestination } from "./dashboard-card-inventory";

assert.equal(dashboardCardDestination("files-processed"), "/pending?type=files");
assert.equal(dashboardCardDestination("open-rfis"), "/pending?type=rfis");
assert.equal(dashboardCardDestination("pending-submittals"), "/pending?type=submittals");
for (const id of ["active-projects", "compliance-rate", "total-clashes", "open-clashes"]) assert.equal(dashboardCardDestination(id), "/dashboard#headquarters-project-register");
const source = fs.readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
assert.match(source, /const openDashboardCard = \(id: string\)/);
assert.match(source, /document\.getElementById\(anchor\)\?\.scrollIntoView/);
assert.match(source, /id="headquarters-project-register"/);
assert.match(source, /openDashboardCard\("files-processed"\)/);
assert.match(source, /Review file records.*Revisar registros de archivos/s);
assert.doesNotMatch(source, /setLocation\("\/projects"\)/, "dashboard cards must not navigate to the nonexistent aggregate route");
console.log("ACTIONABLE_DASHBOARD_CARDS_P017=PASS");
