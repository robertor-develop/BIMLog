import { useEffect, useMemo, useState } from "react";
import { Bot, Building2, CheckCircle2, CircleDollarSign, Edit3, KeyRound, LockKeyhole, PauseCircle, PlayCircle, RefreshCw, RotateCw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const providers = ["openai", "anthropic"] as const;

type Provider = typeof providers[number];
type OwnerType = "personal" | "company" | "system";
type Status = { canManageCompany: boolean; canManageSystem: boolean; automaticProviderRequests: boolean; generationEnabled: boolean };
type Connection = { id:string; owner_type:OwnerType; provider:Provider; status:string; label:string; allowed_models:string[] };
type Allocation = { id:string; userId:number; userName:string|null; userEmail:string|null; limitMicros:string; dailyLimitMicros:string; monthlyLimitMicros:string; sessionLimitMicros:string; reservedMicros:string; settledMicros:string; status:string };
type Budget = { id:string; funding_owner_type:OwnerType; currency:string; limit_micros:string; reserved_micros:string; settled_micros:string; per_request_limit_micros:string; daily_limit_micros:string; monthly_limit_micros:string; session_limit_micros:string; provider_allowlist:string[]; model_allowlist:string[]; capability_allowlist:string[]; status:string; allocations:Allocation[] };
type User = { id:number; full_name:string|null; email:string };
type Company = { id:number; name:string };
type AdminGrant = { id:string; company_id:number; user_id:number; status:string; full_name:string|null; email:string; granted_at:string; revoked_at:string|null };
type Usage = { id:string; provider:string; model:string; purpose:string; credit_owner_type:OwnerType; status:string; estimated_max_micros:string; reserved_micros:string; actual_micros:string|null; currency:string; receipts?: unknown[] };

const toMicros = (amount: string) => {
  const clean = amount.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) return "";
  const [whole, frac = ""] = clean.split(".");
  return `${whole}${frac.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "") || "0";
};
const fromMicros = (value: string | null | undefined, currency = "USD") => {
  const n = Number(value || "0") / 1_000_000;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
};
const splitList = (value: string) => value.split(",").map((x) => x.trim()).filter(Boolean);

const ownerLabel = (tt:(en:string,es:string)=>string, value: OwnerType) => value === "personal" ? tt("Personal","Personal") : value === "company" ? tt("Company","Empresa") : tt("System","Sistema");
const statusLabel = (tt:(en:string,es:string)=>string, value: string) => ({
  pending_validation: tt("Needs validation","Requiere validacion"),
  active: tt("Active","Activo"),
  disabled: tt("Disabled","Desactivado"),
  revoked: tt("Revoked","Revocado"),
  estimated: tt("Estimated","Estimado"),
  confirmed: tt("Confirmed","Confirmado"),
  file_confirmed: tt("Files confirmed","Archivos confirmados"),
  reserved: tt("Reserved","Reservado"),
  settled: tt("Settled","Liquidado"),
  cancelled: tt("Cancelled","Cancelado"),
  failed: tt("Failed","Fallido"),
  superseded: tt("Superseded","Reemplazado")
}[value] || tt("Unknown","Desconocido"));

export function AiControlPlanePanel({ token }: { token: string | null }) {
  const { toast } = useToast();
  const { tt } = useI18n();
  const [status,setStatus]=useState<Status|null>(null);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [budgets,setBudgets]=useState<Budget[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [companies,setCompanies]=useState<Company[]>([]);
  const [adminGrants,setAdminGrants]=useState<AdminGrant[]>([]);
  const [usage,setUsage]=useState<Usage[]>([]);
  const [busy,setBusy]=useState<string|null>(null);
  const [ownerType,setOwnerType]=useState<OwnerType>("personal");
  const [provider,setProvider]=useState<Provider>("openai");
  const [apiKey,setApiKey]=useState("");
  const [label,setLabel]=useState("");
  const [models,setModels]=useState("");
  const [rotateKey,setRotateKey]=useState<Record<string,string>>({});
  const [editModels,setEditModels]=useState<Record<string,string>>({});
  const [budgetScope,setBudgetScope]=useState<OwnerType>("personal");
  const [budgetId,setBudgetId]=useState("");
  const [budgetAmount,setBudgetAmount]=useState("25.00");
  const [requestAmount,setRequestAmount]=useState("2.00");
  const [dailyAmount,setDailyAmount]=useState("10.00");
  const [monthlyAmount,setMonthlyAmount]=useState("25.00");
  const [sessionAmount,setSessionAmount]=useState("5.00");
  const [capability,setCapability]=useState("assistant");
  const [policyModel,setPolicyModel]=useState("");
  const [allocationUser,setAllocationUser]=useState("");
  const [targetCompanyId,setTargetCompanyId]=useState("");
  const [allocationAmount,setAllocationAmount]=useState("10.00");
  const [priceInput,setPriceInput]=useState("");
  const [priceOutput,setPriceOutput]=useState("");
  const [verifiedAt,setVerifiedAt]=useState("");

  async function request(path:string,init?:RequestInit){
    const response=await fetch(`${API_BASE}/api/v1/ai-control${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...init?.headers}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.error||tt("Request failed","La solicitud fallo"));
    return data;
  }

  async function load(){
    if(!token)return;
    try{
      const [s,c,b,u]=await Promise.all([request("/status"),request("/provider-connections"),request("/budgets"),request("/usage")]);
      setStatus(s); setConnections(c); setBudgets(b); setUsage(u);
      if(s.canManageSystem){
        try{
          const companyRows=await request("/companies");
          setCompanies(companyRows);
          const selectedCompany=targetCompanyId || String(companyRows[0]?.id || "");
          if(selectedCompany&&!targetCompanyId)setTargetCompanyId(selectedCompany);
          setUsers(selectedCompany?await request(`/company-users?companyId=${encodeURIComponent(selectedCompany)}`):[]);
          setAdminGrants(selectedCompany?await request(`/company-ai-administrators?companyId=${encodeURIComponent(selectedCompany)}`):[]);
        }catch{setCompanies([]);setUsers([]);setAdminGrants([]);}
      }else if(s.canManageCompany){try{setUsers(await request("/company-users"));}catch{setUsers([]);}}
      else{setUsers([]);setCompanies([]);setAdminGrants([]);}
    }catch(error){toast({title:tt("AI controls unavailable","Controles de IA no disponibles"),description:error instanceof Error?error.message:tt("Could not load AI controls","No se pudieron cargar los controles de IA"),variant:"destructive"});}
  }
  useEffect(()=>{void load();},[token]);
  useEffect(()=>{if(!token||!status?.canManageSystem||!targetCompanyId)return;void Promise.all([
    request(`/company-users?companyId=${encodeURIComponent(targetCompanyId)}`).then(setUsers).catch(()=>setUsers([])),
    request(`/company-ai-administrators?companyId=${encodeURIComponent(targetCompanyId)}`).then(setAdminGrants).catch(()=>setAdminGrants([]))
  ]);},[token,status?.canManageSystem,targetCompanyId]);

  const selectedBudget = useMemo(()=>budgets.filter((b)=>b.funding_owner_type===budgetScope).find((b)=>b.id===budgetId) || budgets.find((b)=>b.funding_owner_type===budgetScope&&b.status==="active"),[budgets,budgetId,budgetScope]);
  const sourceLabel = ownerType==="personal" ? tt("Your personal provider credits","Tus creditos personales del proveedor") : ownerType==="company" ? tt("Company-funded AI budget","Presupuesto de IA de la empresa") : tt("BIMLog system-funded AI budget","Presupuesto de IA financiado por BIMLog");
  const blockedReason = !connections.some((c)=>c.owner_type===ownerType&&c.status==="active") ? tt("No active connection is available for this funding source.","No hay una conexion activa para esta fuente de fondos.") : !budgets.some((b)=>b.funding_owner_type===ownerType&&b.status==="active") ? tt("No active spending limit is configured for this funding source.","No hay un limite de gasto activo para esta fuente de fondos.") : tt("Requests still require estimate and confirmation before any provider call.","Las solicitudes aun requieren estimacion y confirmacion antes de contactar al proveedor.");

  async function connect(){setBusy("connect");try{await request("/provider-connections",{method:"POST",body:JSON.stringify({ownerType,provider,apiKey,label,allowedModels:splitList(models)})});setApiKey("");setLabel("");setModels("");await load();toast({title:tt("Provider key stored","Clave del proveedor guardada")});}catch(e){toast({title:tt("Connection rejected","Conexion rechazada"),description:e instanceof Error?e.message:tt("Could not connect provider","No se pudo conectar el proveedor"),variant:"destructive"});}finally{setBusy(null);}}
  async function connectionAction(id:string, action:"validate"|"revoke"|"disable"|"enable"|"rotate"|"models"){setBusy(`${action}:${id}`);try{if(action==="validate")await request(`/provider-connections/${id}/validate`,{method:"POST"});if(action==="revoke")await request(`/provider-connections/${id}`,{method:"DELETE"});if(action==="disable"||action==="enable")await request(`/provider-connections/${id}`,{method:"PATCH",body:JSON.stringify({status:action==="enable"?"active":"disabled"})});if(action==="rotate")await request(`/provider-connections/${id}/rotate`,{method:"POST",body:JSON.stringify({apiKey:rotateKey[id]||""})});if(action==="models")await request(`/provider-connections/${id}`,{method:"PATCH",body:JSON.stringify({allowedModels:splitList(editModels[id]||"")})});await load();toast({title:tt("Connection updated","Conexion actualizada")});}catch(e){toast({title:tt("Action rejected","Accion rechazada"),description:e instanceof Error?e.message:tt("Request failed","La solicitud fallo"),variant:"destructive"});}finally{setBusy(null);}}
  async function saveBudget(){const limitMicros=toMicros(budgetAmount), perRequestLimitMicros=toMicros(requestAmount), dailyLimitMicros=toMicros(dailyAmount), monthlyLimitMicros=toMicros(monthlyAmount), sessionLimitMicros=toMicros(sessionAmount);if(!limitMicros||!perRequestLimitMicros||!dailyLimitMicros||!monthlyLimitMicros||!sessionLimitMicros)return;setBusy("budget");try{const row=await request("/budgets",{method:"POST",body:JSON.stringify({fundingOwnerType:budgetScope,version:Math.floor(Date.now()/1000),currency:"USD",limitMicros,perRequestLimitMicros,dailyLimitMicros,monthlyLimitMicros,sessionLimitMicros,providerAllowlist:[provider],modelAllowlist:policyModel?[policyModel]:[],capabilityAllowlist:[capability],effectiveFrom:new Date().toISOString()})});setBudgetId(row.id);await load();toast({title:tt("Spending limit saved","Limite de gasto guardado")});}catch(e){toast({title:tt("Budget rejected","Presupuesto rechazado"),description:e instanceof Error?e.message:tt("Could not save budget","No se pudo guardar el presupuesto"),variant:"destructive"});}finally{setBusy(null);}}
  async function saveAllocation(){if(!selectedBudget||!allocationUser)return;const amount=toMicros(allocationAmount);setBusy("allocation");try{await request(`/budgets/${selectedBudget.id}/allocations`,{method:"POST",body:JSON.stringify({userId:Number(allocationUser),companyId:selectedBudget.funding_owner_type==="system"?Number(targetCompanyId):undefined,limitMicros:amount,dailyLimitMicros:amount,monthlyLimitMicros:amount,sessionLimitMicros:amount})});await load();toast({title:tt("Allocation saved","Asignacion guardada")});}catch(e){toast({title:tt("Allocation rejected","Asignacion rechazada"),description:e instanceof Error?e.message:tt("Could not save allocation","No se pudo guardar la asignacion"),variant:"destructive"});}finally{setBusy(null);}}
  async function savePolicy(fundingType:OwnerType){setBusy(`policy:${fundingType}`);try{if(fundingType==="system"){await request("/prices",{method:"POST",body:JSON.stringify({version:Math.floor(Date.now()/1000),provider,model:policyModel,currency:"USD",unitBasis:1000000,inputMicros:toMicros(priceInput),outputMicros:toMicros(priceOutput),sourceUrl:provider==="openai"?"https://openai.com/api/pricing/":"https://docs.anthropic.com/en/docs/about-claude/pricing",verifiedAt,effectiveFrom:new Date().toISOString()})});}await request("/entitlements",{method:"POST",body:JSON.stringify({version:Math.floor(Date.now()/1000),capability,fundingType,providerAllowlist:[provider],modelAllowlist:[policyModel],requiresFileConfirmation:true,effectiveFrom:new Date().toISOString()})});await load();toast({title:tt("Policy saved","Politica guardada")});}catch(e){toast({title:tt("Policy rejected","Politica rechazada"),description:e instanceof Error?e.message:tt("Could not save policy","No se pudo guardar la politica"),variant:"destructive"});}finally{setBusy(null);}}
  async function saveAdminGrant(){if(!targetCompanyId||!allocationUser)return;setBusy("admin-grant");try{await request("/company-ai-administrators",{method:"POST",body:JSON.stringify({companyId:Number(targetCompanyId),userId:Number(allocationUser)})});await load();toast({title:tt("Company AI administrator granted","Administrador de IA de empresa asignado")});}catch(e){toast({title:tt("Grant rejected","Asignacion rechazada"),description:e instanceof Error?e.message:tt("Could not grant administrator","No se pudo asignar administrador"),variant:"destructive"});}finally{setBusy(null);}}
  async function revokeAdminGrant(id:string){setBusy(`admin-grant:${id}`);try{await request(`/company-ai-administrators/${id}`,{method:"DELETE"});await load();toast({title:tt("Company AI administrator revoked","Administrador de IA de empresa revocado")});}catch(e){toast({title:tt("Revoke rejected","Revocacion rechazada"),description:e instanceof Error?e.message:tt("Could not revoke administrator","No se pudo revocar administrador"),variant:"destructive"});}finally{setBusy(null);}}
  function selectScope(value:OwnerType){setOwnerType(value);setBudgetScope(value);setBudgetId("");setAllocationUser("");}

  const canManageConnection=(c:Connection)=>c.owner_type==="personal"||(c.owner_type==="company"&&status?.canManageCompany)||(c.owner_type==="system"&&status?.canManageSystem);
  const canSaveBudget=budgetScope==="personal"||(budgetScope==="company"&&status?.canManageCompany)||(budgetScope==="system"&&status?.canManageSystem);
  const canSavePolicy=(budgetScope==="personal"||budgetScope==="company")?Boolean(status?.canManageCompany):Boolean(status?.canManageSystem);
  const scopes=[{value:"personal" as const,label:tt("Personal","Personal"),icon:UserRound,visible:true},{value:"company" as const,label:tt("Company","Empresa"),icon:Building2,visible:status?.canManageCompany},{value:"system" as const,label:tt("System","Sistema"),icon:ShieldCheck,visible:status?.canManageSystem}];

  return <div data-testid="ai-control-plane" style={{display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
      <div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:16,fontWeight:700}}><LockKeyhole size={18}/>{tt("AI provider controls","Controles de proveedores de IA")}</div><p style={{fontSize:13,color:"hsl(var(--muted-foreground))",margin:"6px 0 0",maxWidth:760}}>{tt("Opening this page never contacts OpenAI or Anthropic. Provider calls require an estimate, a confirmation, and a reservation.","Abrir esta pagina nunca contacta a OpenAI ni Anthropic. Las llamadas al proveedor requieren estimacion, confirmacion y reserva.")}</p></div>
      <Badge variant="outline" style={{gap:5}}><ShieldCheck size={13}/>{tt("Broker-only execution","Ejecucion solo por broker")}</Badge>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>{scopes.filter(s=>s.visible).map(({value,label:scopeLabel,icon:Icon})=><button key={value} type="button" onClick={()=>selectScope(value)} style={{textAlign:"left",padding:13,borderRadius:8,border:`1px solid ${ownerType===value?"#2563EB":"hsl(var(--border))"}`,background:ownerType===value?"#EFF6FF":"hsl(var(--background))"}}><Icon size={17}/><div style={{fontWeight:650,fontSize:13,marginTop:6}}>{scopeLabel}</div><div style={{fontSize:11,color:"hsl(var(--muted-foreground))",marginTop:3}}>{value==="personal"?tt("You approve the spending limit.","Tu apruebas el limite de gasto."):value==="company"?tt("Company AI administrators allocate it.","Los administradores de IA de la empresa lo asignan."):tt("Super Admin controlled policy.","Politica controlada por Super Admin.")}</div></button>)}</div>

    <div style={{padding:14,border:"1px solid hsl(var(--border))",borderRadius:8,background:"hsl(var(--muted)/.24)"}}>
      <div style={{fontSize:13,fontWeight:700}}>{sourceLabel}</div>
      <div style={{fontSize:12,color:"hsl(var(--muted-foreground))",marginTop:5}}>{blockedReason}</div>
      {selectedBudget&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:10}}>{[["Remaining",Number(selectedBudget.limit_micros)-Number(selectedBudget.reserved_micros)-Number(selectedBudget.settled_micros)],["Reserved",selectedBudget.reserved_micros],["Settled",selectedBudget.settled_micros],["Per request",selectedBudget.per_request_limit_micros]].map(([labelValue,value])=><div key={String(labelValue)} style={{fontSize:12}}><div style={{color:"hsl(var(--muted-foreground))"}}>{tt(String(labelValue),String(labelValue)==="Remaining"?"Disponible":String(labelValue)==="Reserved"?"Reservado":String(labelValue)==="Settled"?"Liquidado":"Por solicitud")}</div><div style={{fontWeight:700}}>{fromMicros(String(value),selectedBudget.currency)}</div></div>)}</div>}
    </div>

    <div style={{padding:14,border:"1px solid hsl(var(--border))",borderRadius:8}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>{tt("Connect or rotate provider keys","Conectar o rotar claves del proveedor")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <div><Label>{tt("Provider","Proveedor")}</Label><select value={provider} onChange={e=>setProvider(e.target.value as Provider)} style={{width:"100%",height:38,marginTop:6,border:"1px solid hsl(var(--border))",borderRadius:6,background:"hsl(var(--background))",padding:"0 10px"}}>{providers.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><Label>{tt("Label","Etiqueta")}</Label><Input value={label} onChange={e=>setLabel(e.target.value)} style={{marginTop:6}}/></div>
        <div><Label>{tt("Approved models","Modelos aprobados")}</Label><Input value={models} onChange={e=>setModels(e.target.value)} placeholder={tt("Comma-separated","Separados por coma")} style={{marginTop:6}}/></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"end",marginTop:10,flexWrap:"wrap"}}><div style={{flex:"1 1 260px"}}><Label>{tt("API key","Clave API")}</Label><Input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} autoComplete="off" style={{marginTop:6}}/></div><Button onClick={connect} disabled={!apiKey.trim()||busy!==null} style={{gap:6}}><KeyRound size={14}/>{tt("Connect","Conectar")}</Button></div>
    </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>{connections.map(c=><div key={c.id} style={{padding:12,border:"1px solid hsl(var(--border))",borderRadius:8}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div style={{display:"flex",gap:9,alignItems:"center"}}><Bot size={18}/><div><div style={{fontSize:13,fontWeight:650}}>{c.label}</div><div style={{fontSize:11,color:"hsl(var(--muted-foreground))"}}>{c.provider} / {ownerLabel(tt,c.owner_type)} / {c.allowed_models.join(", ")||tt("no approved models","sin modelos aprobados")}</div></div></div><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><Badge variant="outline">{statusLabel(tt,c.status)}</Badge>{canManageConnection(c)&&<Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"validate")} disabled={busy!==null} title={tt("Validate","Validar")}><CheckCircle2 size={13}/></Button>}{canManageConnection(c)&&c.status==="disabled"&&<Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"enable")} disabled={busy!==null} title={tt("Re-enable","Reactivar")}><PlayCircle size={13}/></Button>}{canManageConnection(c)&&c.status!=="disabled"&&c.status!=="revoked"&&<Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"disable")} disabled={busy!==null} title={tt("Disable","Desactivar")}><PauseCircle size={13}/></Button>}{canManageConnection(c)&&c.status!=="revoked"&&<Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"revoke")} disabled={busy!==null} title={tt("Revoke","Revocar")}><Trash2 size={13}/></Button>}</div></div>
      {canManageConnection(c)&&c.status!=="revoked"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr)) auto auto",gap:8,alignItems:"end",marginTop:10}}><div><Label>{tt("Replacement key","Clave de reemplazo")}</Label><Input type="password" value={rotateKey[c.id]||""} onChange={e=>setRotateKey({...rotateKey,[c.id]:e.target.value})}/></div><Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"rotate")} disabled={busy!==null||!rotateKey[c.id]} style={{gap:5}}><RotateCw size={13}/>{tt("Rotate","Rotar")}</Button><div><Label>{tt("Approved models","Modelos aprobados")}</Label><Input value={editModels[c.id]??c.allowed_models.join(", ")} onChange={e=>setEditModels({...editModels,[c.id]:e.target.value})}/></div><Button size="sm" variant="outline" onClick={()=>connectionAction(c.id,"models")} disabled={busy!==null} style={{gap:5}}><Edit3 size={13}/>{tt("Save models","Guardar modelos")}</Button></div>}
    </div>)}</div>

    <div style={{padding:14,border:"1px solid hsl(var(--border))",borderRadius:8}}>
      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:700,marginBottom:10}}><CircleDollarSign size={16}/>{tt("Spending limits and allocations","Limites de gasto y asignaciones")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9}}>
        <div><Label>{tt("Funding","Fondos")}</Label><select value={budgetScope} onChange={e=>setBudgetScope(e.target.value as OwnerType)} style={{width:"100%",height:38,marginTop:6,border:"1px solid hsl(var(--border))",borderRadius:6,background:"hsl(var(--background))",padding:"0 10px"}}>{scopes.filter(s=>s.visible).map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><Label>{tt("Total limit","Limite total")}</Label><Input value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)}/></div><div><Label>{tt("Per request","Por solicitud")}</Label><Input value={requestAmount} onChange={e=>setRequestAmount(e.target.value)}/></div><div><Label>{tt("Daily","Diario")}</Label><Input value={dailyAmount} onChange={e=>setDailyAmount(e.target.value)}/></div><div><Label>{tt("Monthly","Mensual")}</Label><Input value={monthlyAmount} onChange={e=>setMonthlyAmount(e.target.value)}/></div><div><Label>{tt("Session","Sesion")}</Label><Input value={sessionAmount} onChange={e=>setSessionAmount(e.target.value)}/></div><div><Label>{tt("Capability","Capacidad")}</Label><Input value={capability} onChange={e=>setCapability(e.target.value)}/></div><div><Label>{tt("Model","Modelo")}</Label><Input value={policyModel} onChange={e=>setPolicyModel(e.target.value)}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>{canSaveBudget&&<Button size="sm" onClick={saveBudget} disabled={busy!==null||!policyModel}>{budgetScope==="personal"?tt("Save personal limit","Guardar limite personal"):tt("Save budget","Guardar presupuesto")}</Button>}{canSavePolicy&&<Button size="sm" variant="outline" onClick={()=>savePolicy(budgetScope)} disabled={busy!==null||!policyModel||(budgetScope==="system"&&(!priceInput||!priceOutput||!verifiedAt))}>{tt("Save entitlement policy","Guardar politica de derecho")}</Button>}</div>
      {(status?.canManageCompany||status?.canManageSystem)&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr)) auto",gap:8,alignItems:"end",marginTop:12}}>{status?.canManageSystem&&<div><Label>{tt("Target company","Empresa destino")}</Label><select value={targetCompanyId} onChange={e=>{setTargetCompanyId(e.target.value);setAllocationUser("");}} style={{width:"100%",height:38,border:"1px solid hsl(var(--border))",borderRadius:6,background:"hsl(var(--background))",padding:"0 10px"}}><option value="">{tt("Select company","Seleccionar empresa")}</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}<div><Label>{tt("Budget from server","Presupuesto del servidor")}</Label><select value={selectedBudget?.id||""} onChange={e=>setBudgetId(e.target.value)} style={{width:"100%",height:38,border:"1px solid hsl(var(--border))",borderRadius:6,background:"hsl(var(--background))",padding:"0 10px"}}>{budgets.filter(b=>b.funding_owner_type===budgetScope&&b.funding_owner_type!=="personal").map(b=><option key={b.id} value={b.id}>{ownerLabel(tt,b.funding_owner_type)} {statusLabel(tt,b.status)} {fromMicros(b.limit_micros,b.currency)}</option>)}</select></div><div><Label>{tt("Company user","Usuario de empresa")}</Label><select value={allocationUser} onChange={e=>setAllocationUser(e.target.value)} style={{width:"100%",height:38,border:"1px solid hsl(var(--border))",borderRadius:6,background:"hsl(var(--background))",padding:"0 10px"}}><option value="">{tt("Select user","Seleccionar usuario")}</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name||u.email} ({u.email})</option>)}</select></div><div><Label>{tt("Allocation limit","Limite asignado")}</Label><Input value={allocationAmount} onChange={e=>setAllocationAmount(e.target.value)}/></div><Button size="sm" onClick={saveAllocation} disabled={busy!==null||!selectedBudget||!allocationUser||(selectedBudget?.funding_owner_type==="system"&&!targetCompanyId)}>{tt("Allocate","Asignar")}</Button></div>}
      {status?.canManageSystem&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid hsl(var(--border))"}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>{tt("Company AI administrator grants","Permisos de administrador de IA de empresa")}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><Button size="sm" variant="outline" onClick={saveAdminGrant} disabled={busy!==null||!targetCompanyId||!allocationUser}>{tt("Grant selected user","Asignar usuario seleccionado")}</Button></div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>{adminGrants.length===0?<div style={{fontSize:12,color:"hsl(var(--muted-foreground))"}}>{tt("No administrator grants for the selected company.","No hay permisos de administrador para la empresa seleccionada.")}</div>:adminGrants.map(g=><div key={g.id} style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",fontSize:12,padding:"6px 0",borderTop:"1px solid hsl(var(--border))"}}><span>{g.full_name||g.email} ({g.email})</span><span style={{display:"flex",gap:6,alignItems:"center"}}><Badge variant="outline">{statusLabel(tt,g.status)}</Badge>{g.status==="active"&&<Button size="sm" variant="ghost" onClick={()=>revokeAdminGrant(g.id)} disabled={busy!==null}>{tt("Revoke","Revocar")}</Button>}</span></div>)}</div>
      </div>}
      {status?.canManageSystem&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9,marginTop:12,paddingTop:12,borderTop:"1px solid hsl(var(--border))"}}><div><Label>{tt("Input price per 1M tokens","Precio entrada por 1M tokens")}</Label><Input value={priceInput} onChange={e=>setPriceInput(e.target.value)}/></div><div><Label>{tt("Output price per 1M tokens","Precio salida por 1M tokens")}</Label><Input value={priceOutput} onChange={e=>setPriceOutput(e.target.value)}/></div><div><Label>{tt("Verified at","Verificado en")}</Label><Input type="datetime-local" value={verifiedAt} onChange={e=>setVerifiedAt(e.target.value)}/></div><div style={{fontSize:11,color:"hsl(var(--muted-foreground))",alignSelf:"end"}}>{provider==="openai"?"https://openai.com/api/pricing/":"https://docs.anthropic.com/en/docs/about-claude/pricing"}</div></div>}
    </div>

    <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:13,fontWeight:700}}>{tt("Estimate and usage receipts","Recibos de estimacion y uso")}</div><Button size="sm" variant="ghost" onClick={load} style={{gap:5}}><RefreshCw size={13}/>{tt("Refresh","Actualizar")}</Button></div>{usage.length===0?<div style={{fontSize:12,color:"hsl(var(--muted-foreground))"}}>{tt("No AI usage receipts yet.","Aun no hay recibos de uso de IA.")}</div>:usage.slice(0,8).map(run=><div key={run.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,padding:"9px 0",borderTop:"1px solid hsl(var(--border))"}}><div><div style={{fontSize:12,fontWeight:650}}>{run.purpose}</div><div style={{fontSize:11,color:"hsl(var(--muted-foreground))"}}>{run.provider} / {run.model} / {ownerLabel(tt,run.credit_owner_type)}</div></div><div style={{textAlign:"right",fontSize:11}}><div>{statusLabel(tt,run.status)}</div><div style={{color:"hsl(var(--muted-foreground))"}}>{fromMicros(run.actual_micros || run.reserved_micros || run.estimated_max_micros,run.currency)}</div></div></div>)}</div>
  </div>;
}
