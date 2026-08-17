import { RelayProtocolError, assertReceiptMatchesRequest, verifyReceiptDurably, type DurableReceiptVerification, type ReceiptContract, type RelayKeyRing, type RequestContract, type Signed } from "./protocol.js";

export type DeliveryResolution={receipt:Signed<ReceiptContract>;verification:DurableReceiptVerification;resolution:"already-receipted"|"delivered"|"lost-response-recovered";bytesSent:boolean};
export async function deliverWithReceiptResolution(input:{request:RequestContract;destinationId:string;receiverKeys:RelayKeyRing;now?:Date;lookupReceipt:()=>Promise<Signed<ReceiptContract>|null>;send:()=>Promise<Signed<ReceiptContract>>;recordVerification?:(verification:DurableReceiptVerification)=>Promise<void>}):Promise<DeliveryResolution>{
  const validate=async(receipt:Signed<ReceiptContract>)=>{const verification=verifyReceiptDurably(receipt,input.receiverKeys,input.now);assertReceiptMatchesRequest(receipt.payload,input.request,input.destinationId);await input.recordVerification?.(verification);return{receipt,verification};};
  const existing=await input.lookupReceipt();if(existing)return{...await validate(existing),resolution:"already-receipted",bytesSent:false};
  try{return{...await validate(await input.send()),resolution:"delivered",bytesSent:true};}
  catch(error){const recovered=await input.lookupReceipt();if(recovered)return{...await validate(recovered),resolution:"lost-response-recovered",bytesSent:true};throw error instanceof Error?error:new RelayProtocolError("FEEDBACK_RELAY_TRANSPORT_FAILED","Feedback relay delivery failed");}
}
