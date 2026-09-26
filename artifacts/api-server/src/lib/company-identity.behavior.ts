import assert from "node:assert/strict";
import { assertNewCompanyName, companyCollisionKey, resolveCompanyIdentity } from "./company-identity";
const rows = new Map([[31, {id:31,retiredIntoCompanyId:null}], [35,{id:35,retiredIntoCompanyId:31}]]);
assert.equal(await resolveCompanyIdentity(35, async id => rows.get(id)),31);
assert.equal(await resolveCompanyIdentity(31, async id => rows.get(id)),31);
await assert.rejects(resolveCompanyIdentity(38, async id => rows.get(id)),/MISSING/);
await assert.rejects(resolveCompanyIdentity(0, async id => rows.get(id)),/INVALID/);
rows.set(31,{id:31,retiredIntoCompanyId:35});
await assert.rejects(resolveCompanyIdentity(35, async id => rows.get(id)),/INVALID/);
for(const name of ["BIMTECH.","  bimtech ","ＢＩＭＴＥＣＨ", "BIM TECH", "BIM-TECH"]){
  assert.equal(companyCollisionKey(name),"bimtech");
  assert.throws(()=>assertNewCompanyName(name,["BIMTECH"]),/JOIN_REQUIRED/);
}
assertNewCompanyName("Distinct New Company",["BIMTECH"]);
assert.throws(()=>assertNewCompanyName(" . ",[]),/NAME_INVALID/);
console.log("company identity: alias, cycle, missing, punctuation, Unicode and new owner PASS");
