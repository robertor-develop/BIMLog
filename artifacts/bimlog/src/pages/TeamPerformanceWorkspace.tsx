import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Download, Info, Printer, RefreshCw, UsersRound } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Person = {
  userId: number; name: string; jobTitle: string; projectRole: string; evidenceLevel: string; lastActivity: string | null;
  observedCategories: { roles: string[]; workItems: string[]; packageTypes: string[] };
  tasks: { assigned: number; completed: number; blocked: number; completionRate: number | null };
  hours: { planned: string; actual: string; earned: string; efficiencyIndex: number | null };
  costs: { plannedInternal: string; actualInternal: string; averageInternalHourlyRate: string | null };
  delivery: { deliverables: number; approvedPackages: number; returnedPackages: number; overduePackages: number; qualityRate: number | null };
  explanations: { efficiencyIndex: string; qualityRate: string };
};
type Response = {
  project: { id: number; name: string; code: string }; period: { from: string | null; to: string | null };
  methodology: { source: string; limitations: string };
  totals: { assignedTasks: number; completedTasks: number; plannedHours: string; actualHours: string; earnedHours: string; approvedPackages: number; returnedPackages: number; efficiencyIndex: number | null };
  filters: { roles: string[]; workItems: string[]; packageTypes: string[] }; people: Person[];
};

const percent = (value: number | null) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const factor = (value: number | null) => value == null ? "—" : value.toFixed(2);
const money = (value: string | null) => value == null ? "—" : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function TeamPerformanceWorkspace() {
  const [, params] = useRoute("/projects/:id/commercial/team-performance");
  const projectId = Number(params?.id ?? 0);
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [member, setMember] = useState("all");
  const [category, setCategory] = useState("all");
  const [evidence, setEvidence] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to);
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/commercial/team-performance?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || tr("Unable to load team evidence.", "No se pudo cargar la evidencia del equipo."));
      setData(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("Unable to load team evidence.", "No se pudo cargar la evidencia del equipo.")); }
    finally { setLoading(false); }
  }, [from, projectId, to, token]);
  useEffect(() => { void load(); }, [projectId, token]);

  const categories = useMemo(() => data ? [...new Set([...data.filters.roles, ...data.filters.workItems, ...data.filters.packageTypes])].sort() : [], [data]);
  const people = useMemo(() => (data?.people ?? []).filter(person => {
    if (member !== "all" && String(person.userId) !== member) return false;
    if (evidence !== "all" && person.evidenceLevel !== evidence) return false;
    if (category !== "all" && ![...person.observedCategories.roles, ...person.observedCategories.workItems, ...person.observedCategories.packageTypes].includes(category)) return false;
    return true;
  }), [category, data, evidence, member]);

  function exportCsv() {
    const header = ["Member","Role","Observed categories","Assigned tasks","Completed tasks","Blocked tasks","Planned hours","Actual hours","Earned hours","Efficiency index","Deliverables","Approved packages","Returned packages","Overdue packages","Quality rate","Planned internal cost","Actual internal cost","Evidence level","Last activity"];
    const rows = people.map(person => [person.name, person.jobTitle || person.projectRole, [...person.observedCategories.roles,...person.observedCategories.workItems,...person.observedCategories.packageTypes].join(" | "), person.tasks.assigned, person.tasks.completed, person.tasks.blocked, person.hours.planned, person.hours.actual, person.hours.earned, factor(person.hours.efficiencyIndex), person.delivery.deliverables, person.delivery.approvedPackages, person.delivery.returnedPackages, person.delivery.overduePackages, percent(person.delivery.qualityRate), person.costs.plannedInternal, person.costs.actualInternal, person.evidenceLevel, person.lastActivity ?? ""]);
    const blob = new Blob([[header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${data?.project.code ?? "project"}-team-performance.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <FinancialProjectShell projectId={projectId} activeTab="team-performance">
    <style>{`.tp{max-width:1240px;margin:0 auto}.tp-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}.tp-kicker{font-size:11px;font-weight:850;letter-spacing:.11em;text-transform:uppercase;color:#2563eb}.tp h1{font-size:30px;margin:4px 0 7px}.tp-sub{color:hsl(var(--muted-foreground));max-width:760px;line-height:1.55}.tp-actions{display:flex;gap:8px}.tp button{border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:8px;padding:8px 11px;font-weight:700;font-size:12px;display:inline-flex;gap:6px;align-items:center;cursor:pointer}.tp button.primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.tp-method{display:flex;gap:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:13px;margin:17px 0;color:#1e3a5f;font-size:12px;line-height:1.55}.tp-method svg{flex:none}.tp-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;background:hsl(var(--card));border:1px solid hsl(var(--border));padding:14px;border-radius:12px}.tp-field label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:hsl(var(--muted-foreground));margin-bottom:5px}.tp-field select,.tp-field input{width:100%;height:36px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:0 8px}.tp-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0}.tp-kpi{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:12px;padding:14px}.tp-kpi span{font-size:10px;text-transform:uppercase;font-weight:800;color:hsl(var(--muted-foreground))}.tp-kpi strong{display:block;font-size:24px;margin-top:5px}.tp-grid{display:grid;gap:12px}.tp-person{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:13px;padding:16px;break-inside:avoid}.tp-person-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tp-person h2{font-size:17px;margin:0 0 3px}.tp-muted{font-size:12px;color:hsl(var(--muted-foreground))}.tp-level{font-size:10px;text-transform:uppercase;font-weight:850;border-radius:999px;padding:5px 8px;background:#eef2ff;color:#3730a3}.tp-categories{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}.tp-chip{font-size:10px;background:hsl(var(--muted));border-radius:999px;padding:4px 7px}.tp-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.tp-metric{border-top:1px solid hsl(var(--border));padding-top:9px}.tp-metric span{font-size:9px;text-transform:uppercase;color:hsl(var(--muted-foreground));font-weight:800}.tp-metric strong{display:block;font-size:15px;margin-top:3px}.tp-explain{font-size:10px;color:hsl(var(--muted-foreground));margin-top:10px}.tp-empty,.tp-error{padding:28px;text-align:center;border:1px dashed hsl(var(--border));border-radius:12px}.tp-error{color:#b91c1c;background:#fef2f2}@media(max-width:900px){.tp-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.tp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tp-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){.tp-filters,.tp-kpis,.tp-metrics{grid-template-columns:1fr}.tp h1{font-size:24px}}@media print{.sidebar,.project-context-bar,.tp-actions,.tp-filters,.feedback-widget{display:none!important}.main-area,.financial-page-content{margin:0!important;padding:0!important}.tp{max-width:none}.tp-person{box-shadow:none}}`}</style>
    <div className="tp">
      <header className="tp-head"><div><div className="tp-kicker">{tr("Commercial intelligence", "Inteligencia comercial")}</div><h1>{tr("Team Performance & Skills", "Rendimiento y Habilidades del Equipo")}</h1><p className="tp-sub">{tr("Understand capacity, delivery, quality signals, and observed work categories from verified Job Operations records—without AI rankings or invented history.", "Comprenda capacidad, entrega, señales de calidad y categorías de trabajo observadas desde registros verificados de Operaciones, sin rankings de IA ni historial inventado.")}</p></div><div className="tp-actions"><button onClick={exportCsv} disabled={!people.length}><Download size={14}/>{tr("Export CSV", "Exportar CSV")}</button><button onClick={() => window.print()}><Printer size={14}/>{tr("Print / PDF", "Imprimir / PDF")}</button></div></header>
      <div className="tp-method"><Info size={18}/><div><strong>{tr("How the numbers work: ", "Cómo funcionan los números: ")}</strong>{tr("Earned hours are planned task hours multiplied by recorded progress. Efficiency is earned hours divided by actual recorded hours. Quality is approved responsible packages divided by approved plus returned responsible packages. A dash means there is not enough evidence yet.", "Las horas ganadas son las horas planificadas de la tarea multiplicadas por el avance registrado. La eficiencia divide horas ganadas entre horas reales. La calidad divide paquetes aprobados entre paquetes aprobados más devueltos. Un guion indica que aún no existe evidencia suficiente.")}</div></div>
      <div className="tp-filters"><div className="tp-field"><label>{tr("Member", "Miembro")}</label><select value={member} onChange={e=>setMember(e.target.value)}><option value="all">{tr("All members", "Todos")}</option>{data?.people.map(person=><option key={person.userId} value={person.userId}>{person.name}</option>)}</select></div><div className="tp-field"><label>{tr("Category / discipline", "Categoría / disciplina")}</label><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">{tr("All observed categories", "Todas las categorías")}</option>{categories.map(item=><option key={item}>{item}</option>)}</select></div><div className="tp-field"><label>{tr("Evidence level", "Nivel de evidencia")}</label><select value={evidence} onChange={e=>setEvidence(e.target.value)}><option value="all">{tr("All levels", "Todos")}</option><option value="established">{tr("Established", "Establecida")}</option><option value="limited">{tr("Limited", "Limitada")}</option><option value="insufficient">{tr("Insufficient", "Insuficiente")}</option></select></div><div className="tp-field"><label>{tr("Actual hours from", "Horas reales desde")}</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="tp-field"><label>{tr("Actual hours to", "Horas reales hasta")}</label><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><button className="primary" onClick={()=>void load()}><RefreshCw size={14}/>{tr("Apply dates", "Aplicar fechas")}</button></div>
      {data && <div className="tp-kpis"><div className="tp-kpi"><span>{tr("People shown", "Personas visibles")}</span><strong>{people.length}</strong></div><div className="tp-kpi"><span>{tr("Tasks completed", "Tareas completadas")}</span><strong>{data.totals.completedTasks}/{data.totals.assignedTasks}</strong></div><div className="tp-kpi"><span>{tr("Planned / actual hours", "Horas planificadas / reales")}</span><strong>{data.totals.plannedHours} / {data.totals.actualHours}</strong></div><div className="tp-kpi"><span>{tr("Efficiency factor", "Factor de eficiencia")}</span><strong>{factor(data.totals.efficiencyIndex)}</strong></div><div className="tp-kpi"><span>{tr("Approved / returned", "Aprobados / devueltos")}</span><strong>{data.totals.approvedPackages} / {data.totals.returnedPackages}</strong></div></div>}
      {loading ? <div className="tp-empty">{tr("Loading verified operational evidence…", "Cargando evidencia operativa verificada…")}</div> : error ? <div className="tp-error">{error}</div> : !people.length ? <div className="tp-empty"><UsersRound size={24}/><p>{tr("No team evidence matches these filters. Activate work, assign tasks, record hours, and control work packages in Job Operations.", "Ninguna evidencia coincide con estos filtros. Active trabajo, asigne tareas, registre horas y controle paquetes en Operaciones.")}</p></div> : <div className="tp-grid">{people.map(person=><article className="tp-person" key={person.userId}><div className="tp-person-head"><div><h2>{person.name}</h2><div className="tp-muted">{person.jobTitle || person.projectRole} · {tr("Last evidence", "Última evidencia")}: {person.lastActivity ?? "—"}</div></div><span className="tp-level">{tr(person.evidenceLevel, person.evidenceLevel === "established" ? "establecida" : person.evidenceLevel === "limited" ? "limitada" : "insuficiente")}</span></div><div className="tp-categories">{[...person.observedCategories.roles,...person.observedCategories.workItems,...person.observedCategories.packageTypes].map(item=><span className="tp-chip" key={item}>{item.replaceAll("_"," ")}</span>)}</div><div className="tp-metrics"><div className="tp-metric"><span>{tr("Tasks A/C/B", "Tareas A/C/B")}</span><strong>{person.tasks.assigned}/{person.tasks.completed}/{person.tasks.blocked}</strong></div><div className="tp-metric"><span>{tr("Hours P/A/E", "Horas P/R/G")}</span><strong>{person.hours.planned}/{person.hours.actual}/{person.hours.earned}</strong></div><div className="tp-metric"><span>{tr("Efficiency", "Eficiencia")}</span><strong>{factor(person.hours.efficiencyIndex)}</strong></div><div className="tp-metric"><span>{tr("Quality", "Calidad")}</span><strong>{percent(person.delivery.qualityRate)}</strong></div><div className="tp-metric"><span>{tr("Deliverables", "Entregables")}</span><strong>{person.delivery.deliverables}</strong></div><div className="tp-metric"><span>{tr("Avg. internal rate", "Tarifa interna prom.")}</span><strong>{money(person.costs.averageInternalHourlyRate)}</strong></div></div><div className="tp-explain">{tr("Planned / actual internal cost", "Costo interno planificado / real")}: {money(person.costs.plannedInternal)} / {money(person.costs.actualInternal)} · {tr("Overdue responsible packages", "Paquetes responsables vencidos")}: {person.delivery.overduePackages}</div></article>)}</div>}
    </div>
  </FinancialProjectShell>;
}
