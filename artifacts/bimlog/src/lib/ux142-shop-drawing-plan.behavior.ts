import assert from "node:assert/strict";
import { deriveShopDrawingPackages } from "./shop-drawing-delivery";
const levels=[{id:"L1",buildingId:"B",code:"L01",name:"Level 1"},{id:"L2",buildingId:"B",code:"L02",name:"Level 2"}];
const disciplines=[{id:"M",code:"M",name:"Mechanical"},{id:"E",code:"E",name:"Electrical"}];
const first=deriveShopDrawingPackages({scopeItemId:"S",levels,disciplines});
assert.equal(first.length,4); assert.equal(new Set(first.map(row=>row.id)).size,4);
assert.equal(deriveShopDrawingPackages({scopeItemId:"S",levels,disciplines,existing:first}).length,4);
assert.equal(deriveShopDrawingPackages({scopeItemId:"S",levels:[levels[0]],disciplines:[disciplines[0]]}).length,1);
console.log("UX142_RESULT=PASS selected floors and disciplines create stable shop-drawing packages without duplicate Cartesian expansion");
