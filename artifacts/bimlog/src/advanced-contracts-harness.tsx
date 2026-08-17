import { createRoot } from "react-dom/client";
import { ContractPaymentApplicationsPanel } from "./components/commercial/ContractPaymentApplicationsPanel";
import { financialContractWorkspaceStyles } from "./pages/FinancialContractWorkspace";
import { ContractPaymentHistoryPanel } from "./components/commercial/ContractPaymentHistoryPanel";
import "./index.css";

const params=new URLSearchParams(location.search),language=params.get("lang")==="es"?"es":"en",initial=params.get("state")??"empty";
const tt=(en:string,es:string)=>language==="es"?es:en;
const sov=[{id:"display-line-id",contractSovLineId:"sov-fk-001",stableLineId:"SOV-001",description:"Concrete foundations",amount:"100",contractItem:{displayName:"Concrete foundations"}}];
let revision=1,status=initial==="empty"?"":initial==="loading"?"":"draft",version=1,reviewedById:number|null=null,outcomeReason:string|null=null;
const payment=()=>({id:"payment-001",applicationNumber:"PAY-001",paymentVersionId:`payment-version-${version}`,supersedesId:version>1?"payment-version-1":null,version,revision,status,periodStart:"2026-08-01",periodEnd:"2026-08-15",currency:"USD",grossAmount:"50",retainageAmount:"5",netAmount:"45",contentFingerprint:`fingerprint-${version}`,preparedById:101,reviewedById,approvedById:status==="approved"?103:null,submittedAt:revision>1?"2026-08-16T12:00:00Z":null,reviewedAt:reviewedById?"2026-08-16T12:05:00Z":null,approvedAt:status==="approved"?"2026-08-16T12:10:00Z":null,outcomeReason,lines:[{id:"payment-line-1",contractSovLineId:"sov-fk-001",currentAmount:"50",sortOrder:0}]});
const json=(body:unknown,code=200)=>new Response(JSON.stringify(body),{status:code,headers:{"Content-Type":"application/json"}});
window.fetch=async(input,init)=>{const path=new URL(typeof input==="string"?input:input instanceof URL?input.toString():input.url,location.origin).pathname;
 if(initial==="loading")return new Promise<Response>(()=>{});
 if(initial==="error")return json({code:"CONTRACT_PAYMENT_UNAVAILABLE",error:{message:"Authoritative payment state is unavailable."}},500);
 if(initial==="denied"||initial==="suspended")return json({code:initial==="suspended"?"FINANCIAL_AUTHORITY_SUSPENDED":"FINANCIAL_PERMISSION_DENIED"},403);
 if(path.endsWith("/payments")&&(!init?.method||init.method==="GET"))return json({payments:status?[payment()]:[]});
 if(path.endsWith("/payments")&&init?.method==="POST"){status="draft";revision=1;return json(payment(),201)}
 if(path.endsWith("/revisions")){version++;revision=1;status="draft";reviewedById=null;outcomeReason=null;return json(payment(),201)}
 const body=JSON.parse(String(init?.body??"{}"));
 if(initial==="stale")return json({code:"CONTRACT_PAYMENT_STALE"},409);
 if(initial==="conflict")return json({code:"CONTRACT_PAYMENT_IDEMPOTENCY_CONFLICT"},409);
 if(initial==="cumulative")return json({code:"CONTRACT_PAYMENT_SOV_EXCEEDED"},409);
 if(path.endsWith("/approve")){status="approved";revision++;return json(payment())}
 if(path.endsWith("/actions")){status=body.action==="review"?"submitted":body.action==="return"?"returned":body.action==="reject"?"rejected":body.action==="withdraw"?"withdrawn":body.action==="void"?"voided":"submitted";if(body.action==="review")reviewedById=102;if(body.reason)outcomeReason=body.reason;revision++;return json(payment())}
 return json({code:"NOT_FOUND"},404);
};
const historyMode=params.get("history"),history=[{actorUserId:101,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-001",eventType:"payment_application_created",beforeState:null,afterState:"draft",reasonCode:"created",evidence:{revision:1},occurredAt:"2026-08-16T12:00:00Z"},{actorUserId:102,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-001",eventType:"payment_application_return",beforeState:"submitted",afterState:"returned",reasonCode:"returned",evidence:{revision:3,outcomeReason:"Revise exact quantity evidence"},occurredAt:"2026-08-16T12:10:00Z"},{actorUserId:101,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-002",eventType:"payment_application_revised",beforeState:"returned",afterState:"draft",reasonCode:"revised",evidence:{revision:1,supersededPaymentVersionId:"payment-version-001"},occurredAt:"2026-08-16T12:20:00Z"},{actorUserId:103,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-002",eventType:"payment_application_approved",beforeState:"submitted",afterState:"approved",reasonCode:"approved",evidence:{revision:4},occurredAt:"2026-08-16T12:30:00Z"},{actorUserId:102,paymentApplicationId:"payment-root-002",paymentVersionId:"payment-version-003",eventType:"payment_application_reject",beforeState:"submitted",afterState:"rejected",reasonCode:"rejected",evidence:{revision:3,outcomeReason:"Rejected incomplete supporting evidence"},occurredAt:"2026-08-16T12:40:00Z"}];
createRoot(document.getElementById("root")!).render(<main className="fc-page"><style>{financialContractWorkspaceStyles}</style>{historyMode?<ContractPaymentHistoryPanel history={historyMode==="empty"?[]:history} language={language} tt={tt} error={historyMode==="denied"?"denied":historyMode==="suspended"?"suspended":undefined}/>:<ContractPaymentApplicationsPanel projectId={77} contract={{id:"contract-77",currency:"USD",status:"executed"}} lines={sov} token="isolated-ui-token" language={language} tt={tt}/>}</main>);
