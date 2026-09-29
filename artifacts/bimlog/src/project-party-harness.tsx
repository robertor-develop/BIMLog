import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ProjectPartyPicker } from "./components/ProjectPartyPicker";
import { MasterClassificationSelectors } from "./components/job-intake/MasterClassificationSelectors";
import { TransmittalsTab } from "./pages/project/TransmittalsTab";
import { ChangeOrdersTab } from "./pages/project/ChangeOrdersTab";
import { CompanyProfile } from "./pages/CompanyProfile";
import { useAuthStore } from "./store/auth";
import { ConfigProvider } from "./lib/config-context";
import "./index.css";
if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
let mode = "ready";
let rows = JSON.parse(localStorage.getItem("ux-b03-parties") || "null") || [
  {id:1,companyId:31,companyName:"Fixture BIM",fullName:"Fixture BIM",email:"project-1-company-31-fixture@project-directory.local",role:"External Company"},
  {id:2,companyId:31,companyName:"Fixture BIM",fullName:"Ana",email:"ana@example.test",role:"Contact"},
];
let writes = 0;
useAuthStore.setState({ token: "local-fixture-only" });
let branding = {userId:1,canonicalCompanyId:31,canonicalCompanyName:"Fixture BIM",companyName:"Fixture export branding",logoUrl:null};
const persist = () => localStorage.setItem("ux-b03-parties",JSON.stringify(rows));
window.fetch = async (input, init) => {
  const path = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
  if (path.includes("/access-profile")) return Response.json({decisions:{project_administration:{allow:false},company_catalogs:{allow:false},total_control:{allow:false}}});
  if (path.endsWith("/users/me") || path.endsWith("/auth/me")) return Response.json({id:1,fullName:"Fixture user",companyName:"Fixture BIM",email:"fixture@example.test"});
  if (path.includes("/users/me/company-profile")) {
    if (mode === "error") return Response.json({error:"Synthetic unavailable"},{status:503});
    if (init?.method === "POST") branding = {...branding,...JSON.parse(String(init.body))};
    return Response.json(branding);
  }
  if (path.endsWith("/config")) return Response.json({});
  if (mode === "error" && (path.includes("directory") || path.includes("master-catalogs"))) return Response.json({error:"Synthetic denied"},{status:403});
  if (mode === "loading" && (path.includes("directory") || path.includes("master-catalogs"))) return new Promise(() => {});
  if (path.endsWith("/directory/companies") && init?.method === "POST") {
    if (mode === "save-error") return Response.json({error:"Synthetic save failure"},{status:409});
    const body=JSON.parse(String(init.body)); const prior=rows.find((row:any)=>row.companyName===body.company_name);
    const row=prior || {id:rows.length+1,companyId:100+rows.length,companyName:body.company_name,fullName:body.company_name,email:"fixture@project-directory.local",role:"External Company"};
    if (!prior) { rows.push(row); writes++; persist(); }
    return Response.json({id:row.companyId,name:row.companyName,directoryEntry:row,reused:!!prior});
  }
  if (path.endsWith("/directory/contacts") && init?.method === "POST") {
    if (mode === "save-error") return Response.json({error:"Synthetic save failure"},{status:409});
    const body=JSON.parse(String(init.body)); const prior=rows.find((row:any)=>row.companyId===body.company_id && row.email===body.email);
    const row=prior || {id:rows.length+1,companyId:body.company_id,companyName:body.company_name,fullName:body.full_name,email:body.email || "contact@project-directory.local",role:"Contact"};
    if (!prior) { rows.push(row); writes++; persist(); } return Response.json(row);
  }
  if (path.endsWith("/directory")) return Response.json(mode === "empty" ? [] : rows);
  if (path.includes("master-catalogs/clients")) return Response.json({governed:false,entries:[]});
  if (path.includes("master-catalogs/disciplines")) return Response.json({governed:true,entries:mode === "empty" ? [] : [{id:"d1",code:"MEP",name:"Mechanical"}]});
  if (path.includes("/api/")) return Response.json([]);
  throw new Error(`Unexpected local fixture request ${path}`);
};
function Harness() {
  const {lang,setLang}=useI18n(); const tt=useCallback((en:string,es:string)=>lang==="es"?es:en,[lang]);
  const [revision,setRevision]=useState(0); const [permission,setPermission]=useState(true);
  const [screen,setScreen]=useState("picker"); const [company,setCompany]=useState(""); const [person,setPerson]=useState("");const [email,setEmail]=useState("");const [data,setData]=useState<any>({classification:{}});
  const request=useCallback(async(path:string)=>{const response=await fetch(`/api/v1${path}`);if(!response.ok)throw new Error("Synthetic failure");return response.json();},[]);
  return <main style={{padding:16,maxWidth:1000,margin:"auto"}}><h1>Local actual-component fixture — synthetic transport</h1>
    <button onClick={()=>setLang(lang==="es"?"en":"es")}>English / Español</button>{" "}
    <button onClick={()=>setPermission(!permission)}>Permission: {permission?"write":"read"}</button>
    <label>Fixture state<select value={mode} onChange={event=>{mode=event.target.value;setRevision(n=>n+1);}}>{["ready","empty","loading","error","save-error"].map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Screen<select value={screen} onChange={event=>setScreen(event.target.value)}>{["picker","transmittals","changes","profile"].map(value=><option key={value}>{value}</option>)}</select></label>
    <section key={`${revision}-${screen}`}>
      {screen==="picker" && <><ProjectPartyPicker projectId={1} company={company} canCreate={permission} tt={tt} onSelect={(c,p,e)=>{setCompany(c);setPerson(p);setEmail(e);}}/><output aria-label="Selected party">{company} | {person} | {email}</output><MasterClassificationSelectors data={data} setData={setData} projectId={1} request={request} tt={tt}/></>}
      {screen==="transmittals" && <TransmittalsTab projectId={1} canWrite={permission}/>}
      {screen==="changes" && <ChangeOrdersTab projectId={1} canWrite={permission}/>}
      {screen==="profile" && <CompanyProfile/>}
    </section><p>Fixture directory records: {rows.length}; new writes this load: {writes}</p>
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><I18nProvider><ConfigProvider><Harness/></ConfigProvider></I18nProvider></QueryClientProvider>);
