import assert from "node:assert/strict";
import {readLatestSubscriptionLifecycle} from "./commercial-persistence";
const row={status:"past_due",plan_code:"team",billing_cycle:"annual",seat_quantity:5,started_at:"2026-10-01T12:00:00Z",canceled_at:null,updated_at:"2026-10-10T12:00:00Z"};
const client={query:async(text:string,values?:readonly unknown[])=>{assert.match(text,/ORDER BY created_at DESC LIMIT 1/);assert.deepEqual(values,[7]);return {rows:[row],rowCount:1};}};
assert.deepEqual(await readLatestSubscriptionLifecycle(client,7),{status:"past_due",plan:"team",billingCycle:"annual",seatQuantity:5,startedAt:row.started_at,canceledAt:null,updatedAt:row.updated_at});
assert.equal(await readLatestSubscriptionLifecycle({query:async()=>({rows:[],rowCount:0})},7),null);
await assert.rejects(()=>readLatestSubscriptionLifecycle({query:async()=>({rows:[{...row,status:"unknown"}],rowCount:1})},7),/lifecycle is invalid/);
console.log("Commercial subscription lifecycle behavior: PASS");
