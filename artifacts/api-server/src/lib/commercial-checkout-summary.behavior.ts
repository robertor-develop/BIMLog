import assert from "node:assert/strict";
import {readLatestPersistentCheckout} from "./commercial-persistence";

const queries:string[]=[];
const summary=await readLatestPersistentCheckout({query:async(text,values)=>{queries.push(text);assert.deepEqual(values,[7]);return {rowCount:1,rows:[{id:"checkout-123",order_id:"order-123",status:"completed",expires_at:"2026-10-10T12:00:00Z",completed_at:"2026-10-10T11:31:00Z",updated_at:"2026-10-10T11:31:00Z"}]};}},7);
assert.deepEqual(summary,{checkoutId:"checkout-123",orderId:"order-123",status:"completed",expiresAt:"2026-10-10T12:00:00.000Z",completedAt:"2026-10-10T11:31:00.000Z",updatedAt:"2026-10-10T11:31:00.000Z"});
assert.match(queries[0],/WHERE company_id=\$1 ORDER BY created_at DESC,id DESC LIMIT 1/);
assert.equal(await readLatestPersistentCheckout({query:async()=>({rowCount:0,rows:[]})},7),null);
await assert.rejects(()=>readLatestPersistentCheckout({query:async()=>({rowCount:1,rows:[{id:"checkout-123",order_id:"order-123",status:"unknown",expires_at:"2026-10-10T12:00:00Z",completed_at:null,updated_at:"2026-10-10T11:31:00Z"}]})},7),/status is invalid/);
console.log("LR051 persistent checkout summary acceptance: PASS");
