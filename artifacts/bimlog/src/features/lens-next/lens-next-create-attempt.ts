import type {LensNextCreateDraft,LensNextCreateReceipt} from "./lens-next-types";
export type LensNextCreationAttempt={fingerprint:string;viewpointId:string;navigation?:Record<string,unknown>;submitted?:boolean;receipt?:LensNextCreateReceipt};
export type LensNextCreationHolder={
 current:LensNextCreationAttempt|null;
 load?(fingerprint:string):LensNextCreationAttempt|null;
 save?(attempt:LensNextCreationAttempt|null):void;
};

async function creationFingerprint(input:{projectId:number;modelFingerprint:string;authorityKey:string;draft:LensNextCreateDraft;reason:string}) {
 const authorityBytes=new TextEncoder().encode(input.authorityKey);
 const authorityDigest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",authorityBytes))].map(value=>value.toString(16).padStart(2,"0")).join("");
 return JSON.stringify([input.projectId,input.modelFingerprint,authorityDigest,input.draft,input.reason]);
}
export async function executeLensNextCreation(
  holder:LensNextCreationHolder,
  input:{projectId:number;modelFingerprint:string;authorityKey:string;draft:LensNextCreateDraft;reason:string},
  operations:{capture(viewpointId:string):Promise<Record<string,unknown>>;create(viewpointId:string,navigation:Record<string,unknown>):Promise<LensNextCreateReceipt>;reopen(receipt:LensNextCreateReceipt):Promise<boolean>;isCurrent():boolean;newIdentity():string},
){
 const fingerprint=await creationFingerprint(input);
 if(!holder.current&&holder.load)holder.current=holder.load(fingerprint);
 if(holder.current&&holder.current.fingerprint!==fingerprint)throw new Error("A previous creation outcome is pending. Inspect that project and retry the unchanged draft before starting another creation.");
 const attempt=holder.current??{fingerprint,viewpointId:operations.newIdentity(),submitted:false};holder.current=attempt;holder.save?.(attempt);
 if(!attempt.receipt&&!attempt.navigation){
  try{attempt.navigation=await operations.capture(attempt.viewpointId);}
  catch(error){if(holder.current===attempt&&!attempt.receipt&&attempt.submitted===false){holder.current=null;holder.save?.(null);}throw error;}
 }
 if(!operations.isCurrent()){
  if(holder.current===attempt&&attempt.submitted===false&&!attempt.receipt){holder.current=null;holder.save?.(null);}
  if(attempt.submitted!==false||attempt.receipt)throw new Error("Project or session changed. A previous creation outcome remains pending in its original project; return there and retry the unchanged draft.");
  throw new Error("Project or session changed during capture. No creation was submitted; return to the original context before retrying.");
 }
 if(!attempt.receipt){attempt.submitted=true;holder.save?.(attempt);attempt.receipt=await operations.create(attempt.viewpointId,attempt.navigation!);holder.save?.(attempt);}
 if(!operations.isCurrent())throw new Error(`Issue #${attempt.receipt.serverId} was saved in its original project. Reopen that project before another creation.`);
 if(!await operations.reopen(attempt.receipt))throw new Error(`Issue #${attempt.receipt.serverId} was saved, but its refreshed record could not be verified. Retry the unchanged draft to reopen it; do not create a duplicate.`);
 const receipt=attempt.receipt;holder.current=null;holder.save?.(null);return receipt;
}
