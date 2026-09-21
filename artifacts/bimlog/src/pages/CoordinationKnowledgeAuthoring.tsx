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
