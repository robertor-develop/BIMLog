import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { downloadAuthenticatedPdf } from "@/components/PrintPdfButton";

type Report = { id:number; projectId:number; fileName:string; reportNumber?:string|null; format?:string|null; totalItems?:number|null; status?:string|null; createdAt?:string|null };
type Item = { id:number; trade?:string|null; submittalType?:string|null; floor?:string|null; fileName?:string|null; description?:string|null; submittalStatus?:string|null; date?:string|null; openItems?:string|null; rfiOpen?:string|null };

const API="/api/v1";
export function ProjectsSubmittalReports(){
  const [location]=useLocation();
  const projectId=Number(location.match(/^\/projects\/(\d+)\/submittal-reports/)?.[1]);
  const {token}=useAuthStore();
  const {lang}=useI18n();
  const t=(en:string,es:string)=>lang==="es"?es:en;
  const headers={Authorization:`Bearer ${token}`};
  const jsonHeaders={...headers,"Content-Type":"application/json"};
  const [reports,setReports]=useState<Report[]>([]),[selected,setSelected]=useState<Report|null>(null),[items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
  const [name,setName]=useState(""),[number,setNumber]=useState(""),[draft,setDraft]=useState({trade:"",submittalType:"",floor:"",fileName:"",description:""});
  const title=useMemo(()=>selected?.reportNumber||selected?.fileName||t("Submittal Tracker","Registro de Submittals"),[selected,lang]);

  async function readJson(response:Response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||`${response.status}`);return data;}
  async function loadReports(preferred?:number){setLoading(true);setError("");try{const data=await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports`,{headers}));setReports(data);const next=data.find((row:Report)=>row.id===(preferred??selected?.id))||null;setSelected(next);if(next)await loadReport(next.id);else setItems([]);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
  async function loadReport(id:number){const data=await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${id}`,{headers}));setSelected(data.report);setItems(data.items);setName(data.report.fileName||"");setNumber(data.report.reportNumber||"");}
  async function act(work:()=>Promise<void>,success:string){if(busy)return;setBusy(true);setError("");setStatus("");try{await work();setStatus(success);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  const create=()=>act(async()=>{const row=await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports`,{method:"POST",headers:jsonHeaders,body:JSON.stringify({fileName:t("New Submittal Tracker","Nuevo Registro de Submittals")})}));await loadReports(row.id);},t("Tracker created and reopened.","Registro creado y reabierto."));
  const rename=()=>selected&&act(async()=>{await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${selected.id}/rename`,{method:"PATCH",headers:jsonHeaders,body:JSON.stringify({fileName:name,reportNumber:number})}));await loadReports(selected.id);},t("Tracker identity saved and reopened.","Identidad guardada y reabierta."));
  const addItem=()=>selected&&act(async()=>{await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${selected.id}/items`,{method:"POST",headers:jsonHeaders,body:JSON.stringify(draft)}));setDraft({trade:"",submittalType:"",floor:"",fileName:"",description:""});await loadReports(selected.id);},t("Item added and reopened.","Elemento agregado y reabierto."));
  const patchItem=(item:Item,patch:Partial<Item>)=>selected&&act(async()=>{await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${selected.id}/items/${item.id}`,{method:"PATCH",headers:jsonHeaders,body:JSON.stringify(patch)}));await loadReport(selected.id);},t("Item saved and reopened.","Elemento guardado y reabierto."));
  const removeItem=(item:Item)=>selected&&act(async()=>{await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${selected.id}/items/${item.id}`,{method:"DELETE",headers}));await loadReports(selected.id);},t("Item deleted.","Elemento eliminado."));
  const removeReport=()=>selected&&act(async()=>{await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/${selected.id}`,{method:"DELETE",headers}));setSelected(null);await loadReports();},t("Tracker deleted.","Registro eliminado."));
  const upload=(file?:File)=>file&&act(async()=>{const body=new FormData();body.append("file",file);const receipt=await readJson(await fetch(`${API}/projects/${projectId}/submittal-reports/upload`,{method:"POST",headers,body}));await loadReports(receipt.report_id);},t("Import saved and reopened.","Importación guardada y reabierta."));
  const pdf=()=>selected&&token&&act(async()=>{await downloadAuthenticatedPdf(`${API}/projects/${projectId}/submittal-reports/${selected.id}/pdf`,token,`${selected.reportNumber||"submittal-tracker"}.pdf`);},t("PDF exported.","PDF exportado."));
  useEffect(()=>{if(Number.isSafeInteger(projectId)&&projectId>0)void loadReports();},[projectId,token]);

  return <main id="main-content" tabIndex={-1} style={{padding:"24px clamp(16px,4vw,44px)",display:"grid",gap:18}}>
    <header><h1>{t("Submittal Tracking Reports","Reportes de Seguimiento de Submittals")}</h1><p>{t("Create, import, maintain, and export the project’s detailed submittal registers. The main Submittals module remains the place for package review and decisions.","Cree, importe, mantenga y exporte los registros detallados de submittals. El módulo principal de Submittals sigue siendo el lugar para revisar paquetes y decisiones.")}</p><p><strong>{t("Permission state:","Estado de permiso:")}</strong> {t("Write actions remain visible; BIMLog verifies your project permission before saving.","Las acciones de escritura permanecen visibles; BIMLog verifica su permiso del proyecto antes de guardar.")}</p></header>
    <section aria-label={t("Tracker actions","Acciones del registro")} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={create} disabled={busy}>{t("New tracker","Nuevo registro")}</button>
      <label>{t("Import spreadsheet or document","Importar hoja o documento")} <input type="file" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value="";}} /></label>
      <button onClick={()=>void loadReports(selected?.id)} disabled={busy}>{t("Refresh","Actualizar")}</button>
    </section>
    {loading&&<p role="status" aria-live="polite">{t("Loading trackers…","Cargando registros…")}</p>}{error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}{status&&<p role="status" aria-live="polite" style={{color:"#166534"}}>{status}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:18,alignItems:"start"}}>
      <section aria-labelledby="tracker-list"><h2 id="tracker-list">{t("Saved trackers","Registros guardados")}</h2>{reports.length===0&&!loading?<p>{t("No trackers yet.","Aún no hay registros.")}</p>:<ul>{reports.map(report=><li key={report.id}><button onClick={()=>void loadReport(report.id)} aria-current={selected?.id===report.id}>{report.reportNumber||t("Unnumbered","Sin número")} — {report.fileName} ({report.totalItems||0})</button></li>)}</ul>}</section>
      <section aria-labelledby="tracker-detail"><h2 id="tracker-detail">{title}</h2>{!selected?<p>{t("Select a tracker to inspect its state, items, and next actions.","Seleccione un registro para revisar su estado, elementos y siguientes acciones.")}</p>:<>
        <p>{t("State","Estado")}: <strong>{selected.status||"complete"}</strong> · {t("Items","Elementos")}: {items.length} · {t("Next","Siguiente")}: {t("maintain rows or export the governed PDF.","mantenga filas o exporte el PDF controlado.")}</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input aria-label={t("Tracker name","Nombre del registro")} value={name} onChange={e=>setName(e.target.value)}/><input aria-label={t("Report number","Número de reporte")} value={number} onChange={e=>setNumber(e.target.value)}/><button onClick={rename} disabled={busy}>{t("Save identity","Guardar identidad")}</button><button onClick={pdf} disabled={busy}>{t("Export PDF","Exportar PDF")}</button><button onClick={removeReport} disabled={busy}>{t("Delete tracker","Eliminar registro")}</button></div>
        <fieldset style={{marginTop:16}}><legend>{t("Add item","Agregar elemento")}</legend>{Object.entries(draft).map(([key,value])=><input key={key} aria-label={key} placeholder={key} value={value} onChange={e=>setDraft(current=>({...current,[key]:e.target.value}))}/>)}<button onClick={addItem} disabled={busy||!draft.fileName}>{t("Add and reopen","Agregar y reabrir")}</button></fieldset>
        <div style={{overflowX:"auto",marginTop:16}}><table><thead><tr>{[t("Trade","Disciplina"),t("Type","Tipo"),t("Floor","Nivel"),t("File / title","Archivo / título"),t("Status","Estado"),t("Actions","Acciones")].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.trade||"—"}</td><td>{item.submittalType||"—"}</td><td>{item.floor||"—"}</td><td>{item.fileName||item.description||"—"}</td><td>{item.submittalStatus||"—"}</td><td><button onClick={()=>void patchItem(item,{submittalStatus:item.submittalStatus==="approved"?"pending":"approved"})} disabled={busy}>{t("Toggle review state","Cambiar estado")}</button> <button onClick={()=>void removeItem(item)} disabled={busy}>{t("Delete","Eliminar")}</button></td></tr>)}</tbody></table></div>
      </>}</section>
    </div>
  </main>;
}
export default ProjectsSubmittalReports;
