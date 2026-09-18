import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import "./CompanyWorkflowGovernance.css";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const approvals = ["create_work_item","complete_phase","complete_deliverable","economic_change","template_update","activate_version"] as const;
const changes = ["edit_phases","edit_tasks_roles","edit_allocation","change_apu","edit_approved_work_item","retire_version"] as const;
const validations = ["allocation_total_100","task_execute_role","phase_review_role","final_approval","required_documents","valid_apu","unique_phase_codes"] as const;
const rights = ["view","edit_draft","approve","publish","manage"] as const;
type Definition = {
  schemaVersion:1;
  scope:{ allWorkflows:boolean; workflowTemplateIds:string[] };
  approvalRules:Array<{ action:typeof approvals[number];roles:string[];threshold:null|{ currency:string;amountMinor:number } }>;
  changeRules:Array<{ action:typeof changes[number];allowed:boolean;requiresReapproval:boolean;requiresNewVersion:boolean }>;
  versioning:{ lockActivatedSnapshot:true;structuralChangeCreatesVersion:true;preserveHistory:true };
  permissions:Array<{ role:string;actions:Array<typeof rights[number]> }>;
  validation:Record<typeof validations[number],boolean>;
};
type Version = { policyId:string;code:string;name:string;versionId:string;version:number;revision:number;state:string;definition:Definition;fingerprint:string|null };
type Summary = Pick<Version,"code"|"name"|"versionId"|"version"|"revision"|"state"> & { id:string };
type History = { versionId:string;action:string;actorId:number;createdAt:string;details:Record<string,unknown> };
const starter = ():Definition => ({
  schemaVersion:1,scope:{ allWorkflows:true,workflowTemplateIds:[] },
  approvalRules:approvals.map(action => ({ action,roles:["PROJECT_MANAGER"],threshold:action === "economic_change" ? { currency:"USD",amountMinor:2500000 } : null })),
  changeRules:changes.map(action => ({ action,allowed:true,requiresReapproval:true,requiresNewVersion:action === "edit_phases" || action === "change_apu" })),
  versioning:{ lockActivatedSnapshot:true,structuralChangeCreatesVersion:true,preserveHistory:true },
  permissions:[{ role:"PROJECT_MANAGER",actions:[...rights] }],
  validation:Object.fromEntries(validations.map(key => [key,true])) as Definition["validation"],
});
const labels:Record<string,[string,string]> = {
  create_work_item:["Create Work Item","Crear elemento de trabajo"],complete_phase:["Complete phase","Completar fase"],
  complete_deliverable:["Complete deliverable","Completar entregable"],economic_change:["Economic change","Cambio económico"],
  template_update:["Update template","Actualizar plantilla"],activate_version:["Activate version","Activar versión"],
  edit_phases:["Edit phases","Editar fases"],edit_tasks_roles:["Edit tasks or roles","Editar tareas o roles"],
  edit_allocation:["Modify allocation","Modificar distribución"],change_apu:["Change APU","Cambiar APU"],
  edit_approved_work_item:["Edit approved Work Item","Editar elemento aprobado"],retire_version:["Retire version","Retirar versión"],
  allocation_total_100:["Allocation totals 100%","Distribución suma 100%"],task_execute_role:["Task execute role","Rol ejecutor de tarea"],
  phase_review_role:["Review each phase","Revisión de cada fase"],final_approval:["Final approval","Aprobación final"],
  required_documents:["Required documents","Documentos requeridos"],valid_apu:["Valid APU","APU válido"],
  unique_phase_codes:["Unique phase codes","Códigos de fase únicos"],
};

export function CompanyWorkflowGovernance() {
  const { token } = useAuthStore();
  const [,navigate] = useLocation();
  const { lang } = useI18n();
  const spanish = lang === "es";
  const t = (en:string,es:string) => spanish ? es : en;
  const label = (key:string) => labels[key]?.[spanish ? 1 : 0] ?? key;
  const [list,setList] = useState<Summary[]>([]);
  const [workflows,setWorkflows] = useState<Array<{ id:string;code:string;name:string }>>([]);
  const [canManage,setCanManage] = useState(false);
  const [selectedId,setSelectedId] = useState("");
  const [versions,setVersions] = useState<Version[]>([]);
  const [history,setHistory] = useState<History[]>([]);
  const [draft,setDraft] = useState<Definition>(starter);
  const [identity,setIdentity] = useState({ code:"",name:"" });
  const [dirty,setDirty] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [confirm,setConfirm] = useState<"publish"|"retire"|null>(null);
  const [reason,setReason] = useState("");
  const current = versions.find(version => version.state === "draft") ?? versions[0];
  const editable = canManage && (!selectedId || current?.state === "draft");
  const request = useCallback(async (path:string,method="GET",body?:object) => {
    const response = await fetch(`${base}/api/v1${path}`, { method,headers:{ Authorization:`Bearer ${token}`,"Content-Type":"application/json" },
      body:body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.field ? `${value.code}: ${value.field}` : value.code ?? `HTTP ${response.status}`);
    return value;
  },[token]);
  const load = useCallback(async (id?:string) => {
    const listing = await request("/company/workflow-governance-policies");
    setList(listing.versions ?? []); setCanManage(listing.canManage === true);
    if (listing.canManage) {
      const workflowsResult = await request("/company/delivery-workflows");
      setWorkflows((workflowsResult.versions ?? []).filter((item:{state:string}) => item.state === "published"));
    } else setWorkflows([]);
    const target = id ?? selectedId;
    if (target && (listing.versions ?? []).some((row:Summary) => row.id === target)) {
      const detail = await request(`/company/workflow-governance-policies/${target}`);
      setVersions(detail.versions ?? []); setHistory(detail.history ?? []);
      const shown = detail.versions.find((version:Version) => version.state === "draft") ?? detail.versions[0];
      setDraft(structuredClone(shown.definition)); setIdentity({ code:shown.code,name:shown.name }); setSelectedId(target);
    } else if (target) { setSelectedId(""); setVersions([]); setHistory([]); setDraft(starter()); }
    setDirty(false);
  },[request,selectedId]);
  useEffect(() => { setLoading(true); void load().catch(cause => {
    setList([]);setVersions([]);setHistory([]);setSelectedId("");setCanManage(false);setError(String(cause));
  }).finally(() => setLoading(false)); },[load]);
  useEffect(() => { if (!dirty) return; const guard = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload",guard); return () => window.removeEventListener("beforeunload",guard); },[dirty]);
  const edit = (mutate:(value:Definition)=>void) => { setDraft(previous => { const next = structuredClone(previous); mutate(next); return next; }); setDirty(true); setNotice(""); };
  const act = async (callback:()=>Promise<unknown>,message:string) => { setBusy(true); setError(""); setNotice("");
    try { await callback(); await load(selectedId || undefined); setNotice(message); setConfirm(null); setReason(""); }
    catch (cause) { setError(String(cause)); }
    finally { setBusy(false); } };
  const select = async (id:string) => { if (dirty) { setError(t("Save or discard changes before switching.","Guarde o descarte los cambios antes de cambiar.")); return; }
    setError(""); setLoading(true); try { await load(id); } catch (cause) { setVersions([]);setHistory([]);setSelectedId("");setError(String(cause)); } finally { setLoading(false); } };

  if (!token) return null;
  return <div className="wgp-shell"><MasterSidebar /><main className="wgp-main">
    <button type="button" disabled={dirty} onClick={() => navigate("/dashboard")}>{t("Back to Headquarters","Volver a la Sede")}</button>
    <header className="wgp-header"><div><p>{t("Company configuration","Configuración de empresa")}</p><h1>{t("Governance Policies","Políticas de gobernanza")}</h1>
      <span>{t("Reusable Delivery Workflow controls. Project budget governance remains in Intake and Operations.","Controles reutilizables de flujos de entrega. La gobernanza presupuestaria del proyecto permanece en Ingreso y Operaciones.")}</span></div>
      {canManage && <button type="button" disabled={dirty || busy} onClick={() => { setSelectedId("");setVersions([]);setHistory([]);setDraft(starter());setIdentity({code:"",name:""});setError("");setNotice(""); }}>{t("New policy","Nueva política")}</button>}</header>
    {loading && <p role="status">{t("Loading policies...","Cargando políticas...")}</p>}
    {error && <p role="alert" className="wgp-error">{error}</p>}
    {notice && <p role="status" className="wgp-notice">{notice}</p>}
    {dirty && <div className="wgp-dirty" role="status">{t("Unsaved changes","Cambios sin guardar")}
      <button type="button" onClick={() => { setDraft(current ? structuredClone(current.definition) : starter());setDirty(false);setError(""); }}>{t("Discard changes","Descartar cambios")}</button></div>}
    <div className="wgp-layout"><aside className="wgp-list"><h2>{t("Policies","Políticas")}</h2>
      {!loading && !list.length && <p>{t("No published policies are available.","No hay políticas publicadas disponibles.")}</p>}
      {[...new Map(list.map(row => [row.id,row])).values()].map(row => <button key={row.id} type="button" className={selectedId === row.id ? "wgp-selected" : ""}
        onClick={() => void select(row.id)}><strong>{row.name}</strong><span>{row.code} · v{row.version} · {row.state}</span></button>)}
    </aside><section className="wgp-editor">
      <div className="wgp-title"><h2>{selectedId ? identity.name : t("New Governance Policy","Nueva política de gobernanza")}</h2>
        {current && <span>{current.state} · v{current.version} · {current.fingerprint?.slice(0,12) ?? t("Draft","Borrador")}</span>}</div>
      <p>{t("Published policies bind only to newly activated Work Items. Existing snapshots never change.","Las políticas publicadas se vinculan solo a nuevos elementos de trabajo activados. Los registros existentes nunca cambian.")}</p>
      {editable && <div className="wgp-grid"><label>{t("Code","Código")}<input value={identity.code} disabled={Boolean(selectedId)} onChange={event => { setIdentity({...identity,code:event.target.value.toUpperCase()});setDirty(true); }} /></label>
        <label>{t("Name","Nombre")}<input value={identity.name} disabled={Boolean(selectedId)} onChange={event => { setIdentity({...identity,name:event.target.value});setDirty(true); }} /></label></div>}
      <section className="wgp-card"><h3>{t("Policy scope","Alcance de política")}</h3>
        <label><input type="checkbox" checked={draft.scope.allWorkflows} disabled={!editable} onChange={event => edit(value => { value.scope.allWorkflows=event.target.checked;value.scope.workflowTemplateIds=[]; })} />
          {t("All company Delivery Workflows","Todos los flujos de entrega de la empresa")}</label>
        {!draft.scope.allWorkflows && <div className="wgp-options">{workflows.map(workflow => <label key={workflow.id}><input type="checkbox" disabled={!editable}
          checked={draft.scope.workflowTemplateIds.includes(workflow.id)}
          onChange={event => edit(value => { value.scope.workflowTemplateIds=event.target.checked ? [...value.scope.workflowTemplateIds,workflow.id] : value.scope.workflowTemplateIds.filter(id => id!==workflow.id); })} />
          {workflow.name} ({workflow.code})</label>)}</div>}
        {!draft.scope.allWorkflows && !workflows.length && <p>{t("Publish a Delivery Workflow before scoping this policy to it.","Publique un flujo de entrega antes de asignarle esta política.")}</p>}
      </section>
      <section className="wgp-card"><h3>{t("Approval hierarchy","Jerarquía de aprobaciones")}</h3>
        <p>{t("Role codes must correspond to your governed company roles. Threshold is in minor currency units.","Los códigos de rol deben corresponder a los roles gobernados de la empresa. El umbral se expresa en unidades menores de moneda.")}</p>
        <div className="wgp-table-wrap"><table><thead><tr><th>{t("Action","Acción")}</th><th>{t("Approver roles, comma separated","Roles aprobadores, separados por coma")}</th><th>{t("Currency","Moneda")}</th><th>{t("Threshold minor units","Umbral unidades menores")}</th></tr></thead>
          <tbody>{draft.approvalRules.map((rule,index) => <tr key={rule.action}><th>{label(rule.action)}</th>
            <td><input aria-label={`${label(rule.action)} roles`} disabled={!editable} value={rule.roles.join(", ")}
              onChange={event => edit(value => { value.approvalRules[index].roles=event.target.value.toUpperCase().split(",").map(part => part.trim()).filter(Boolean); })} /></td>
            <td><input aria-label={`${label(rule.action)} currency`} disabled={!editable} maxLength={3} value={rule.threshold?.currency ?? ""}
              onChange={event => edit(value => { value.approvalRules[index].threshold=event.target.value ? {currency:event.target.value.toUpperCase(),amountMinor:rule.threshold?.amountMinor ?? 0}:null; })} /></td>
            <td><input aria-label={`${label(rule.action)} threshold`} type="number" min="0" step="1" disabled={!editable || !rule.threshold} value={rule.threshold?.amountMinor ?? ""}
              onChange={event => edit(value => { if(value.approvalRules[index].threshold) value.approvalRules[index].threshold!.amountMinor=Number(event.target.value); })} /></td></tr>)}</tbody></table></div>
      </section>
      <section className="wgp-card"><h3>{t("Change control","Control de cambios")}</h3>
        <div className="wgp-table-wrap"><table><thead><tr><th>{t("Change","Cambio")}</th><th>{t("Allowed","Permitido")}</th><th>{t("Reapproval","Reaprobación")}</th><th>{t("New version","Nueva versión")}</th></tr></thead>
        <tbody>{draft.changeRules.map((rule,index) => <tr key={rule.action}><th>{label(rule.action)}</th>
          {(["allowed","requiresReapproval","requiresNewVersion"] as const).map(key => <td key={key}><input type="checkbox" aria-label={`${label(rule.action)} ${key}`} disabled={!editable || (key==="requiresNewVersion" && rule.allowed && ["edit_phases","change_apu"].includes(rule.action))}
            checked={rule[key]} onChange={event => edit(value => { value.changeRules[index][key]=event.target.checked; if(value.changeRules[index].allowed && ["edit_phases","change_apu"].includes(rule.action)) value.changeRules[index].requiresNewVersion=true; })} /></td>)}</tr>)}</tbody></table></div>
      </section>
      <section className="wgp-card"><h3>{t("Validation rules","Reglas de validación")}</h3>
        <div className="wgp-options">{validations.map(key => <label key={key}><input type="checkbox" disabled={!editable || ["allocation_total_100","task_execute_role","valid_apu","unique_phase_codes"].includes(key)}
          checked={draft.validation[key]} onChange={event => edit(value => { value.validation[key]=event.target.checked; })} />{label(key)}</label>)}</div>
        <p>{t("The checked core validations cannot be disabled.","Las validaciones básicas marcadas no se pueden desactivar.")}</p>
      </section>
      <section className="wgp-card"><h3>{t("Company role permissions","Permisos por rol de empresa")}</h3>
        <div className="wgp-table-wrap"><table><thead><tr><th>{t("Role code","Código de rol")}</th>{rights.map(right => <th key={right}>{right}</th>)}<th></th></tr></thead>
          <tbody>{draft.permissions.map((permission,index) => <tr key={index}><td><input aria-label={`Role ${index+1}`} disabled={!editable} value={permission.role}
            onChange={event => edit(value => { value.permissions[index].role=event.target.value.toUpperCase(); })} /></td>
            {rights.map(right => <td key={right}><input type="checkbox" aria-label={`${permission.role} ${right}`} disabled={!editable || right==="view"}
              checked={permission.actions.includes(right)} onChange={event => edit(value => { const row=value.permissions[index];row.actions=event.target.checked ? [...row.actions,right] : row.actions.filter(item => item!==right); })} /></td>)}
            <td><button type="button" disabled={!editable || draft.permissions.length===1} onClick={() => edit(value => { value.permissions.splice(index,1); })}>{t("Remove","Quitar")}</button></td></tr>)}</tbody></table></div>
        {editable && <button type="button" disabled={draft.permissions.length>=20} onClick={() => edit(value => { value.permissions.push({role:"NEW_ROLE",actions:["view"]}); })}>{t("Add role","Agregar rol")}</button>}
        <p>{t("This matrix defines policy intent. Platform PMO and Finance grants still enforce API authority.","Esta matriz expresa la política. Los permisos PMO y Finanzas de la plataforma siguen controlando la autoridad API.")}</p>
      </section>
      <section className="wgp-card"><h3>{t("Versioning and locking","Versionado y bloqueo")}</h3>
        <p>{t("Activated Work Items keep immutable policy and workflow snapshots. Structural changes create a new version; full history is preserved.","Los elementos activados conservan instantáneas inmutables de política y flujo. Los cambios estructurales crean otra versión y se conserva todo el historial.")}</p>
      </section>
      {canManage && <div className="wgp-actions">
        {editable && <button type="button" disabled={busy || !dirty || (!selectedId && (!identity.code || !identity.name))} onClick={() => void act(async () => {
          if (!selectedId) { const created=await request("/company/workflow-governance-policies","POST",{code:identity.code,name:identity.name,definition:draft});
            setSelectedId(created.policyId); await load(created.policyId); }
          else if (current) await request(`/company/workflow-governance-policies/${selectedId}/versions/${current.versionId}`,"PATCH",{expectedRevision:current.revision,definition:draft});
        },t("Draft saved.","Borrador guardado."))}>{t("Save draft","Guardar borrador")}</button>}
        {current?.state==="draft" && <button type="button" disabled={busy || dirty} onClick={() => void act(() => request(`/company/workflow-governance-policies/${selectedId}/versions/${current.versionId}/approve`,"POST",{expectedRevision:current.revision}),t("Policy approved.","Política aprobada."))}>{t("Approve with Finance checker","Aprobar con verificador financiero")}</button>}
        {current?.state==="approved" && <button type="button" disabled={busy} onClick={() => setConfirm("publish")}>{t("Publish policy","Publicar política")}</button>}
        {current?.state==="published" && <button type="button" disabled={busy} onClick={() => setConfirm("retire")}>{t("Retire policy","Retirar política")}</button>}
        {selectedId && !versions.some(version => version.state==="draft" || version.state==="approved") && <button type="button" disabled={busy || dirty} onClick={() => void act(() => request(`/company/workflow-governance-policies/${selectedId}/versions`,"POST",{}),t("New draft version created.","Nueva versión borrador creada."))}>{t("Clone new version","Clonar nueva versión")}</button>}
      </div>}
      {confirm && current && <div className="wgp-confirm" role="dialog" aria-modal="true" aria-label={confirm}>
        <p>{confirm==="publish" ? t("Publish this approved version for new Work Items? Existing snapshots will not change.","¿Publicar esta versión aprobada para nuevos elementos? Los registros existentes no cambiarán.") :
          t("Retire this published version? New Work Items will no longer bind to it.","¿Retirar esta versión publicada? Los nuevos elementos ya no se vincularán a ella.")}</p>
        {confirm==="retire" && <label>{t("Audit reason (at least 5 characters)","Motivo de auditoría (mínimo 5 caracteres)")}<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>}
        <button type="button" disabled={busy || (confirm==="retire" && reason.trim().length<5)} onClick={() => void act(() =>
          request(`/company/workflow-governance-policies/${selectedId}/versions/${current.versionId}/${confirm}`,"POST",
            {expectedRevision:current.revision,...(confirm==="retire" ? {reason:reason.trim()} : {})}),
          confirm==="publish" ? t("Policy published.","Política publicada.") : t("Policy retired.","Política retirada."))}>{t("Confirm","Confirmar")}</button>
        <button type="button" onClick={() => { setConfirm(null);setReason(""); }}>{t("Cancel","Cancelar")}</button>
      </div>}
      {selectedId && <section className="wgp-card"><h3>{t("Version history","Historial de versiones")}</h3>
        <ul>{versions.map(version => <li key={version.versionId}>v{version.version} · {version.state} · {version.fingerprint?.slice(0,16) ?? "draft"}</li>)}</ul>
        {history.length>0 && <div className="wgp-table-wrap"><table><thead><tr><th>{t("Time","Fecha")}</th><th>{t("Action","Acción")}</th><th>{t("Actor","Actor")}</th><th>{t("Details","Detalles")}</th></tr></thead>
          <tbody>{history.map((entry,index) => <tr key={index}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.action}</td><td>{entry.actorId}</td><td>{JSON.stringify(entry.details)}</td></tr>)}</tbody></table></div>}
      </section>}
    </section></div>
  </main></div>;
}
