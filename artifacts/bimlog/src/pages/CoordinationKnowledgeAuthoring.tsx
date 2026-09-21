import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Edit3, FileText, Link2, Save, X } from "lucide-react";

type KnowledgeStatus = "draft" | "under_review" | "approved" | "retired";
export type KnowledgeRecord = Record<string, unknown> & { id: string; revision: number; status: KnowledgeStatus; code: string };
type Language = "en" | "es";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const text = (value: unknown) => String(value ?? "");
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

export function ConflictTypeWorkspace({ item, token, capabilities, lang, onClose, onChanged }: {
  item: KnowledgeRecord; token: string | null; capabilities: string[]; lang: Language;
  onClose(): void; onChanged(item: KnowledgeRecord): void;
}) {
  const es = lang === "es", t = (en: string, spanish: string) => es ? spanish : en;
  const entityId = text(item.conflict_type_id || item.id);
  const [draft, setDraft] = useState(() => ({
    name: text(item.name), description: text(item.description), disciplineA: text(item.discipline_a), disciplineB: text(item.discipline_b),
    elementTypeA: text(item.element_type_a), elementTypeB: text(item.element_type_b), conflictCategory: text(item.conflict_category),
    coordinationStage: text(item.coordination_stage), tags: list(item.tags).join(", "),
  }));
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [history, setHistory] = useState<KnowledgeRecord[] | null>(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify({ name:text(item.name),description:text(item.description),disciplineA:text(item.discipline_a),disciplineB:text(item.discipline_b),elementTypeA:text(item.element_type_a),elementTypeB:text(item.element_type_b),conflictCategory:text(item.conflict_category),coordinationStage:text(item.coordination_stage),tags:list(item.tags).join(", ") }), [draft,item]);
  const mayEdit = item.status === "draft" && capabilities.includes("edit_draft");
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${API_BASE}/api/v1/coordination-knowledge/conflict-types/${encodeURIComponent(entityId)}${path}`, { ...init, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(init?.headers ?? {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.code || `KNOWLEDGE_${response.status}`); return payload;
  };
  const save = async () => {
    if (!draft.name.trim() || !draft.description.trim() || !draft.disciplineA.trim() || !draft.disciplineB.trim() || !draft.elementTypeA.trim() || !draft.elementTypeB.trim() || !draft.conflictCategory.trim() || !draft.coordinationStage.trim()) { setMessage(t("Complete every required field.", "Complete todos los campos obligatorios.")); return; }
    setSaving(true); setMessage("");
    try { const payload=await request("",{method:"PATCH",body:JSON.stringify({...draft,tags:draft.tags.split(",").map(value=>value.trim()).filter(Boolean),expectedRevision:item.revision})}); onChanged(payload.item); setEditing(false); setMessage(t("Draft saved as a new revision.","Borrador guardado como una nueva revisión.")); }
    catch(error){ setMessage(String(error instanceof Error?error.message:error)); } finally { setSaving(false); }
  };
  const loadHistory = async () => { try { const payload=await request("/history"); setHistory(payload.items ?? []); } catch(error){ setMessage(String(error)); } };
  const close = () => { if (dirty && !window.confirm(t("Discard unsaved changes?","¿Descartar cambios sin guardar?"))) return; onClose(); };
  return <aside className="knowledge-workspace" role="dialog" aria-modal="true" aria-labelledby="knowledge-workspace-title">
    <header><div><span className="knowledge-code">{item.code}</span><h2 id="knowledge-workspace-title">{text(item.name)}</h2><span className={`knowledge-status knowledge-status-${item.status}`}>● {item.status.replace("_"," ")}</span></div><button type="button" onClick={close} aria-label={t("Close detail","Cerrar detalle")}><X aria-hidden /></button></header>
    {item.status === "approved" && <p className="knowledge-lock-note"><AlertTriangle aria-hidden />{t("Approved revisions are immutable. Create a revision to change this record.","Las revisiones aprobadas son inmutables. Cree una revisión para cambiar este registro.")}</p>}
    <div className="knowledge-workspace-actions">{mayEdit && <button type="button" onClick={()=>setEditing(value=>!value)}><Edit3 aria-hidden />{editing?t("View detail","Ver detalle"):t("Edit draft","Editar borrador")}</button>}<button type="button" onClick={()=>void loadHistory()}><Clock3 aria-hidden />{t("Revision history","Historial de revisiones")}</button></div>
    <section className="knowledge-workspace-body">
      {editing ? <form onSubmit={event=>{event.preventDefault();void save();}} className="knowledge-editor">
        {([['name','Name','Nombre'],['description','Description','Descripción'],['disciplineA','Discipline A','Disciplina A'],['disciplineB','Discipline B','Disciplina B'],['elementTypeA','Element A','Elemento A'],['elementTypeB','Element B','Elemento B'],['conflictCategory','Category','Categoría'],['coordinationStage','Stage','Etapa'],['tags','Tags (comma separated)','Etiquetas (separadas por coma)']] as const).map(([key,en,sp])=><label key={key}>{t(en,sp)}{key==='description'?<textarea value={draft[key]} onChange={e=>setDraft(current=>({...current,[key]:e.target.value}))}/>:<input value={draft[key]} onChange={e=>setDraft(current=>({...current,[key]:e.target.value}))}/>}</label>)}
        <div className="knowledge-editor-buttons"><button type="button" onClick={()=>setEditing(false)}>{t("Cancel","Cancelar")}</button><button type="submit" disabled={saving||!dirty}><Save aria-hidden />{saving?t("Saving…","Guardando…"):t("Save draft","Guardar borrador")}</button></div>
      </form> : <dl className="knowledge-detail-list"><div><dt>{t("Description","Descripción")}</dt><dd>{text(item.description)}</dd></div><div><dt>{t("Disciplines","Disciplinas")}</dt><dd>{text(item.discipline_a)} · {text(item.discipline_b)}</dd></div><div><dt>{t("Elements","Elementos")}</dt><dd>{text(item.element_type_a)} · {text(item.element_type_b)}</dd></div><div><dt>{t("Category / stage","Categoría / etapa")}</dt><dd>{text(item.conflict_category)} · {text(item.coordination_stage)}</dd></div><div><dt>{t("Tags","Etiquetas")}</dt><dd>{list(item.tags).join(", ")||"—"}</dd></div><div><dt>{t("Related guidance","Guía relacionada")}</dt><dd><Link2 aria-hidden />{t("Loaded from governed relationships when available.","Se carga desde relaciones gobernadas cuando están disponibles.")}</dd></div><div><dt>{t("Previous cases","Casos anteriores")}</dt><dd><FileText aria-hidden />{t("Historical issue references remain available through the evidence view.","Las referencias históricas permanecen disponibles mediante la vista de evidencia.")}</dd></div></dl>}
      {history&&<ol className="knowledge-history">{history.map(version=><li key={version.id}>v{version.revision} · {version.status.replace("_"," ")}</li>)}</ol>}
      {message&&<p className="knowledge-workspace-message" role="status">{message}</p>}
    </section>
  </aside>;
}

export function RuleMethodWorkspace({ kind, item, token, capabilities, lang, onClose, onChanged }: {
  kind:"rules"|"resolution-methods"; item:KnowledgeRecord; token:string|null; capabilities:string[]; lang:Language; onClose():void; onChanged(item:KnowledgeRecord):void;
}) {
  const es=lang==="es", t=(en:string,sp:string)=>es?sp:en, isRule=kind==="rules", entityId=text(isRule?(item.rule_id||item.id):(item.resolution_method_id||item.id));
  const source=isRule?{title:text(item.title),guidance:text(item.guidance),rationale:text(item.rationale),applicability:JSON.stringify(item.applicability??{},null,2),exceptions:list(item.exceptions).join("\n"),references:JSON.stringify(item.references??[],null,2)}:{name:text(item.name),description:text(item.description),responsibleTrade:text(item.responsible_trade),applicability:JSON.stringify(item.applicability??{},null,2),constraints:list(item.constraints).join("\n"),advantages:list(item.advantages).join("\n"),disadvantages:list(item.disadvantages).join("\n"),requiredApprovals:list(item.required_approvals).join("\n"),rfiRequirement:text(item.rfi_requirement||"conditional"),details:JSON.stringify(item.details??{},null,2),conflictTypeIds:list(item.conflict_type_ids).join("\n"),ruleRevisionIds:list(item.rule_revision_ids).join("\n")};
  const [draft,setDraft]=useState<Record<string,string>>(source), [editing,setEditing]=useState(false), [saving,setSaving]=useState(false), [message,setMessage]=useState("");
  const dirty=JSON.stringify(draft)!==JSON.stringify(source), mayEdit=item.status==="draft"&&capabilities.includes("edit_draft");
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
  const close=()=>{if(dirty&&!window.confirm(t("Discard unsaved changes?","¿Descartar cambios sin guardar?")))return;onClose();};
  const save=async()=>{setMessage("");let payload:Record<string,unknown>={expectedRevision:item.revision};try{if(isRule){const applicability=JSON.parse(draft.applicability),references=JSON.parse(draft.references);if(!draft.title.trim()||!draft.guidance.trim()||!draft.rationale.trim()||!applicability||!Array.isArray(references))throw new Error(t("Complete required fields and use valid JSON.","Complete los campos obligatorios y use JSON válido."));payload={...payload,title:draft.title,guidance:draft.guidance,rationale:draft.rationale,applicability,exceptions:draft.exceptions.split("\n").map(v=>v.trim()).filter(Boolean),references};}else{const applicability=JSON.parse(draft.applicability),details=JSON.parse(draft.details),conflictTypeIds=draft.conflictTypeIds.split("\n").map(v=>v.trim()).filter(Boolean);if(!draft.name.trim()||!draft.description.trim()||!conflictTypeIds.length)throw new Error(t("Name, description and at least one Conflict Type are required.","Se requieren nombre, descripción y al menos un Tipo de Conflicto."));payload={...payload,name:draft.name,description:draft.description,responsibleTrade:draft.responsibleTrade||null,applicability,details,rfiRequirement:draft.rfiRequirement,constraints:draft.constraints.split("\n").filter(Boolean),advantages:draft.advantages.split("\n").filter(Boolean),disadvantages:draft.disadvantages.split("\n").filter(Boolean),requiredApprovals:draft.requiredApprovals.split("\n").filter(Boolean),conflictTypeIds,ruleRevisionIds:draft.ruleRevisionIds.split("\n").filter(Boolean)};}setSaving(true);const response=await fetch(`${API_BASE}/api/v1/coordination-knowledge/${kind}/${encodeURIComponent(entityId)}`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.code||`KNOWLEDGE_${response.status}`);onChanged(result.item);setEditing(false);setMessage(t("Draft saved. Nothing was published.","Borrador guardado. No se publicó nada."));}catch(error){setMessage(String(error instanceof Error?error.message:error));}finally{setSaving(false);}};
  const fields=isRule?[["title","Title","Título"],["guidance","Guidance","Guía"],["rationale","Rationale","Justificación"],["applicability","Applicability (JSON)","Aplicabilidad (JSON)"],["exceptions","Exceptions (one per line)","Excepciones (una por línea)"],["references","References (JSON)","Referencias (JSON)"]]:[["name","Name","Nombre"],["description","Description","Descripción"],["responsibleTrade","Responsible trade","Empresa responsable"],["applicability","Applicability (JSON)","Aplicabilidad (JSON)"],["constraints","Constraints (one per line)","Restricciones (una por línea)"],["advantages","Advantages (one per line)","Ventajas (una por línea)"],["disadvantages","Disadvantages (one per line)","Desventajas (una por línea)"],["requiredApprovals","Required approvals","Aprobaciones requeridas"],["rfiRequirement","RFI: never, conditional or required","RFI: never, conditional o required"],["details","Details (JSON)","Detalles (JSON)"],["conflictTypeIds","Conflict Type IDs","IDs de Tipos de Conflicto"],["ruleRevisionIds","Rule revision IDs","IDs de revisiones de reglas"]];
  return <aside className="knowledge-workspace" role="dialog" aria-modal="true" aria-labelledby="knowledge-rule-method-title"><header><div><span className="knowledge-code">{item.code}</span><h2 id="knowledge-rule-method-title">{text(isRule?item.title:item.name)}</h2><span className={`knowledge-status knowledge-status-${item.status}`}>● {item.status.replace("_"," ")}</span></div><button type="button" onClick={close} aria-label={t("Close detail","Cerrar detalle")}><X aria-hidden/></button></header>
    {item.status==="approved"&&<p className="knowledge-lock-note"><AlertTriangle aria-hidden/>{t("Approved content is immutable. Create a revision before editing.","El contenido aprobado es inmutable. Cree una revisión antes de editar.")}</p>}
    <div className="knowledge-workspace-actions">{mayEdit&&<button type="button" onClick={()=>setEditing(v=>!v)}><Edit3 aria-hidden/>{editing?t("View detail","Ver detalle"):t("Edit draft","Editar borrador")}</button>}</div>
    <section className="knowledge-workspace-body">{editing?<form className="knowledge-editor" onSubmit={event=>{event.preventDefault();void save();}}>{fields.map(([key,en,sp])=><label key={key}>{t(en,sp)}<textarea value={draft[key]??""} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))}/></label>)}<div className="knowledge-editor-buttons"><button type="button" onClick={()=>{setDraft(source);setEditing(false);}}>{t("Cancel","Cancelar")}</button><button type="submit" disabled={!dirty||saving}><Save aria-hidden/>{saving?t("Saving…","Guardando…"):t("Save draft only","Guardar solo borrador")}</button></div></form>:<pre className="knowledge-detail-json">{JSON.stringify(item,null,2)}</pre>}{message&&<p className="knowledge-workspace-message" role="status">{message}</p>}</section>
  </aside>;
}
