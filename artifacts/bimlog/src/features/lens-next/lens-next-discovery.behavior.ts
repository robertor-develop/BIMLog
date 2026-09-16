import assert from "node:assert/strict";
import { filterLensNextIssues } from "./lens-next-model";
import { LENS_NEXT_DEFAULT_FILTERS, type LensNextIssue } from "./lens-next-types";
const issue={identity:{serverId:7,projectId:1,viewpointId:"VIEW-Á01",revisionNumber:1,lifecycleStatus:"active",supersedesId:null},displayId:"CL-007",note:"Duct conflict",openItems:null,trade:"HVAC",floor:"Level 02",responsibleCompany:"BIMTech",reportType:"Coordination",status:"open",priority:1} as LensNextIssue;
assert.equal(filterLensNextIssues([issue],{...LENS_NEXT_DEFAULT_FILTERS,search:"duct hvac level 02"}).length,1);
assert.equal(filterLensNextIssues([issue],{...LENS_NEXT_DEFAULT_FILTERS,search:"view a01"}).length,1);
assert.equal(filterLensNextIssues([issue],{...LENS_NEXT_DEFAULT_FILTERS,search:"duct plumbing"}).length,0);
console.log("Lens Next discovery search: PASS");
