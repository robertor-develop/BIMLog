import assert from "node:assert/strict";
import {CommercialHostedDestinationError,requestCommercialHostedDestination} from "./commercial-workspace-client";

const response=(status:number,body:unknown)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}}));
await assert.rejects(()=>requestCommercialHostedDestination({token:"token",action:"checkout",plan:"professional",cycle:"monthly",requestKey:"request-company-7",fetchImpl:async()=>response(503,{code:"CHECKOUT_PLATFORM_NOT_READY",error:"do not trust this text",blockers:["payment_provider_unavailable","bad-value",7]})}),(error:unknown)=>error instanceof CommercialHostedDestinationError&&error.code==="CHECKOUT_PLATFORM_NOT_READY"&&error.message==="CHECKOUT_PLATFORM_NOT_READY"&&JSON.stringify(error.blockers)==='["payment_provider_unavailable"]');
await assert.rejects(()=>requestCommercialHostedDestination({token:"token",action:"checkout",fetchImpl:async()=>response(500,{code:"UNKNOWN",error:"provider detail"})}),(error:unknown)=>error instanceof CommercialHostedDestinationError&&error.code==="CHECKOUT_UNAVAILABLE");
assert.deepEqual(await requestCommercialHostedDestination({token:"token",action:"checkout",fetchImpl:async()=>response(201,{url:"https://checkout.stripe.com/c/pay/test"})}),{url:"https://checkout.stripe.com/c/pay/test"});
console.log("LR044 commercial hosted destination failures: PASS");
