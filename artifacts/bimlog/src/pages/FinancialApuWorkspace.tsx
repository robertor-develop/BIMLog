import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Plus, Save, Trash2 } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Line = { id: string; name: string; amount: string };
type Plan = {
  name: string; currency: string; sellingPrice: string; fixedCompanyCost: string;
  allocations: { labor: string; bonus: string; taskEarnings: string };
  laborSplit: { production: string; administrative: string };
  productionPhases: Line[]; administrativeLines: Line[];
  evaluation?: { netDistributableValue: string };
  version?: number; savedAt?: string;
};
const emptyPlan = (): Plan => ({
  name: "", currency: "USD", sellingPrice: "0.00", fixedCompanyCost: "0.00",
  allocations: { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" },
  laborSplit: { production: "0.00", administrative: "0.00" },
  productionPhases: [{ id: crypto.randomUUID(), name: "", amount: "0.00" }],
  administrativeLines: [{ id: crypto.randomUUID(), name: "", amount: "0.00" }],
});
const cents = (value: string) => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0") || "0");
};
const format = (value: bigint | null) => value == null ? "—" : `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
const total = (values: string[]) => values.reduce<bigint | null>((sum, value) => {
  const next = cents(value); return sum == null || next == null ? null : sum + next;
}, 0n);

export function FinancialApuWorkspace() {
  const { token } = useAuthStore();
  const { tt } = useI18n();
  const [, route] = useRoute("/projects/:id/financial/apu");
  const projectId = Number(route?.id);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "Cost & Value Planner could not be loaded.");
      setProjectName(String(body?.data?.project?.name ?? ""));
      setPlan(body?.data?.plan ?? emptyPlan());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Cost & Value Planner could not be loaded."); }
    finally { setLoading(false); }
  }, [projectId, token]);
  useEffect(() => { void load(); }, [load]);

  const values = useMemo(() => {
    const selling = cents(plan.sellingPrice), fixed = cents(plan.fixedCompanyCost);
    const net = selling == null || fixed == null ? null : selling - fixed;
    const allocations = total([plan.allocations.labor, plan.allocations.bonus, plan.allocations.taskEarnings]);
    const laborSplit = total([plan.laborSplit.production, plan.laborSplit.administrative]);
    const phases = total(plan.productionPhases.map((line) => line.amount));
    const admin = total(plan.administrativeLines.map((line) => line.amount));
    const balanced = net != null && net >= 0n && allocations === net && laborSplit === cents(plan.allocations.labor) && phases === cents(plan.laborSplit.production) && admin === cents(plan.laborSplit.administrative);
    return { net, allocations, laborSplit, phases, admin, balanced };
  }, [plan]);

  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(plan),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "The plan could not be saved.");
      setPlan(body.data.plan); setProjectName(String(body.data.project?.name ?? projectName));
      setMessage(tt("Saved. Reloading this page will preserve these exact values.", "Guardado. Al recargar esta página se conservarán estos valores exactos."));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The plan could not be saved."); }
    finally { setSaving(false); }
  };
  const setAllocation = (key: keyof Plan["allocations"], value: string) => setPlan((current) => ({ ...current, allocations: { ...current.allocations, [key]: value } }));
  const setSplit = (key: keyof Plan["laborSplit"], value: string) => setPlan((current) => ({ ...current, laborSplit: { ...current.laborSplit, [key]: value } }));
  const setLine = (key: "productionPhases" | "administrativeLines", id: string, field: "name" | "amount", value: string) => setPlan((current) => ({ ...current, [key]: current[key].map((line) => line.id === id ? { ...line, [field]: value } : line) }));
  const addLine = (key: "productionPhases" | "administrativeLines") => setPlan((current) => ({ ...current, [key]: [...current[key], { id: crypto.randomUUID(), name: "", amount: "0.00" }] }));
  const removeLine = (key: "productionPhases" | "administrativeLines", id: string) => setPlan((current) => ({ ...current, [key]: current[key].filter((line) => line.id !== id) }));

  return <FinancialProjectShell projectId={projectId} activeTab="apu">
    <main className="cvp" data-testid="financial-apu-workspace">
      <style>{styles}</style>
      <header><div><p className="eyebrow">{tt("Commercial", "Comercial")}</p><h1>{tt("Cost & Value Planner", "Planificador de Costos y Valor")}</h1><p>{tt("Build and preserve the complete value allocation for this project.", "Cree y conserve la distribución completa de valor para este proyecto.")}</p></div>{plan.version && <span className="version">v{plan.version}</span>}</header>
      {loading ? <section className="panel">{tt("Loading planner…", "Cargando planificador…")}</section> : error && !projectName ? <section className="panel error" role="alert">{error}<button onClick={() => void load()}>{tt("Retry", "Reintentar")}</button></section> : <>
        {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success">{message}</div>}
        <section className="panel"><h2>{tt("Plan setup", "Configuración del plan")}</h2><div className="fields three"><Field label={tt("Template name", "Nombre de plantilla")} value={plan.name} onChange={(value) => setPlan({ ...plan, name: value })}/><Field label={tt("Currency", "Moneda")} value={plan.currency} onChange={(value) => setPlan({ ...plan, currency: value.toUpperCase().slice(0, 3) })}/><div><span className="label">{tt("Project", "Proyecto")}</span><strong>{projectName}</strong></div></div></section>
        <section className="panel"><h2>{tt("Value foundation", "Base de valor")}</h2><div className="fields three"><Money label={tt("Selling Price", "Precio de venta")} value={plan.sellingPrice} onChange={(value) => setPlan({ ...plan, sellingPrice: value })}/><Money label={tt("Fixed Company Cost", "Costo fijo de empresa")} value={plan.fixedCompanyCost} onChange={(value) => setPlan({ ...plan, fixedCompanyCost: value })}/><Metric label={tt("Net Distributable Value", "Valor neto distribuible")} value={format(values.net)} currency={plan.currency}/></div></section>
        <section className="panel"><h2>{tt("Earnings allocation", "Distribución de ganancias")}</h2><div className="fields three"><Money label={tt("Labor", "Mano de obra")} value={plan.allocations.labor} onChange={(value) => setAllocation("labor", value)}/><Money label={tt("Bonus", "Bonificación")} value={plan.allocations.bonus} onChange={(value) => setAllocation("bonus", value)}/><Money label={tt("Task Earnings", "Ganancias por tareas")} value={plan.allocations.taskEarnings} onChange={(value) => setAllocation("taskEarnings", value)}/></div><Balance actual={values.allocations} expected={values.net}/></section>
        <section className="panel"><h2>{tt("Labor split", "División de mano de obra")}</h2><div className="fields two"><Money label={tt("Production", "Producción")} value={plan.laborSplit.production} onChange={(value) => setSplit("production", value)}/><Money label={tt("Administrative", "Administrativa")} value={plan.laborSplit.administrative} onChange={(value) => setSplit("administrative", value)}/></div><Balance actual={values.laborSplit} expected={cents(plan.allocations.labor)}/></section>
        <LineEditor title={tt("Production phases", "Fases de producción")} rows={plan.productionPhases} onAdd={() => addLine("productionPhases")} onChange={(id, field, value) => setLine("productionPhases", id, field, value)} onRemove={(id) => removeLine("productionPhases", id)} actual={values.phases} expected={cents(plan.laborSplit.production)} tt={tt}/>
        <LineEditor title={tt("Administrative budget lines", "Líneas de presupuesto administrativo")} rows={plan.administrativeLines} onAdd={() => addLine("administrativeLines")} onChange={(id, field, value) => setLine("administrativeLines", id, field, value)} onRemove={(id) => removeLine("administrativeLines", id)} actual={values.admin} expected={cents(plan.laborSplit.administrative)} tt={tt}/>
        <div className="savebar"><div><strong>{values.balanced ? tt("Plan balanced", "Plan balanceado") : tt("Finish balancing before saving", "Complete el balance antes de guardar")}</strong>{plan.savedAt && <small>{tt("Last saved", "Último guardado")}: {new Date(plan.savedAt).toLocaleString()}</small>}</div><button className="primary" disabled={!values.balanced || saving || !plan.name.trim()} onClick={() => void save()}><Save size={16}/>{saving ? tt("Saving…", "Guardando…") : tt("Save plan", "Guardar plan")}</button></div>
      </>}
    </main>
  </FinancialProjectShell>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function Money(props: { label: string; value: string; onChange: (value: string) => void }) { return <Field {...props}/>; }
function Metric({ label, value, currency }: { label: string; value: string; currency: string }) { return <div className="metric"><span className="label">{label}</span><strong>{value} {currency}</strong></div>; }
function Balance({ actual, expected }: { actual: bigint | null; expected: bigint | null }) { const ok = actual != null && expected != null && actual === expected; return <p className={ok ? "balance ok" : "balance"}>{ok ? "Balanced" : `Total ${format(actual)} / Required ${format(expected)}`}</p>; }
function LineEditor({ title, rows, onAdd, onChange, onRemove, actual, expected, tt }: { title: string; rows: Line[]; onAdd: () => void; onChange: (id: string, field: "name" | "amount", value: string) => void; onRemove: (id: string) => void; actual: bigint | null; expected: bigint | null; tt: (en: string, es: string) => string }) { return <section className="panel"><div className="section-title"><h2>{title}</h2><button onClick={onAdd}><Plus size={15}/>{tt("Add line", "Agregar línea")}</button></div><div className="lines">{rows.map((line) => <div className="line" key={line.id}><input aria-label={tt("Line name", "Nombre de línea")} placeholder={tt("Name", "Nombre")} value={line.name} onChange={(event) => onChange(line.id, "name", event.target.value)}/><input aria-label={tt("Line amount", "Monto de línea")} value={line.amount} onChange={(event) => onChange(line.id, "amount", event.target.value)}/><button aria-label={tt("Remove line", "Eliminar línea")} onClick={() => onRemove(line.id)}><Trash2 size={15}/></button></div>)}</div><Balance actual={actual} expected={expected}/></section>; }

const styles = `.cvp{max-width:1100px;margin:0 auto;padding:24px 24px 104px;display:grid;gap:16px}.cvp header{display:flex;justify-content:space-between;gap:16px}.cvp h1{margin:2px 0 6px;font-size:29px}.cvp h2{font-size:17px;margin:0 0 14px}.cvp p{margin:0;color:hsl(var(--muted-foreground))}.eyebrow,.label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:hsl(var(--muted-foreground));margin-bottom:6px}.version{border:1px solid hsl(var(--border));border-radius:99px;padding:7px 10px;height:max-content}.panel{border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--card));padding:18px}.fields{display:grid;gap:12px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}input{width:100%;box-sizing:border-box;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:10px 11px;font:inherit}.metric{border-radius:9px;background:hsl(var(--muted)/.55);padding:10px 12px}.metric strong{font-size:18px}.balance{margin-top:10px!important;font-size:12px;color:#B45309!important}.balance.ok{color:#15803D!important}.section-title,.savebar{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-title h2{margin:0}.section-title button,.line button,.panel button{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:7px 9px;cursor:pointer}.lines{display:grid;gap:8px;margin-top:14px}.line{display:grid;grid-template-columns:1fr 180px auto;gap:8px}.notice{padding:11px 13px;border-radius:8px}.notice.error,.panel.error{border:1px solid #DC262666;background:#FEF2F2;color:#991B1B}.notice.success{border:1px solid #16A34A55;background:#F0FDF4;color:#166534}.savebar{position:sticky;bottom:12px;background:hsl(var(--card));border:1px solid hsl(var(--border));box-shadow:0 8px 24px #0002;border-radius:12px;padding:14px 16px;z-index:2}.savebar div{display:grid}.savebar small{color:hsl(var(--muted-foreground));margin-top:4px}.primary{display:inline-flex;align-items:center;gap:7px;background:#1D4ED8;color:white;border:0;border-radius:8px;padding:10px 14px;font-weight:750;cursor:pointer}.primary:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.cvp{padding:15px 15px 32px}.fields.three,.fields.two{grid-template-columns:1fr}.line{grid-template-columns:1fr 120px auto}.savebar{position:static;align-items:flex-start;flex-direction:column}}`;
