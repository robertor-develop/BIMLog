import assert from "node:assert/strict";
import { isProviderOperationCurrentlyAllowed } from "./provider-governance";

const active=new Map<number,boolean>([[31,true],[38,true]]);
const grants=new Map<number,boolean>([[31,true]]);
const db={async query(_sql:string,values:unknown[]=[]){
  const company=Number(values[0]);
  return {rows:active.get(company)?[{id:company,enabled:grants.get(company)===true}]:[]};
}};
assert.equal(await isProviderOperationCurrentlyAllowed("procore",31,"browse",db),true);
grants.set(31,false);
assert.equal(await isProviderOperationCurrentlyAllowed("procore",31,"browse",db),false,"revocation takes effect without process restart");
active.set(31,false);
assert.equal(await isProviderOperationCurrentlyAllowed("procore",31,"browse",db),false,"retired company is denied");
assert.equal(await isProviderOperationCurrentlyAllowed("procore",38,"browse",db),false,"separate company remains denied");
assert.equal(await isProviderOperationCurrentlyAllowed("procore",null,"browse",db),false);
console.log("Current Procore company approval recheck, revocation, retirement, and company isolation: PASS");
