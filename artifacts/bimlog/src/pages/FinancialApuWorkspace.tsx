import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, Download, FileSpreadsheet, Info, Plus, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const forecastStyles = `.forecast-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.scenario{display:grid;gap:5px;border:1px solid hsl(var(--border));border-radius:10px;padding:12px}.scenario strong{text-transform:capitalize}.scenario span{font-size:12px}.forecast-status{margin-top:12px!important;padding:8px 10px;border-radius:8px;font-weight:800;text-transform:capitalize}.forecast-status.healthy{background:#DCFCE7;color:#166534}.forecast-status.warning{background:#FEF3C7;color:#92400E}.forecast-status.critical{background:#FEE2E2;color:#991B1B}.mode-switch{display:flex;gap:6px}.mode-switch .selected{background:#1D4ED8!important;color:white!important}.calculated-amounts{font-size:12px;color:hsl(var(--muted-foreground));margin-top:10px}@media(max-width:760px){.forecast-scenarios{grid-template-columns:1fr}}`;
type Line = { id: string; name: string; amount: string };
type Plan = {
  name: string; currency: string; sellingPrice: string; fixedCompanyCost: string;
  allocationMode: "amount" | "percentage";
  allocationPercentages: { labor: string; bonus: string; taskEarnings: string };
  allocations: { labor: string; bonus: string; taskEarnings: string };
  laborSplit: { production: string; administrative: string };
  productionPhases: Line[]; administrativeLines: Line[];
  evaluation?: { netDistributableValue: string };
  version?: number; savedAt?: string;
};
type PerformanceInput = {
  snapshotDate: string; label: string; plannedValue: string; earnedValue: string; actualCost: string;
  baselineStartDate: string | null; baselineEndDate: string | null; sourceNote: string;
};
type PerformanceSnapshot = PerformanceInput & {
  version: number; savedAt: string;
  evaluation: { cpi: string | null; spi: string | null; spiAvailabilityReason: string | null; bonusPayoutPercent: string; bonusEligibleAmount: string };
};
type ForecastSnapshot = { label: string; sourceNote: string; forecastDate: string; version: number; savedAt: string; evaluation: { budgetAtCompletion: string; costVariance: string; scheduleVariance: string; cpi: string | null; spi: string | null; tcpi: string | null; status: string; scenarios: Array<{ name: string; eac: string; etc: string; vac: string; forecastCpi: string | null; projectedMargin: string; projectedBonusPercent: string; projectedBonusAmount: string }> } };
const emptyPlan = (): Plan => ({
  name: "", currency: "USD", sellingPrice: "0.00", fixedCompanyCost: "0.00",
  allocationMode: "amount", allocationPercentages: { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" },
  allocations: { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" },
  laborSplit: { production: "0.00", administrative: "0.00" },
  productionPhases: [{ id: crypto.randomUUID(), name: "", amount: "0.00" }],
  administrativeLines: [{ id: crypto.randomUUID(), name: "", amount: "0.00" }],
});
const emptyPerformance = (): PerformanceInput => ({
  snapshotDate: new Date().toISOString().slice(0, 10), label: "",
  plannedValue: "0.00", earnedValue: "0.00", actualCost: "0.00",
  baselineStartDate: null, baselineEndDate: null, sourceNote: "",
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
const normalizeTwoDecimals = (value: string) => { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number.toFixed(2) : value; };
const percentBasisPoints = (value: string) => { if (!/^(?:0|[1-9]\d?|100)(?:\.\d{0,2})?$/.test(value.trim())) return null; const [whole, fraction = ""] = value.trim().split("."); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")); };
const amountForPercent = (base: bigint | null, percent: string) => {
  const basisPoints = percentBasisPoints(percent);
  return base == null || basisPoints == null ? null : (base * basisPoints + 5_000n) / 10_000n;
};
const percentForAmount = (amount: string, base: bigint | null) => {
  const amountValue = cents(amount);
  if (amountValue == null || base == null || base <= 0n) return "0.00";
  return (Number((amountValue * 1_000_000n + base / 2n) / base) / 100).toFixed(2);
};
const derivedTopPercentages = (labor: string, bonus: string, net: bigint | null) => {
  if (net == null || net <= 0n) return { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" };
  const laborPoints = percentBasisPoints(percentForAmount(labor, net)) ?? 0n;
  const bonusPoints = percentBasisPoints(percentForAmount(bonus, net)) ?? 0n;
  const earningsPoints = laborPoints + bonusPoints <= 10_000n ? 10_000n - laborPoints - bonusPoints : 0n;
  return { labor: format(laborPoints), bonus: format(bonusPoints), taskEarnings: format(earningsPoints) };
};
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

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
  const [guideOpen, setGuideOpen] = useState(false);
  const [performance, setPerformance] = useState<PerformanceInput>(emptyPerformance);
  const [latestPerformance, setLatestPerformance] = useState<PerformanceSnapshot | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceSnapshot[]>([]);
  const [performanceSaving, setPerformanceSaving] = useState(false);
  const [forecast, setForecast] = useState({ label: "", sourceNote: "" });
  const [latestForecast, setLatestForecast] = useState<ForecastSnapshot | null>(null);
  const [forecastHistory, setForecastHistory] = useState<ForecastSnapshot[]>([]);
  const [forecastSaving, setForecastSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "Cost & Value Planner could not be loaded.");
      setProjectName(String(body?.data?.project?.name ?? ""));
      if (body?.data?.plan) {
        const loaded = { ...emptyPlan(), ...body.data.plan, allocationPercentages: { ...emptyPlan().allocationPercentages, ...(body.data.plan.allocationPercentages ?? {}) } };
        const selling = cents(loaded.sellingPrice), fixed = cents(loaded.fixedCompanyCost);
        const net = selling != null && fixed != null ? selling - fixed : null;
        setPlan({ ...loaded, allocationPercentages: derivedTopPercentages(loaded.allocations.labor, loaded.allocations.bonus, net) });
      } else setPlan(emptyPlan());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Cost & Value Planner could not be loaded."); }
    finally { setLoading(false); }
  }, [projectId, token]);
  useEffect(() => { void load(); }, [load]);
  const loadPerformance = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/performance`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "Performance history could not be loaded.");
      setLatestPerformance(body?.data?.latest ?? null);
      setPerformanceHistory(body?.data?.history ?? []);
      if (body?.data?.latest) {
        const { snapshotDate, label, plannedValue, earnedValue, actualCost, baselineStartDate, baselineEndDate, sourceNote } = body.data.latest;
        setPerformance({ snapshotDate, label, plannedValue, earnedValue, actualCost, baselineStartDate, baselineEndDate, sourceNote });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Performance history could not be loaded."); }
  }, [projectId, token]);
  useEffect(() => { void loadPerformance(); }, [loadPerformance]);
  const loadForecast = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/forecast`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "Forecast history could not be loaded.");
      setLatestForecast(body?.data?.latest ?? null); setForecastHistory(body?.data?.history ?? []);
      if (body?.data?.latest) setForecast({ label: body.data.latest.label, sourceNote: body.data.latest.sourceNote });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Forecast history could not be loaded."); }
  }, [projectId, token]);
  useEffect(() => { void loadForecast(); }, [loadForecast]);

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
  const savePerformance = async () => {
    setPerformanceSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/performance`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(performance),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "The performance snapshot could not be saved.");
      setLatestPerformance(body.data.latest); setPerformanceHistory(body.data.history ?? []);
      setMessage(tt("Performance snapshot saved and bonus eligibility recalculated.", "Instantánea de rendimiento guardada y elegibilidad del bono recalculada."));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The performance snapshot could not be saved."); }
    finally { setPerformanceSaving(false); }
  };
  const exportPerformance = async () => {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/performance.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Performance export could not be created.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `cost-value-performance-project-${projectId}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Performance export could not be created."); }
  };
  const saveForecast = async () => {
    setForecastSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/forecast`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(forecast) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.en || body?.error || "The forecast could not be saved.");
      setLatestForecast(body.data.latest); setForecastHistory(body.data.history ?? []);
      setMessage(tt("Forecast calculated and preserved from the latest plan and performance snapshot.", "Pronóstico calculado y preservado desde el plan y la instantánea de rendimiento más recientes."));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The forecast could not be saved."); }
    finally { setForecastSaving(false); }
  };
  const exportForecast = async () => {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu/forecast.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Forecast export could not be created.");
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `cost-value-forecast-project-${projectId}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Forecast export could not be created."); }
  };
  const setFoundation = (key: "sellingPrice" | "fixedCompanyCost", value: string) => setPlan((current) => {
    const next = { ...current, [key]: value };
    const selling = cents(next.sellingPrice), fixed = cents(next.fixedCompanyCost);
    if (selling == null || fixed == null || fixed > selling) return next;
    const net = selling - fixed;
    if (next.allocationMode === "percentage") {
      const laborPoints = percentBasisPoints(next.allocationPercentages.labor), bonusPoints = percentBasisPoints(next.allocationPercentages.bonus);
      if (laborPoints == null || bonusPoints == null || laborPoints + bonusPoints > 10_000n) return next;
      const labor = (net * laborPoints + 5_000n) / 10_000n, bonus = (net * bonusPoints + 5_000n) / 10_000n;
      return { ...next, allocations: { labor: format(labor), bonus: format(bonus), taskEarnings: format(net - labor - bonus) } };
    }
    const labor = cents(next.allocations.labor), bonus = cents(next.allocations.bonus);
    if (labor == null || bonus == null || labor + bonus > net) return next;
    return { ...next, allocations: { ...next.allocations, taskEarnings: format(net - labor - bonus) }, allocationPercentages: derivedTopPercentages(next.allocations.labor, next.allocations.bonus, net) };
  });
  const setAllocation = (key: "labor" | "bonus", value: string) => setPlan((current) => {
    const net = cents(current.sellingPrice) != null && cents(current.fixedCompanyCost) != null ? cents(current.sellingPrice)! - cents(current.fixedCompanyCost)! : null;
    const otherKey = key === "labor" ? "bonus" : "labor";
    const edited = cents(value), other = cents(current.allocations[otherKey]);
    const remainder = net != null && edited != null && other != null && edited + other <= net ? net - edited - other : null;
    const allocations = { ...current.allocations, [key]: value, ...(remainder == null ? {} : { taskEarnings: format(remainder) }) };
    return {
      ...current,
      allocationMode: "amount",
      allocations,
      allocationPercentages: derivedTopPercentages(allocations.labor, allocations.bonus, net),
    };
  });
  const setAllocationPercent = (key: keyof Plan["allocationPercentages"], value: string) => setPlan((current) => {
    if (key === "taskEarnings") return current;
    const otherKey = key === "labor" ? "bonus" : "labor";
    const edited = percentBasisPoints(value), other = percentBasisPoints(current.allocationPercentages[otherKey]);
    const remainder = edited != null && other != null && edited + other <= 10_000n ? 10_000n - edited - other : null;
    const allocationPercentages = { ...current.allocationPercentages, [key]: value, ...(remainder == null ? {} : { taskEarnings: format(remainder) }) };
    const parts = [percentBasisPoints(allocationPercentages.labor), percentBasisPoints(allocationPercentages.bonus), percentBasisPoints(allocationPercentages.taskEarnings)];
    const net = cents(current.sellingPrice) != null && cents(current.fixedCompanyCost) != null ? cents(current.sellingPrice)! - cents(current.fixedCompanyCost)! : null;
    if (net == null || parts.some((part) => part == null) || parts.reduce<bigint>((sum, part) => sum + (part ?? 0n), 0n) !== 10_000n) return { ...current, allocationMode: "percentage", allocationPercentages };
    const labor = (net * parts[0]! + 5_000n) / 10_000n, bonus = (net * parts[1]! + 5_000n) / 10_000n, taskEarnings = net - labor - bonus;
    return { ...current, allocationMode: "percentage", allocationPercentages, allocations: { labor: format(labor), bonus: format(bonus), taskEarnings: format(taskEarnings) } };
  });
  const setSplitAmount = (key: keyof Plan["laborSplit"], value: string) => setPlan((current) => {
    const base = cents(current.allocations.labor), edited = cents(value);
    const otherKey = key === "production" ? "administrative" : "production";
    const remainder = base != null && edited != null && edited <= base ? base - edited : null;
    return { ...current, laborSplit: { ...current.laborSplit, [key]: value, ...(remainder == null ? {} : { [otherKey]: format(remainder) }) } };
  });
  const setSplitPercent = (key: keyof Plan["laborSplit"], value: string) => setPlan((current) => {
    const base = cents(current.allocations.labor), amount = amountForPercent(base, value);
    if (base == null || amount == null || amount > base) return current;
    const otherKey = key === "production" ? "administrative" : "production";
    return { ...current, laborSplit: { ...current.laborSplit, [key]: format(amount), [otherKey]: format(base - amount) } };
  });
  const setLine = (key: "productionPhases" | "administrativeLines", id: string, field: "name" | "amount", value: string) => setPlan((current) => ({ ...current, [key]: current[key].map((line) => line.id === id ? { ...line, [field]: value } : line) }));
  const setLinePercent = (key: "productionPhases" | "administrativeLines", id: string, value: string) => setPlan((current) => {
    const base = cents(key === "productionPhases" ? current.laborSplit.production : current.laborSplit.administrative);
    const amount = amountForPercent(base, value);
    if (amount == null) return current;
    return { ...current, [key]: current[key].map((line) => line.id === id ? { ...line, amount: format(amount) } : line) };
  });
  const addLine = (key: "productionPhases" | "administrativeLines") => setPlan((current) => ({ ...current, [key]: [...current[key], { id: crypto.randomUUID(), name: "", amount: "0.00" }] }));
  const removeLine = (key: "productionPhases" | "administrativeLines", id: string) => setPlan((current) => ({ ...current, [key]: current[key].filter((line) => line.id !== id) }));
  const loadSampleTemplate = () => setPlan((current) => {
    const selling = cents(current.sellingPrice), fixed = cents(current.fixedCompanyCost);
    const net = selling != null && fixed != null && selling >= fixed ? selling - fixed : 0n;
    const labor = (net * 7_000n + 5_000n) / 10_000n;
    const incentive = (net * 2_000n + 5_000n) / 10_000n;
    const earnings = net - labor - incentive;
    const production = (labor * 8_500n + 5_000n) / 10_000n;
    const administrative = labor - production;
    const phaseAmounts = [4_500n, 3_500n, 1_500n].map((percent) => (production * percent + 5_000n) / 10_000n);
    phaseAmounts.push(production - phaseAmounts.reduce((sum, amount) => sum + amount, 0n));
    return {
      ...current,
      name: current.name || "BIM services standard",
      allocationMode: "percentage",
      allocationPercentages: { labor: "70.00", bonus: "20.00", taskEarnings: "10.00" },
      allocations: { labor: format(labor), bonus: format(incentive), taskEarnings: format(earnings) },
      laborSplit: { production: format(production), administrative: format(administrative) },
      productionPhases: ["Preliminary", "Coordination", "For Record", "As-Built"].map((name, index) => ({ id: crypto.randomUUID(), name, amount: format(phaseAmounts[index]!) })),
      administrativeLines: [{ id: crypto.randomUUID(), name: "Project administration", amount: format(administrative) }],
    };
  });
  const exportPlanCsv = () => {
    const rows = [
      ["Cost & Value Plan", plan.name], ["Project", projectName], ["Version", plan.version ?? "Draft"], ["Currency", plan.currency],
      ["Selling Price", plan.sellingPrice], ["Fixed Company Cost", plan.fixedCompanyCost], ["Net Distributable Value", format(values.net)],
      ["Labor Operating Pool", plan.allocations.labor], ["Project Incentive Reserve", plan.allocations.bonus], ["Project Earnings", plan.allocations.taskEarnings],
      ["Direct Production Labor", plan.laborSplit.production], ["Project Administrative Labor", plan.laborSplit.administrative],
      ...plan.productionPhases.map((line) => [`Production Phase: ${line.name}`, line.amount]),
      ...plan.administrativeLines.map((line) => [`Administrative Line: ${line.name}`, line.amount]),
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `cost-value-plan-project-${projectId}-v${plan.version ?? "draft"}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <FinancialProjectShell projectId={projectId} activeTab="apu">
    <main className="cvp" data-testid="financial-apu-workspace">
      <style>{styles}</style><style>{allocationStyles}</style><style>{forecastStyles}</style>
      <header><div><button className="text-action" onClick={() => window.history.back()}><ArrowLeft size={15}/>{tt("Back", "Volver")}</button><p className="eyebrow">{tt("Commercial", "Comercial")}</p><h1>{tt("Cost & Value Planner", "Planificador de Costos y Valor")}</h1><p>{tt("Build and preserve the complete value allocation for this project.", "Cree y conserve la distribución completa de valor para este proyecto.")}</p></div><div className="header-actions"><button onClick={() => setGuideOpen((open) => !open)}><Info size={15}/>{tt("Guide", "Guía")}</button>{plan.version && <span className="version">v{plan.version}</span>}</div></header>
      {loading ? <section className="panel">{tt("Loading planner…", "Cargando planificador…")}</section> : error && !projectName ? <section className="panel error" role="alert">{error}<button onClick={() => void load()}>{tt("Retry", "Reintentar")}</button></section> : <>
        {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success">{message}</div>}
        {guideOpen && <section className="panel guide" data-testid="cost-value-guide"><div className="section-title"><div><p className="eyebrow">{tt("How it works", "Cómo funciona")}</p><h2>{tt("From selling price to an accountable operating plan", "Del precio de venta a un plan operativo responsable")}</h2></div><button onClick={() => setGuideOpen(false)}>{tt("Close", "Cerrar")}</button></div><ol><li>{tt("Selling Price minus Fixed Company Cost creates Net Distributable Value.", "El Precio de Venta menos el Costo Fijo de Empresa crea el Valor Neto Distribuible.")}</li><li>{tt("Allocate that value to the Labor Operating Pool, Project Incentive Reserve, and Project Earnings.", "Distribuya ese valor al Fondo Operativo de Mano de Obra, Reserva de Incentivos del Proyecto y Ganancias del Proyecto.")}</li><li>{tt("Split labor into Direct Production and Project Administration, then distribute each pool by phase or budget line.", "Divida la mano de obra en Producción Directa y Administración del Proyecto, luego distribuya cada fondo por fase o línea presupuestaria.")}</li><li>{tt("Enter either an amount or a percentage. The other value is calculated automatically; the final top-level category receives the remainder.", "Ingrese un monto o porcentaje. El otro valor se calcula automáticamente; la categoría final de nivel superior recibe el remanente.")}</li><li>{tt("Save creates an immutable project version. Performance and forecasting use the latest saved version.", "Guardar crea una versión inmutable del proyecto. Rendimiento y pronóstico utilizan la última versión guardada.")}</li></ol><p>{tt("Hourly selling rates, contracted hours, submittals, tasks, and employee compensation belong to the Contract Item engine and are not fabricated in this planner.", "Las tarifas de venta por hora, horas contratadas, submittals, tareas y compensación de empleados pertenecen al motor de Partidas de Contrato y no se inventan en este planificador.")}</p></section>}
        <section className="panel"><div className="section-title"><h2>{tt("Plan setup", "Configuración del plan")}</h2><button onClick={loadSampleTemplate}>{tt("Use BIM services sample", "Usar ejemplo de servicios BIM")}</button></div><div className="fields three"><Field label={tt("Template name", "Nombre de plantilla")} value={plan.name} onChange={(value) => setPlan({ ...plan, name: value })}/><Field label={tt("Currency", "Moneda")} value={plan.currency} onChange={(value) => setPlan({ ...plan, currency: value.toUpperCase().slice(0, 3) })}/><div><span className="label">{tt("Project", "Proyecto")}</span><strong>{projectName}</strong></div></div></section>
        <section className="panel"><h2>{tt("Value foundation", "Base de valor")}</h2><div className="fields three"><Money label={tt("Selling Price", "Precio de venta")} value={plan.sellingPrice} onChange={(value) => setFoundation("sellingPrice", value)}/><Money label={tt("Fixed Company Cost", "Costo fijo de empresa")} value={plan.fixedCompanyCost} onChange={(value) => setFoundation("fixedCompanyCost", value)}/><Metric label={tt("Net Distributable Value", "Valor neto distribuible")} value={format(values.net)} currency={plan.currency}/></div></section>
        <section className="panel"><h2>{tt("Net value allocation", "Distribución del valor neto")}</h2><div className="allocation-grid"><AllocationRow label={tt("Labor Operating Pool", "Fondo Operativo de Mano de Obra")} amount={plan.allocations.labor} percent={plan.allocationPercentages.labor} onAmount={(value) => setAllocation("labor", value)} onPercent={(value) => setAllocationPercent("labor", value)}/><AllocationRow label={tt("Project Incentive Reserve", "Reserva de Incentivos del Proyecto")} amount={plan.allocations.bonus} percent={plan.allocationPercentages.bonus} onAmount={(value) => setAllocation("bonus", value)} onPercent={(value) => setAllocationPercent("bonus", value)}/><AllocationRow label={tt("Project Earnings (automatic remainder)", "Ganancias del Proyecto (remanente automático)")} amount={plan.allocations.taskEarnings} percent={plan.allocationPercentages.taskEarnings} readOnly/></div><Balance actual={values.allocations} expected={values.net}/></section>
        <section className="panel"><h2>{tt("Labor Operating Pool split", "División del Fondo Operativo de Mano de Obra")}</h2><div className="allocation-grid"><AllocationRow label={tt("Direct Production Labor", "Mano de Obra de Producción Directa")} amount={plan.laborSplit.production} percent={percentForAmount(plan.laborSplit.production, cents(plan.allocations.labor))} onAmount={(value) => setSplitAmount("production", value)} onPercent={(value) => setSplitPercent("production", value)}/><AllocationRow label={tt("Project Administrative Labor", "Mano de Obra Administrativa del Proyecto")} amount={plan.laborSplit.administrative} percent={percentForAmount(plan.laborSplit.administrative, cents(plan.allocations.labor))} onAmount={(value) => setSplitAmount("administrative", value)} onPercent={(value) => setSplitPercent("administrative", value)}/></div><Balance actual={values.laborSplit} expected={cents(plan.allocations.labor)}/></section>
        <LineEditor title={tt("Direct production phases", "Fases de producción directa")} rows={plan.productionPhases} base={cents(plan.laborSplit.production)} onAdd={() => addLine("productionPhases")} onChange={(id, field, value) => setLine("productionPhases", id, field, value)} onPercent={(id, value) => setLinePercent("productionPhases", id, value)} onRemove={(id) => removeLine("productionPhases", id)} actual={values.phases} expected={cents(plan.laborSplit.production)} tt={tt}/>
        <LineEditor title={tt("Project administrative budget lines", "Líneas del presupuesto administrativo del proyecto")} rows={plan.administrativeLines} base={cents(plan.laborSplit.administrative)} onAdd={() => addLine("administrativeLines")} onChange={(id, field, value) => setLine("administrativeLines", id, field, value)} onPercent={(id, value) => setLinePercent("administrativeLines", id, value)} onRemove={(id) => removeLine("administrativeLines", id)} actual={values.admin} expected={cents(plan.laborSplit.administrative)} tt={tt}/>
        <section className="panel performance" data-testid="cost-value-performance-module">
          <div className="section-title"><div><p className="eyebrow">{tt("Module 2", "Módulo 2")}</p><h2>{tt("Project performance & bonus", "Rendimiento del proyecto y bono")}</h2></div><button onClick={() => void exportPerformance()} disabled={performanceHistory.length === 0}><Download size={15}/>{tt("Power BI CSV", "CSV para Power BI")}</button></div>
          <p className="module-copy">{tt("Record an earned-value snapshot. CPI controls bonus eligibility; SPI is calculated only when a credible baseline is supplied.", "Registre una instantánea de valor ganado. El CPI controla la elegibilidad del bono; el SPI se calcula solo cuando se proporciona una línea base creíble.")}</p>
          <div className="fields three performance-fields">
            <Field label={tt("Review label", "Nombre de revisión")} value={performance.label} onChange={(value) => setPerformance({ ...performance, label: value })}/>
            <DateField label={tt("Snapshot date", "Fecha de corte")} value={performance.snapshotDate} onChange={(value) => setPerformance({ ...performance, snapshotDate: value })}/>
            <div><span className="label">{tt("Saved snapshots", "Instantáneas guardadas")}</span><strong>{performanceHistory.length}</strong></div>
            <Money label={tt("Planned Value (PV)", "Valor planificado (PV)")} value={performance.plannedValue} onChange={(value) => setPerformance({ ...performance, plannedValue: value })}/>
            <Money label={tt("Earned Value (EV)", "Valor ganado (EV)")} value={performance.earnedValue} onChange={(value) => setPerformance({ ...performance, earnedValue: value })}/>
            <Money label={tt("Actual Cost (AC)", "Costo real (AC)")} value={performance.actualCost} onChange={(value) => setPerformance({ ...performance, actualCost: value })}/>
            <DateField label={tt("Baseline start (optional)", "Inicio de línea base (opcional)")} value={performance.baselineStartDate ?? ""} onChange={(value) => setPerformance({ ...performance, baselineStartDate: value || null })}/>
            <DateField label={tt("Baseline end (optional)", "Fin de línea base (opcional)")} value={performance.baselineEndDate ?? ""} onChange={(value) => setPerformance({ ...performance, baselineEndDate: value || null })}/>
            <Field label={tt("Source / audit note", "Fuente / nota de auditoría")} value={performance.sourceNote} onChange={(value) => setPerformance({ ...performance, sourceNote: value })}/>
          </div>
          {latestPerformance && <div className="performance-results">
            <Metric label="CPI" value={latestPerformance.evaluation.cpi ?? "—"} currency=""/>
            <Metric label="SPI" value={latestPerformance.evaluation.spi ?? "—"} currency=""/>
            <Metric label={tt("Bonus payout", "Pago de bono")} value={`${latestPerformance.evaluation.bonusPayoutPercent}%`} currency=""/>
            <Metric label={tt("Eligible bonus", "Bono elegible")} value={latestPerformance.evaluation.bonusEligibleAmount} currency={plan.currency}/>
          </div>}
          {latestPerformance?.evaluation.spiAvailabilityReason && <p className="balance">{tt("SPI unavailable until a credible baseline and Planned Value are supplied.", "SPI no disponible hasta proporcionar una línea base creíble y el Valor Planificado.")}</p>}
          <div className="performance-actions"><small>{tt("Policy: CPI ≥ 1.00 pays 100%; CPI ≤ 0.60 pays 0%; values between are weighted linearly.", "Política: CPI ≥ 1.00 paga 100%; CPI ≤ 0.60 paga 0%; los valores intermedios se ponderan linealmente.")}</small><button className="primary" disabled={!plan.version || performanceSaving || !performance.label.trim()} onClick={() => void savePerformance()}><Save size={16}/>{performanceSaving ? tt("Saving…", "Guardando…") : tt("Save snapshot", "Guardar instantánea")}</button></div>
        </section>
        <section className="panel performance forecast" data-testid="cost-value-forecast-module">
          <div className="section-title"><div><p className="eyebrow">{tt("Module 3 · Layer 1", "Módulo 3 · Capa 1")}</p><h2>{tt("Forecasting & Early Warning", "Pronóstico y Alerta Temprana")}</h2></div><button onClick={() => void exportForecast()} disabled={forecastHistory.length === 0}><Download size={15}/>{tt("Forecast CSV", "CSV de pronóstico")}</button></div>
          <p className="module-copy">{tt("Deterministic forecasts from the latest saved plan and performance snapshot. No AI is used in this layer.", "Pronósticos determinísticos desde el plan y la instantánea de rendimiento más recientes. Esta capa no utiliza IA.")}</p>
          <div className="fields three performance-fields"><Field label={tt("Forecast label", "Nombre del pronóstico")} value={forecast.label} onChange={(value) => setForecast({ ...forecast, label: value })}/><Field label={tt("Assumption / source note", "Supuesto / nota de fuente")} value={forecast.sourceNote} onChange={(value) => setForecast({ ...forecast, sourceNote: value })}/><div><span className="label">{tt("Saved forecasts", "Pronósticos guardados")}</span><strong>{forecastHistory.length}</strong></div></div>
          {latestForecast && <><div className="performance-results"><Metric label="BAC" value={latestForecast.evaluation.budgetAtCompletion} currency={plan.currency}/><Metric label="TCPI" value={latestForecast.evaluation.tcpi ?? "—"} currency=""/><Metric label={tt("Cost variance", "Variación de costo")} value={latestForecast.evaluation.costVariance} currency={plan.currency}/><Metric label={tt("Schedule variance", "Variación de cronograma")} value={latestForecast.evaluation.scheduleVariance} currency={plan.currency}/></div><div className="forecast-scenarios">{latestForecast.evaluation.scenarios.map((scenario) => <article key={scenario.name} className={`scenario ${scenario.name}`}><strong>{scenario.name}</strong><span>EAC: {scenario.eac} {plan.currency}</span><span>ETC: {scenario.etc} {plan.currency}</span><span>VAC: {scenario.vac} {plan.currency}</span><span>{tt("Margin", "Margen")}: {scenario.projectedMargin} {plan.currency}</span><span>{tt("Bonus", "Bono")}: {scenario.projectedBonusPercent}% · {scenario.projectedBonusAmount} {plan.currency}</span></article>)}</div><p className={`forecast-status ${latestForecast.evaluation.status}`}>{tt("Early-warning status", "Estado de alerta temprana")}: {latestForecast.evaluation.status}</p></>}
          <div className="performance-actions"><small>{tt("Expected uses current CPI; optimistic assumes remaining work meets budget; conservative combines CPI and SPI when available.", "El esperado usa el CPI actual; el optimista supone que el trabajo restante cumple el presupuesto; el conservador combina CPI y SPI cuando están disponibles.")}</small><button className="primary" disabled={!plan.version || !latestPerformance || forecastSaving || !forecast.label.trim()} onClick={() => void saveForecast()}><Save size={16}/>{forecastSaving ? tt("Calculating…", "Calculando…") : tt("Calculate & save forecast", "Calcular y guardar pronóstico")}</button></div>
        </section>
        <div className="savebar"><div><strong>{values.balanced ? tt("Plan balanced", "Plan balanceado") : tt("Finish balancing before saving", "Complete el balance antes de guardar")}</strong>{plan.savedAt && <small>{tt("Version", "Versión")} {plan.version} · {tt("saved", "guardada")} {new Date(plan.savedAt).toLocaleString()}</small>}</div><div className="save-actions"><button onClick={() => void load()} disabled={saving}><RotateCcw size={15}/>{tt("Reset draft", "Restablecer borrador")}</button><button onClick={exportPlanCsv} disabled={!plan.version}><FileSpreadsheet size={15}/>{tt("Export CSV", "Exportar CSV")}</button><button onClick={() => window.print()} disabled={!plan.version}><Printer size={15}/>{tt("Print / Save PDF", "Imprimir / Guardar PDF")}</button><button className="primary" disabled={!values.balanced || saving || !plan.name.trim()} onClick={() => void save()}><Save size={16}/>{saving ? tt("Saving…", "Guardando…") : tt("Save plan", "Guardar plan")}</button></div></div>
      </>}
    </main>
  </FinancialProjectShell>;
}

const allocationStyles = `.mode-switch{display:flex;gap:6px}.mode-switch .selected{background:#1D4ED8!important;color:white!important}.calculated-amounts{font-size:12px;color:hsl(var(--muted-foreground));margin-top:10px}`;

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function Money({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeTwoDecimals(value))}/></label>; }
function Percent({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><div style={{position:"relative"}}><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeTwoDecimals(value))} style={{paddingRight:30}}/><span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)"}}>%</span></div></label>; }
function AllocationRow({ label, amount, percent, onAmount, onPercent, readOnly = false }: { label: string; amount: string; percent: string; onAmount?: (value: string) => void; onPercent?: (value: string) => void; readOnly?: boolean }) { return <div className="allocation-row"><strong>{label}</strong><label><span className="label">Amount</span><input aria-label={`${label} amount`} inputMode="decimal" value={amount} readOnly={readOnly} onChange={(event) => onAmount?.(event.target.value)} onBlur={() => onAmount?.(normalizeTwoDecimals(amount))}/></label><label><span className="label">%</span><div className="percent-input"><input aria-label={`${label} percentage`} inputMode="decimal" value={percent} readOnly={readOnly} onChange={(event) => onPercent?.(event.target.value)} onBlur={() => onPercent?.(normalizeTwoDecimals(percent))}/><span>%</span></div></label></div>; }
function Metric({ label, value, currency }: { label: string; value: string; currency: string }) { return <div className="metric"><span className="label">{label}</span><strong>{value} {currency}</strong></div>; }
function Balance({ actual, expected }: { actual: bigint | null; expected: bigint | null }) { const ok = actual != null && expected != null && actual === expected; return <p className={ok ? "balance ok" : "balance"}>{ok ? "Balanced" : `Total ${format(actual)} / Required ${format(expected)}`}</p>; }
function LineEditor({ title, rows, base, onAdd, onChange, onPercent, onRemove, actual, expected, tt }: { title: string; rows: Line[]; base: bigint | null; onAdd: () => void; onChange: (id: string, field: "name" | "amount", value: string) => void; onPercent: (id: string, value: string) => void; onRemove: (id: string) => void; actual: bigint | null; expected: bigint | null; tt: (en: string, es: string) => string }) { return <section className="panel"><div className="section-title"><h2>{title}</h2><button onClick={onAdd}><Plus size={15}/>{tt("Add line", "Agregar línea")}</button></div><div className="line-head"><span>{tt("Name", "Nombre")}</span><span>{tt("Amount", "Monto")}</span><span>%</span><span/></div><div className="lines">{rows.map((line) => <div className="line" key={line.id}><input aria-label={tt("Line name", "Nombre de línea")} placeholder={tt("Name", "Nombre")} value={line.name} onChange={(event) => onChange(line.id, "name", event.target.value)}/><input aria-label={tt("Line amount", "Monto de línea")} inputMode="decimal" value={line.amount} onChange={(event) => onChange(line.id, "amount", event.target.value)} onBlur={() => onChange(line.id, "amount", normalizeTwoDecimals(line.amount))}/><div className="percent-input"><input aria-label={tt("Line percentage", "Porcentaje de línea")} inputMode="decimal" value={percentForAmount(line.amount, base)} onChange={(event) => onPercent(line.id, event.target.value)}/><span>%</span></div><button aria-label={tt("Remove line", "Eliminar línea")} onClick={() => onRemove(line.id)}><Trash2 size={15}/></button></div>)}</div><Balance actual={actual} expected={expected}/></section>; }

const styles = `.cvp{max-width:1100px;margin:0 auto;padding:24px 24px 104px;display:grid;gap:16px}.cvp header{display:flex;justify-content:space-between;gap:16px}.cvp header button,.save-actions button,.text-action{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:7px 9px;cursor:pointer}.header-actions,.save-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.text-action{margin-bottom:12px}.cvp h1{margin:2px 0 6px;font-size:29px}.cvp h2{font-size:17px;margin:0 0 14px}.cvp p{margin:0;color:hsl(var(--muted-foreground))}.eyebrow,.label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:hsl(var(--muted-foreground));margin-bottom:6px}.version{border:1px solid hsl(var(--border));border-radius:99px;padding:7px 10px;height:max-content}.panel{border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--card));padding:18px}.guide{border-color:#2563EB66;background:#EFF6FF}.guide ol{margin:14px 0;padding-left:22px;display:grid;gap:7px}.fields{display:grid;gap:12px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}input{width:100%;box-sizing:border-box;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:10px 11px;font:inherit}input[readonly]{background:hsl(var(--muted)/.55);font-weight:700}.metric{border-radius:9px;background:hsl(var(--muted)/.55);padding:10px 12px}.metric strong{font-size:18px}.balance{margin-top:10px!important;font-size:12px;color:#B45309!important}.balance.ok{color:#15803D!important}.section-title,.savebar,.performance-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-title h2{margin:0}.section-title button,.line button,.panel button{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:7px 9px;cursor:pointer}.allocation-grid{display:grid;gap:9px}.allocation-row{display:grid;grid-template-columns:minmax(220px,1fr) 180px 130px;gap:10px;align-items:end;padding:10px;border:1px solid hsl(var(--border));border-radius:9px}.allocation-row>strong{align-self:center}.percent-input{position:relative}.percent-input input{padding-right:30px}.percent-input span{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-weight:700}.lines{display:grid;gap:8px;margin-top:8px}.line,.line-head{display:grid;grid-template-columns:1fr 180px 120px auto;gap:8px}.line-head{font-size:11px;text-transform:uppercase;font-weight:800;color:hsl(var(--muted-foreground));padding:12px 0 0}.notice{padding:11px 13px;border-radius:8px}.notice.error,.panel.error{border:1px solid #DC262666;background:#FEF2F2;color:#991B1B}.notice.success{border:1px solid #16A34A55;background:#F0FDF4;color:#166534}.module-copy{margin-bottom:16px!important}.performance-fields{margin-top:16px}.performance-results{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.performance-actions{margin-top:16px;border-top:1px solid hsl(var(--border));padding-top:14px}.performance-actions small{max-width:650px;color:hsl(var(--muted-foreground))}.savebar{position:sticky;bottom:12px;background:hsl(var(--card));border:1px solid hsl(var(--border));box-shadow:0 8px 24px #0002;border-radius:12px;padding:14px 16px;z-index:2}.savebar>div:first-child{display:grid}.savebar small{color:hsl(var(--muted-foreground));margin-top:4px}.primary{display:inline-flex;align-items:center;gap:7px;background:#1D4ED8!important;color:white!important;border:0!important;border-radius:8px;padding:10px 14px!important;font-weight:750;cursor:pointer}.primary:disabled,.save-actions button:disabled{opacity:.45;cursor:not-allowed}@media print{.financial-page-content>aside,.text-action,.header-actions,.save-actions,.performance-actions button{display:none!important}.cvp{padding:0;max-width:none}.savebar{position:static;box-shadow:none}}@media(max-width:760px){.cvp{padding:15px 15px 32px}.fields.three,.fields.two,.performance-results{grid-template-columns:1fr}.allocation-row{grid-template-columns:1fr 1fr}.allocation-row>strong{grid-column:1/-1}.line,.line-head{grid-template-columns:1fr 110px 90px auto}.savebar,.performance-actions{position:static;align-items:flex-start;flex-direction:column}}`;
