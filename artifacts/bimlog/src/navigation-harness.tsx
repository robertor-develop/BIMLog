import {FeaturePolicySettingsPanel} from "./components/settings/FeaturePolicySettingsPanel";
import {useState} from "react";
import {createRoot} from "react-dom/client";
import {Router} from "wouter";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {I18nProvider,useI18n} from "./lib/i18n";
import {ConfigProvider} from "./lib/config-context";
import {ProjectLocation} from "./components/layout/ProjectLocation";
import {ProjectHome} from "./components/layout/ProjectHome";
import {FinancialContractWorkspace} from "./pages/FinancialContractWorkspace";
import {MasterSidebar} from "./components/layout/MasterSidebar";
import {useAuthStore} from "./store/auth";
import "./index.css";
if(!import.meta.env.DEV || !["localhost","127.0.0.1"].includes(location.hostname))throw new Error("Local fixture only");
let mode="draft";
let policyRequests=0;
useAuthStore.setState({token:"local-only",user:{id:1,fullName:"Fixture manager",email:"fixture@example.test",companyName:"Fixture BIM"} as any});
window.fetch=async(input)=>{
 const path=String(input);
 if(path.endsWith("/features/policies/capabilities"))return Response.json({companyPolicyAdmin:false,superAdminMetadataOnly:false,projects:[{id:1,name:"Legacy fixture",active:true,bindingRequired:true,canConfigure:false},{id:1,name:"Legacy fixture",active:true,bindingRequired:true,canConfigure:false},{id:2,name:"Bound fixture",active:true,bindingRequired:false,canConfigure:true},{id:2,name:"Bound fixture",active:true,bindingRequired:false,canConfigure:true}]});
 if(path.endsWith("/features/preferences"))return Response.json({preferences:[]});
 if(path.includes("/features/policies/projects/")){policyRequests++;return path.endsWith("/1")?Response.json({code:"PROJECT_COMPANY_BINDING_REQUIRED"},{status:409}):Response.json({policies:[]});}

 if(path.includes("/access-profile"))return Response.json({decisions:{project_administration:{allow:false},company_catalogs:{allow:false},total_control:{allow:false}}});
 if(path.includes("/intake")){if(mode==="error")return Response.json({},{status:503});if(mode==="loading")return new Promise(()=>{});return Response.json({status:mode});}
 if(path.endsWith("/projects/1"))return Response.json({id:1,name:"Fixture project",code:"UX-04"});
 if(path.endsWith("/members"))return Response.json([{userId:1,role:"project_admin",userFullName:"Fixture manager"}]);
 if(path.includes("/financial/contracts/fixture-contract"))return Response.json({detail:{lines:[],amendments:[],history:[]}});
 if(path.endsWith("/financial/contracts"))return Response.json({contracts:[{id:"fixture-contract",legalNumber:"TEST-004",title:"Exact linked contract",counterpartyName:"Fixture BIM",status:"draft",currency:"USD",originalValue:"30",currentCommitment:"30",executedAmendmentTotal:"0",contentFingerprint:"fixture",perspective:"downstream",contractType:"subcontract",permissions:[]} ]});
 if(path.includes("/financial/"))return Response.json({snapshots:[],data:{plan:null}});
 if(path.includes("/search?"))return Response.json({projects:[{id:1,projectId:1,label:"UX-04 - Fixture project",type:"project"}],files:[],rfis:[{id:7,projectId:1,label:"RFI-007 - Fixture drawing",type:"rfi",source:"UX-04"}],submittals:[],transmittals:[],change_orders:[],meetings:[],action_items:[],people:[]});
 if(path.endsWith("/users/me")||path.endsWith("/auth/me"))return Response.json({id:1,fullName:"Fixture manager"});
 if(path.includes("company-profile"))return Response.json({companyName:"Fixture BIM"});
 if(path.includes("/config"))return Response.json({});
 return Response.json([]);
};
function Harness(){const {lang,setLang}=useI18n();const [screen,setScreen]=useState("context"),[role,setRole]=useState("project_admin"),[rev,setRev]=useState(0),[destination,setDestination]=useState("/projects/1/financial/contracts"),[query,setQuery]=useState("contractId=fixture-contract&returnTo="+encodeURIComponent("/projects/1/intake?stage=delivery&item=ji-delivery"));
return <main style={{padding:16}}><h1>Local navigation fixture - actual components</h1><button onClick={()=>setLang(lang==="es"?"en":"es")}>English / Español</button><label>Screen<select onChange={e=>{setScreen(e.target.value);setDestination("/projects/1/financial/contracts");}}>{["context","home","contract","search","policy"].map(v=><option key={v}>{v}</option>)}</select></label><label>State<select onChange={e=>{mode=e.target.value;setRev(n=>n+1);setDestination("/projects/1");}}>{["draft","activated","error","loading"].map(v=><option key={v}>{v}</option>)}</select></label><label>Role<select onChange={e=>{setRole(e.target.value);setDestination("/projects/1");}}>{["project_admin","discipline_lead","member","read_only"].map(v=><option key={v}>{v}</option>)}</select></label><label>Query<input value={query} onChange={e=>setQuery(e.target.value)}/></label><output aria-label="Destination">{destination}</output><Router hook={()=>[destination,setDestination]} searchHook={()=>query}><section key={`${screen}-${rev}`}>
{screen==="context"&&<ProjectLocation projectId={1} projectName="Fixture project" location={lang==="es"?"Convenciones":"Convention Builder"}/>}
{screen==="home"&&<ProjectHome projectId={1} role={role}/>}
{screen==="contract"&&<FinancialContractWorkspace/>}
{screen==="search"&&<MasterSidebar/>}
{screen==="policy"&&<><button onClick={e=>{e.currentTarget.textContent=`Policy requests: ${policyRequests}`;}}>Show policy request count</button><FeaturePolicySettingsPanel/></>}
</section></Router></main>}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><I18nProvider><ConfigProvider><Harness/></ConfigProvider></I18nProvider></QueryClientProvider>);
