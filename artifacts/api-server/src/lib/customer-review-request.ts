export type CustomerReviewRequest={requestId:string;sourceId:string;sourceVersion:string;projectId:number;companyId:number;actorUserId:number;message:string;createdAt:string;effect:"comment_only"};
export function createCustomerReviewRequest(input:Omit<CustomerReviewRequest,"effect">){if(!input.message.trim())throw new Error("CUSTOMER_REVIEW_MESSAGE_REQUIRED");return Object.freeze({...input,message:input.message.trim(),effect:"comment_only" as const});}
export function reviewRequestCanApprove(_:CustomerReviewRequest){return false;}
