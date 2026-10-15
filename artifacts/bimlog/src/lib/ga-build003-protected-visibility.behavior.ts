import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
assert.match(dashboard, /const \[projectSearch, setProjectSearch\] = useState\(""\)/);
assert.match(dashboard, /const \[projectStatus, setProjectStatus\] = useState\("active"\)/);
assert.match(dashboard, /JSON\.stringify\(\{ sort: projectSort \}\)/);
assert.doesNotMatch(dashboard, /JSON\.stringify\(\{ search: projectSearch, status: projectStatus/);

console.log("B_GA003=PASS defaultRoster=active staleVisibilityFilters=false");
