export type AmendmentReceipt={projectId:number;contractId:string;amendmentId:string;versionId:string;contentFingerprint:string;status:string;revision?:number;eventType:string;signedFileId?:number};
export function verifySavedAmendment(response:any,receipt:AmendmentReceipt){
 const detail=response?.detail;if(response?.projectId!==receipt.projectId||detail?.id!==receipt.contractId||!Array.isArray(detail.amendments)||!Array.isArray(detail.history))throw new Error("The amendment evidence is incomplete or belongs to another project or contract.");
 const row=detail.amendments.find((row:any)=>row.id===receipt.amendmentId&&row.versionId===receipt.versionId);
 if(!row||row.contentFingerprint!==receipt.contentFingerprint||row.status!==receipt.status||receipt.revision!==undefined&&row.revision!==receipt.revision)throw new Error("The exact saved amendment identity, fingerprint and state have not been reopened. Retry this read without another write.");
 if(!detail.history.some((event:any)=>event.amendmentId===receipt.amendmentId&&event.amendmentVersionId===receipt.versionId&&event.eventType===receipt.eventType))throw new Error("The exact amendment history event has not been reopened. Retry this read without another write.");
 if(receipt.status==="approved"&&(!row.approvedAt||!row.approvedById)||receipt.status==="executed"&&(!row.executedAt||!row.executedById||Number(row.signedFileId)!==receipt.signedFileId))throw new Error("Saved approval or signed-execution evidence is incomplete.");
 return detail;
}
