import assert from "node:assert/strict";
import { lensNextProjectIdFromSearch, lensNextReturnPathFromSearch, resolveLensNextLaunchProject } from "./lens-next-launch-binding.ts";
const projects=[{id:35,name:"Tremont",code:"PRO-521"}];
assert.equal(lensNextProjectIdFromSearch("?projectId=35&from=%2Fprojects%2F35"),35);
assert.equal(lensNextReturnPathFromSearch("?from=%2Fprojects%2F35"),"/projects/35");
assert.equal(lensNextReturnPathFromSearch("?from=https%3A%2F%2Fevil.test"),null);
assert.equal(resolveLensNextLaunchProject(projects,null,null,"browser").status,"select_project");
assert.equal(resolveLensNextLaunchProject(projects,35,null,"browser").projectId,35);
console.log("PASS UX061 project-aware Lens entry and return");
