import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const panel=read("artifacts/bimlog/src/pages/AdminPanel.tsx"),directory=read("artifacts/bimlog/src/lib/capability-directory.ts"),routes=read("artifacts/api-server/src/routes/admin.ts");
assert.match(directory,/id: "admin-projects"[\s\S]*href: "\/admin\?tab=projects"/); assert.equal((directory.match(/id: "admin-projects"/g)||[]).length,1);
for(const token of ["requested === \"projects\"","Loading administered projects","No projects are currently","role=\"alert\"","dependent records were preserved","evidence was recorded"])assert.match(panel,new RegExp(token));
for(const route of [/router\.get\("\/admin\/projects"/,/router\.patch\("\/admin\/projects\/:id"/,/router\.delete\("\/admin\/projects\/:id"/,/router\.post\("\/admin\/projects\/:id\/transfer"/])assert.match(routes,route);
console.log("P023 admin projects parity checks passed");
