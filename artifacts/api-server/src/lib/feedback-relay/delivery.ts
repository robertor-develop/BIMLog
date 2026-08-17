import { RelayProtocolError, assertReceiptMatchesRequest, verifyReceipt, type ReceiptContract, type RelayKeyRing, type RequestContract, type Signed } from "./protocol.js";

export type DeliveryResolution={receipt:Signed<ReceiptContract>;resolution:"already-receipted"|"delivered"|"lost-response-recovered";bytesSent:boolean};
export async function deliverWithReceiptResolution(input:{request:RequestContract;destinationId:string;receiverKeys:RelayKeyRing;now?:Date;lookupReceipt:()=>Promise<Signed<ReceiptContract>|null>;send:()=>Promise<Signed<ReceiptContract>>}):Promise<DeliveryResolution>{
  const validate=(receipt:Signed<ReceiptContract>)=>{verifyReceipt(receipt,input.receiverKeys,input.now);assertReceiptMatchesRequest(receipt.payload,input.request,input.destinationId);return receipt;};
  const existing=await input.lookupReceipt();if(existing)return{receipt:validate(existing),resolution:"already-receipted",bytesSent:false};
  try{return{receipt:validate(await input.send()),resolution:"delivered",bytesSent:true};}
  catch(error){const recovered=await input.lookupReceipt();if(recovered)return{receipt:validate(recovered),resolution:"lost-response-recovered",bytesSent:true};throw error instanceof Error?error:new RelayProtocolError("FEEDBACK_RELAY_TRANSPORT_FAILED","Feedback relay delivery failed");}
}
