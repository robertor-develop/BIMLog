import type {LensNextLocalUploadReceipt} from "./lens-next-types";
export type LensNextUploadAttempt={key:string;receipt?:LensNextLocalUploadReceipt};
export async function executeLensNextUpload(holder:{current:LensNextUploadAttempt|null},key:string,operations:{upload():Promise<LensNextLocalUploadReceipt>;reopen(receipt:LensNextLocalUploadReceipt):Promise<boolean>;isCurrent():boolean}){
 if(holder.current&&holder.current.key!==key)throw new Error("A prior local upload outcome is pending. Reopen its project before uploading another viewpoint.");
 const attempt=holder.current??{key};holder.current=attempt;
 if(!operations.isCurrent())throw new Error("Project/model context changed; upload not submitted.");
 if(!attempt.receipt)attempt.receipt=await operations.upload();
 if(!operations.isCurrent())throw new Error(`Issue #${attempt.receipt.serverId} was saved in the original project. Reopen that project before another upload.`);
 if(!await operations.reopen(attempt.receipt))throw new Error(`Issue #${attempt.receipt.serverId} was saved, but its record could not be reopened. Retry the same local viewpoint to verify it without uploading again.`);
 const receipt=attempt.receipt;holder.current=null;return receipt;
}
