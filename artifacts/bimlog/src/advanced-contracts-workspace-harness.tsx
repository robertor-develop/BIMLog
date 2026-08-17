import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Route } from "wouter";
import { FinancialContractWorkspace } from "@/pages/FinancialContractWorkspace";
import { I18nProvider } from "@/lib/i18n";
import { ConfigProvider } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import "@/index.css";

const params=new URLSearchParams(location.search),mode=params.get("mode")??"history",language=params.get("lang")==="es"?"es":"en";
const user={id:7701,email:"contracts.fixture@bimlog.test",fullName:"Contracts Fixture Reviewer",companyName:"BIMLog Fixture Company",companyId:77,createdAt:"2026-08-16T00:00:00.000Z"};
localStorage.setItem("bimlog-lang",language);useAuthStore.persist.setOptions({storage:{getItem:()=>null,setItem:()=>undefined,removeItem:()=>undefined}});useAuthStore.getState().setAuth("isolated-authenticated-fixture",user);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const contract={id:"contract-77",bimlogId:"BL-C-77",legalNumber:"SC-077",title:"Attributable payment fixture",counterpartyName:"Fixture Trade",perspective:"downstream",contractType:"subcontract",currency:"USD",originalValue:"100.000000",executedAmendmentTotal:"0.000000",currentCommitment:"100.000000",status:"executed",budgetSnapshotId:null,versionId:"contract-version-1",revision:1,contentFingerprint:"contract-fixture-fingerprint",approvedAt:"2026-08-15T12:00:00Z",executedAt:"2026-08-15T13:00:00Z"};
const line={id:"sov-row-1",stableLineId:"SOV-001",projectCode:"P-077",projectName:"Fixture project",description:"Concrete work",amount:"100.000000",budgetAmount:"100.000000",contractItem:{displayName:"Concrete work",quantity:"1",unit:"LS",unitRate:"100.000000",workflowTemplate:"standard",industryTemplate:"construction"},schedule:null};
const paymentHistory=[
 {actorUserId:7701,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-001",eventType:"payment_application_created",beforeState:null,afterState:"draft",reasonCode:"PAYMENT_CREATED",evidence:{revision:1},occurredAt:"2026-08-16T12:00:00Z"},
 {actorUserId:7702,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-001",eventType:"payment_application_return",beforeState:"submitted",afterState:"returned",reasonCode:"PAYMENT_RETURNED",evidence:{revision:3,outcomeReason:"Correct quantity evidence"},occurredAt:"2026-08-16T12:10:00Z"},
 {actorUserId:7701,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-002",eventType:"payment_application_revised",beforeState:"returned",afterState:"draft",reasonCode:"PAYMENT_REVISED",evidence:{revision:1,supersededPaymentVersionId:"payment-version-001"},occurredAt:"2026-08-16T12:20:00Z"},
 {actorUserId:7703,paymentApplicationId:"payment-root-001",paymentVersionId:"payment-version-002",eventType:"payment_application_approved",beforeState:"submitted",afterState:"approved",reasonCode:"PAYMENT_APPROVED",evidence:{revision:4},occurredAt:"2026-08-16T12:30:00Z"},
];
const payment=(submitted=false)=>({id:"payment-root-001",applicationNumber:"PAY-001",paymentVersionId:"payment-version-002",supersedesId:"payment-version-001",version:2,revision:submitted?5:4,status:submitted?"submitted":"draft",periodStart:"2026-08-01",periodEnd:"2026-08-15",currency:"USD",grossAmount:"50.000000",retainageAmount:"5.000000",netAmount:"45.000000",contentFingerprint:submitted?"reloaded-authoritative-fingerprint":"stale-fixture-fingerprint",preparedById:7701,reviewedById:null,approvedById:null,submittedAt:submitted?"2026-08-16T13:00:00Z":null,reviewedAt:null,approvedAt:null,outcomeReason:null,lines:[{id:"payment-line-1",contractSovLineId:"sov-row-1",currentAmount:"50.000000",sortOrder:0}]});
let paymentGets=0;const calls:{path:string;authorization:string|null}[]=[];(window as any).__BIMLOG_CONTRACT_HARNESS__={calls,mode};
window.fetch=async(input,init)=>{const raw=typeof input==="string"?input:input instanceof URL?input.toString():input.url,path=new URL(raw,location.origin).pathname,authorization=new Headers(init?.headers??(input instanceof Request?input.headers:undefined)).get("Authorization");calls.push({path,authorization});
 if(path==="/api/v1/config")return json({member_role:[{value:"member",label:"Member",labelEs:"Miembro",meta:{permission:"read"}}]});
 if(path==="/api/v1/projects/77")return json({id:77,name:"Fixture project",description:"Isolated routed UI evidence",code:"P-077",status:"active",createdById:7701,createdAt:"2026-08-01T00:00:00Z",updatedAt:"2026-08-16T00:00:00Z"});
 if(path==="/api/v1/projects/77/members")return json([{id:1,projectId:77,userId:7701,userFullName:user.fullName,userEmail:user.email,userCompanyName:user.companyName,role:"member",joinedAt:"2026-08-01T00:00:00Z"}]);
 if(path==="/api/v1/projects/77/financial/contracts"){
   if(mode==="denied")return json({code:"FINANCE_AUTHORITY_REQUIRED",error:{en:"Authenticated contract access denied.",es:"Acceso autenticado a contratos denegado."}},403);
   if(mode==="suspended")return json({code:"FINANCE_AUTHORITY_SUSPENDED",error:{en:"Authenticated financial authority is suspended.",es:"La autoridad financiera autenticada está suspendida."}},403);
   return json({contracts:[contract]});
 }
 if(path==="/api/v1/projects/77/financial/workspace")return json({snapshots:[]});
 if(path==="/api/v1/projects/77/financial/apu")return json({data:{plan:null}});
 if(path==="/api/v1/projects/77/financial/contracts/contract-77")return json({detail:{lines:[line],amendments:[],history:paymentHistory}});
 if(path==="/api/v1/projects/77/financial/contracts/contract-77/payments"&&(!init?.method||init.method==="GET")){paymentGets++;return json({payments:[payment(paymentGets>1)]});}
 if(path.endsWith("/payments/payment-root-001/actions"))return json({code:"CONTRACT_PAYMENT_STALE_REVISION",error:{en:"The payment state changed on the server.",es:"El estado del pago cambió en el servidor."}},409);
 return json({code:"HARNESS_UNHANDLED",error:{en:`No fixture for ${path}`,es:`Sin datos para ${path}`}},501);
};
window.history.replaceState(null,"",`/projects/77/financial/contracts?mode=${mode}&lang=${language}&fixture=isolated-routed-workspace`);
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><I18nProvider><ConfigProvider><WouterRouter><Route path="/projects/:id/financial/contracts"><FinancialContractWorkspace/></Route></WouterRouter></ConfigProvider></I18nProvider></QueryClientProvider>);
