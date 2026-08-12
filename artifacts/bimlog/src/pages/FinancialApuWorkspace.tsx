import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, Download, FileSpreadsheet, HelpCircle, Info, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { downloadGovernedCurrentViewPdf, PrintPdfButton } from "@/components/PrintPdfButton";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const forecastStyles = `.forecast-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.scenario{display:grid;gap:5px;border:1px solid hsl(var(--border));border-radius:10px;padding:12px}.scenario strong{text-transform:capitalize}.scenario span{font-size:12px}.forecast-status{margin-top:12px!important;padding:8px 10px;border-radius:8px;font-weight:800;text-transform:capitalize}.forecast-status.healthy{background:#DCFCE7;color:#166534}.forecast-status.warning{background:#FEF3C7;color:#92400E}.forecast-status.critical{background:#FEE2E2;color:#991B1B}.mode-switch{display:flex;gap:6px}.mode-switch .selected{background:#1D4ED8!important;color:white!important}.calculated-amounts{font-size:12px;color:hsl(var(--muted-foreground));margin-top:10px}@media(max-width:760px){.forecast-scenarios{grid-template-columns:1fr}}`;
type Line = { id: string; name: string; amount: string; percentage: string };
type Plan = {
  name: string; currency: string; sellingPrice: string; fixedCompanyCost: string;
  allocationMode: "amount" | "percentage";
  allocationPercentages: { labor: string; bonus: string; taskEarnings: string };
  allocations: { labor: string; bonus: string; taskEarnings: string };
  laborSplitPercentages: { production: string; administrative: string };
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
  laborSplitPercentages: { production: "0.00", administrative: "0.00" },
  laborSplit: { production: "0.00", administrative: "0.00" },
  productionPhases: [{ id: crypto.randomUUID(), name: "", amount: "0.00", percentage: "0.00" }],
  administrativeLines: [{ id: crypto.randomUUID(), name: "", amount: "0.00", percentage: "0.00" }],
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
  return format((amountValue * 10_000n + base / 2n) / base);
};
const derivedTopPercentages = (labor: string, bonus: string, net: bigint | null) => {
  if (net == null || net <= 0n) return { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" };
  const laborPoints = percentBasisPoints(percentForAmount(labor, net)) ?? 0n;
  const bonusPoints = percentBasisPoints(percentForAmount(bonus, net)) ?? 0n;
  const earningsPoints = laborPoints + bonusPoints <= 10_000n ? 10_000n - laborPoints - bonusPoints : 0n;
  return { labor: format(laborPoints), bonus: format(bonusPoints), taskEarnings: format(earningsPoints) };
};
const reallocateLines = (lines: Line[], base: bigint) => {
  let used = 0n;
  const points = lines.map((line) => percentBasisPoints(line.percentage) ?? 0n);
  const balanced = points.reduce((sum, value) => sum + value, 0n) === 10_000n;
  return lines.map((line, index) => {
    const amount = balanced && index === lines.length - 1 ? base - used : (base * points[index]! + 5_000n) / 10_000n;
    used += amount;
    return { ...line, amount: format(amount) };
  });
};
const completeLineRemainder = (lines: Line[], base: bigint) => {
  if (lines.length === 0) return lines;
  const used = lines.slice(0, -1).reduce<bigint | null>((sum, line) => {
    const points = percentBasisPoints(line.percentage);
    return sum == null || points == null ? null : sum + points;
  }, 0n);
  if (used == null || used > 10_000n) return lines;
  const completed = lines.map((line, index) => index === lines.length - 1 ? { ...line, percentage: format(10_000n - used) } : line);
  return reallocateLines(completed, base);
};
const splitLinesEqually = (lines: Line[], base: bigint) => {
  if (lines.length === 0) return lines;
  const count = BigInt(lines.length), share = 10_000n / count;
  let assigned = 0n;
  const percentages = lines.map((line, index) => {
    const points = index === lines.length - 1 ? 10_000n - assigned : share;
    assigned += points;
    return { ...line, percentage: format(points) };
  });
  return reallocateLines(percentages, base);
};
const cascadeLaborAllocation = (plan: Plan, laborAmount: bigint) => {
  const productionPoints = percentBasisPoints(plan.laborSplitPercentages.production) ?? 0n;
  const administrativePoints = percentBasisPoints(plan.laborSplitPercentages.administrative) ?? 0n;
  if (productionPoints + administrativePoints !== 10_000n) return plan;
  const production = (laborAmount * productionPoints + 5_000n) / 10_000n;
  const administrative = laborAmount - production;
  return {
    ...plan,
    laborSplit: { production: format(production), administrative: format(administrative) },
    productionPhases: reallocateLines(plan.productionPhases, production),
    administrativeLines: reallocateLines(plan.administrativeLines, administrative),
  };
};
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function FinancialApuWorkspace() {
  const { token } = useAuthStore();
  const { language, tt } = useI18n();
  const [, route] = useRoute("/projects/:id/financial/apu");
  const projectId = Number(route?.id);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [helpVisible, setHelpVisible] = useState(() => typeof window === "undefined" || window.localStorage.getItem("bimlog-cvp-help") !== "hidden");
  const [performance, setPerformance] = useState<PerformanceInput>(emptyPerformance);
  const [latestPerformance, setLatestPerformance] = useState<PerformanceSnapshot | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceSnapshot[]>([]);
  const [performanceSaving, setPerformanceSaving] = useState(false);
  const [forecast, setForecast] = useState({ label: "", sourceNote: "" });
  const [latestForecast, setLatestForecast] = useState<ForecastSnapshot | null>(null);
  const [forecastHistory, setForecastHistory] = useState<ForecastSnapshot[]>([]);
  const [forecastSaving, setForecastSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfSections, setPdfSections] = useState({ plan: true, performance: true, forecast: true });
  useEffect(() => { window.localStorage.setItem("bimlog-cvp-help", helpVisible ? "shown" : "hidden"); }, [helpVisible]);

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
        const laborBase = cents(loaded.allocations.labor);
        const productionBase = cents(loaded.laborSplit.production);
        const administrativeBase = cents(loaded.laborSplit.administrative);
        setPlan({
          ...loaded,
          allocationPercentages: derivedTopPercentages(loaded.allocations.labor, loaded.allocations.bonus, net),
          laborSplitPercentages: {
            production: percentForAmount(loaded.laborSplit.production, laborBase),
            administrative: percentForAmount(loaded.laborSplit.administrative, laborBase),
          },
          productionPhases: loaded.productionPhases.map((line: Line) => ({ ...line, percentage: line.percentage ?? percentForAmount(line.amount, productionBase) })),
          administrativeLines: loaded.administrativeLines.map((line: Line) => ({ ...line, percentage: line.percentage ?? percentForAmount(line.amount, administrativeBase) })),
        });
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
  const balanceIssues = useMemo(() => {
    const issues: string[] = [];
    const money = (value: bigint | null) => `${format(value)} ${plan.currency}`;
    if (!plan.name.trim()) issues.push(tt("Enter a plan name.", "Ingrese un nombre para el plan."));
    if (values.net == null) issues.push(tt("Selling Price and Fixed Company Cost must be valid amounts with no more than two decimals.", "El Precio de Venta y el Costo Fijo de Empresa deben ser montos válidos con no más de dos decimales."));
    else if (values.net < 0n) issues.push(tt("Fixed Company Cost cannot exceed Selling Price.", "El Costo Fijo de Empresa no puede exceder el Precio de Venta."));
    if (values.net != null && values.allocations !== values.net) issues.push(tt(`Net value allocation totals ${money(values.allocations)} but must equal ${money(values.net)}.`, `La distribución del valor neto suma ${money(values.allocations)}, pero debe ser ${money(values.net)}.`));
    const labor = cents(plan.allocations.labor);
    if (values.laborSplit !== labor) issues.push(tt(`Labor split totals ${money(values.laborSplit)} but must equal the Labor Operating Pool of ${money(labor)}.`, `La división de mano de obra suma ${money(values.laborSplit)}, pero debe igualar el Fondo Operativo de ${money(labor)}.`));
    const production = cents(plan.laborSplit.production);
    if (values.phases !== production) issues.push(tt(`Direct production phases total ${money(values.phases)} but Direct Production Labor is ${money(production)}. Change the production percentage above or use “Complete remainder” in the phase section.`, `Las fases de producción directa suman ${money(values.phases)}, pero la Mano de Obra de Producción Directa es ${money(production)}. Cambie el porcentaje de producción arriba o use “Completar remanente” en la sección de fases.`));
    const administrative = cents(plan.laborSplit.administrative);
    if (values.admin !== administrative) issues.push(tt(`Administrative lines total ${money(values.admin)} but Project Administrative Labor is ${money(administrative)}. Use “Complete remainder” or “Split equally” in that section.`, `Las líneas administrativas suman ${money(values.admin)}, pero la Mano de Obra Administrativa del Proyecto es ${money(administrative)}. Use “Completar remanente” o “Dividir igualmente” en esa sección.`));
    return issues;
  }, [plan, tt, values]);

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
      return cascadeLaborAllocation({ ...next, allocations: { labor: format(labor), bonus: format(bonus), taskEarnings: format(net - labor - bonus) } }, labor);
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
    const next: Plan = {
      ...current,
      allocationMode: "amount",
      allocations,
      allocationPercentages: derivedTopPercentages(allocations.labor, allocations.bonus, net),
    };
    return key === "labor" && edited != null ? cascadeLaborAllocation(next, edited) : next;
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
    return cascadeLaborAllocation({ ...current, allocationMode: "percentage", allocationPercentages, allocations: { labor: format(labor), bonus: format(bonus), taskEarnings: format(taskEarnings) } }, labor);
  });
  const setSplitAmount = (key: keyof Plan["laborSplit"], value: string) => setPlan((current) => {
    const base = cents(current.allocations.labor), edited = cents(value);
    const otherKey = key === "production" ? "administrative" : "production";
    const remainder = base != null && edited != null && edited <= base ? base - edited : null;
    const laborSplit = { ...current.laborSplit, [key]: value, ...(remainder == null ? {} : { [otherKey]: format(remainder) }) };
    const percentages = base == null ? current.laborSplitPercentages : { production: percentForAmount(laborSplit.production, base), administrative: percentForAmount(laborSplit.administrative, base) };
    const next = { ...current, laborSplit, laborSplitPercentages: percentages };
    return key === "production" && edited != null ? { ...next, productionPhases: reallocateLines(next.productionPhases, edited) } : key === "administrative" && edited != null ? { ...next, administrativeLines: reallocateLines(next.administrativeLines, edited) } : next;
  });
  const setSplitPercent = (key: keyof Plan["laborSplit"], value: string) => setPlan((current) => {
    const base = cents(current.allocations.labor), amount = amountForPercent(base, value);
    if (base == null || amount == null || amount > base) return current;
    const otherKey = key === "production" ? "administrative" : "production";
    const otherPoints = 10_000n - (percentBasisPoints(value) ?? 0n);
    const laborSplitPercentages = { ...current.laborSplitPercentages, [key]: normalizeTwoDecimals(value), [otherKey]: format(otherPoints) };
    const next = { ...current, laborSplit: { ...current.laborSplit, [key]: format(amount), [otherKey]: format(base - amount) }, laborSplitPercentages };
    return { ...next, productionPhases: reallocateLines(next.productionPhases, cents(next.laborSplit.production) ?? 0n), administrativeLines: reallocateLines(next.administrativeLines, cents(next.laborSplit.administrative) ?? 0n) };
  });
  const setLine = (key: "productionPhases" | "administrativeLines", id: string, field: "name" | "amount", value: string) => setPlan((current) => {
    const base = cents(key === "productionPhases" ? current.laborSplit.production : current.laborSplit.administrative);
    return { ...current, [key]: current[key].map((line) => line.id === id ? { ...line, [field]: value, ...(field === "amount" ? { percentage: percentForAmount(value, base) } : {}) } : line) };
  });
  const setLinePercent = (key: "productionPhases" | "administrativeLines", id: string, value: string) => setPlan((current) => {
    const base = cents(key === "productionPhases" ? current.laborSplit.production : current.laborSplit.administrative);
    const amount = amountForPercent(base, value);
    if (amount == null) return current;
    return { ...current, [key]: current[key].map((line) => line.id === id ? { ...line, amount: format(amount), percentage: value } : line) };
  });
  const finishLineRemainder = (key: "productionPhases" | "administrativeLines") => setPlan((current) => {
    const base = cents(key === "productionPhases" ? current.laborSplit.production : current.laborSplit.administrative);
    return base == null ? current : { ...current, [key]: completeLineRemainder(current[key], base) };
  });
  const equalizeLines = (key: "productionPhases" | "administrativeLines") => setPlan((current) => {
    const base = cents(key === "productionPhases" ? current.laborSplit.production : current.laborSplit.administrative);
    return base == null ? current : { ...current, [key]: splitLinesEqually(current[key], base) };
  });
  const autoBalanceDetailLines = () => setPlan((current) => {
    const production = cents(current.laborSplit.production), administrative = cents(current.laborSplit.administrative);
    return {
      ...current,
      productionPhases: production == null ? current.productionPhases : completeLineRemainder(current.productionPhases, production),
      administrativeLines: administrative == null ? current.administrativeLines : completeLineRemainder(current.administrativeLines, administrative),
    };
  });
  const addLine = (key: "productionPhases" | "administrativeLines") => setPlan((current) => ({ ...current, [key]: [...current[key], { id: crypto.randomUUID(), name: "", amount: "0.00", percentage: "0.00" }] }));
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
      laborSplitPercentages: { production: "85.00", administrative: "15.00" },
      laborSplit: { production: format(production), administrative: format(administrative) },
      productionPhases: ["Preliminary", "Coordination", "For Record", "As-Built"].map((name, index) => ({ id: crypto.randomUUID(), name, amount: format(phaseAmounts[index]!), percentage: ["45.00", "35.00", "15.00", "5.00"][index]! })),
      administrativeLines: [{ id: crypto.randomUUID(), name: "Project administration", amount: format(administrative), percentage: "100.00" }],
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
  const selectedPdfSections = Object.values(pdfSections).filter(Boolean).length;
  const pdfOptions = <div style={{ display: "grid", gap: 8 }}>
    {([
      ["plan", tt("Plan and allocations", "Plan y distribuciones")],
      ["performance", tt("Latest performance snapshot", "Último registro de desempeño")],
      ["forecast", tt("Latest forecast", "Último pronóstico")],
    ] as const).map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={pdfSections[key]} onChange={(event) => setPdfSections((current) => ({ ...current, [key]: event.target.checked }))}/><span>{label}</span></label>)}
  </div>;
  const exportPlanPdf = async () => {
    if (!token || selectedPdfSections === 0) return;
    setExportingPdf(true); setError("");
    try {
      const rows: string[][] = [];
      if (pdfSections.plan) rows.push(
        [tt("Plan", "Plan"), tt("Plan name", "Nombre del plan"), plan.name || tt("Draft", "Borrador")],
        [tt("Plan", "Plan"), tt("Currency", "Moneda"), plan.currency],
        [tt("Plan", "Plan"), tt("Selling price", "Precio de venta"), plan.sellingPrice],
        [tt("Plan", "Plan"), tt("Fixed company cost", "Costo fijo de empresa"), plan.fixedCompanyCost],
        [tt("Plan", "Plan"), tt("Net distributable value", "Valor neto distribuible"), format(values.net)],
        [tt("Plan", "Plan"), tt("Labor operating pool", "Fondo operativo de mano de obra"), plan.allocations.labor],
        [tt("Plan", "Plan"), tt("Project incentive reserve", "Reserva de incentivos"), plan.allocations.bonus],
        [tt("Plan", "Plan"), tt("Project earnings", "Ganancias del proyecto"), plan.allocations.taskEarnings],
        ...plan.productionPhases.map((line) => [tt("Production", "Producción"), line.name || tt("Unnamed phase", "Fase sin nombre"), `${line.amount} (${line.percentage}%)`]),
        ...plan.administrativeLines.map((line) => [tt("Administration", "Administración"), line.name || tt("Unnamed line", "Línea sin nombre"), `${line.amount} (${line.percentage}%)`]),
      );
      if (pdfSections.performance) rows.push(
        [tt("Performance", "Desempeño"), tt("Snapshot", "Registro"), latestPerformance ? `${latestPerformance.snapshotDate} · ${latestPerformance.label}` : tt("No saved snapshot", "Sin registro guardado")],
        [tt("Performance", "Desempeño"), "PV / EV / AC", latestPerformance ? `${latestPerformance.plannedValue} / ${latestPerformance.earnedValue} / ${latestPerformance.actualCost}` : "—"],
        [tt("Performance", "Desempeño"), "CPI / SPI", latestPerformance ? `${latestPerformance.evaluation.cpi ?? "—"} / ${latestPerformance.evaluation.spi ?? "—"}` : "—"],
      );
      if (pdfSections.forecast) rows.push(
        [tt("Forecast", "Pronóstico"), tt("Snapshot", "Registro"), latestForecast ? `${latestForecast.forecastDate} · ${latestForecast.label}` : tt("No saved forecast", "Sin pronóstico guardado")],
        [tt("Forecast", "Pronóstico"), "BAC / CV / SV", latestForecast ? `${latestForecast.evaluation.budgetAtCompletion} / ${latestForecast.evaluation.costVariance} / ${latestForecast.evaluation.scheduleVariance}` : "—"],
        [tt("Forecast", "Pronóstico"), tt("Status", "Estado"), latestForecast?.evaluation.status ?? "—"],
      );
      await downloadGovernedCurrentViewPdf(projectId, token, {
        surface: "cost-value-planner", lang: language,
        context: [`${tt("Project", "Proyecto")}: ${projectName || projectId}`, `${tt("Plan version", "Versión del plan")}: ${plan.version ?? tt("Draft", "Borrador")}`, `${tt("Included sections", "Secciones incluidas")}: ${Object.entries(pdfSections).filter(([, value]) => value).map(([key]) => key).join(", ")}`],
        columns: [tt("Section", "Sección"), tt("Field", "Campo"), tt("Value", "Valor")], rows,
        emptyMessage: tt("No selected Cost & Value information is available.", "No hay información seleccionada de Costos y Valor."),
      }, `cost-value-plan-project-${projectId}-v${plan.version ?? "draft"}.pdf`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tt("The Cost & Value PDF could not be generated.", "No se pudo generar el PDF de Costos y Valor.")); }
    finally { setExportingPdf(false); }
  };

  return <FinancialProjectShell projectId={projectId} activeTab="apu">
    <main className="cvp" data-testid="financial-apu-workspace">
      <style>{styles}</style><style>{allocationStyles}</style><style>{forecastStyles}</style>
      <header><div><button className="text-action" onClick={() => window.history.back()}><ArrowLeft size={15}/>{tt("Back", "Volver")}</button><p className="eyebrow">{tt("Commercial", "Comercial")}</p><h1>{tt("Cost & Value Planner", "Planificador de Costos y Valor")}</h1><p>{tt("Turn a selling price into a controlled labor, incentive, earnings, performance, and forecast plan.", "Convierta un precio de venta en un plan controlado de mano de obra, incentivos, ganancias, rendimiento y pronóstico.")}</p></div><div className="header-actions"><button onClick={() => setHelpVisible((visible) => !visible)}><HelpCircle size={15}/>{helpVisible ? tt("Hide help", "Ocultar ayuda") : tt("Show help", "Mostrar ayuda")}</button><button onClick={exportPlanCsv}><FileSpreadsheet size={15}/>{tt("Export CSV", "Exportar CSV")}</button><PrintPdfButton lang={language} selectionMode loading={exportingPdf} disabled={!token} disabledReason={selectedPdfSections === 0 ? tt("Select at least one PDF section.", "Seleccione al menos una sección del PDF.") : undefined} configurationInvalid={selectedPdfSections === 0} options={pdfOptions} currentViewSummary={[`${tt("Project", "Proyecto")}: ${projectName || projectId}`, `${tt("Version", "Versión")}: ${plan.version ?? tt("Draft", "Borrador")}`]} onClick={() => void exportPlanPdf()}/>{plan.version && <span className="version">v{plan.version}</span>}</div></header>
      {loading ? <section className="panel">{tt("Loading planner…", "Cargando planificador…")}</section> : error && !projectName ? <section className="panel error" role="alert">{error}<button onClick={() => void load()}>{tt("Retry", "Reintentar")}</button></section> : <>
        {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success">{message}</div>}
        {helpVisible && <section className="panel guide" data-testid="cost-value-guide"><div className="section-title"><div><p className="eyebrow">{tt("How this plan works", "Cómo funciona este plan")}</p><h2>{tt("Five steps—no calculator required", "Cinco pasos—sin calculadora")}</h2></div><button onClick={() => setHelpVisible(false)}>{tt("Hide help", "Ocultar ayuda")}</button></div><div className="guide-grid"><article><strong>1. {tt("Establish value", "Establecer valor")}</strong><span>{tt("Selling Price − Fixed Company Cost = money available for labor, incentives, and project earnings.", "Precio de Venta − Costo Fijo de Empresa = dinero disponible para mano de obra, incentivos y ganancias.")}</span></article><article><strong>2. {tt("Allocate net value", "Distribuir valor neto")}</strong><span>{tt("Enter Labor % and Incentive %. Project Earnings receives the remainder automatically.", "Ingrese % de Mano de Obra y % de Incentivo. Ganancias recibe el remanente automáticamente.")}</span></article><article><strong>3. {tt("Split labor", "Dividir mano de obra")}</strong><span>{tt("Direct Production pays the people producing contracted deliverables. Project Administration covers coordination, management, meetings, and control.", "Producción Directa paga a quienes producen los entregables contratados. Administración cubre coordinación, gestión, reuniones y control.")}</span></article><article><strong>4. {tt("Distribute each pool", "Distribuir cada fondo")}</strong><span>{tt("Allocate Direct Production by delivery phase and Administration by activity. Use the automatic buttons instead of calculating the last percentage.", "Distribuya Producción Directa por fase y Administración por actividad. Use los botones automáticos en lugar de calcular el último porcentaje.")}</span></article><article><strong>5. {tt("Save and report", "Guardar y reportar")}</strong><span>{tt("Save when every section equals its required pool. CSV and PDF can also be exported while the plan is still a draft.", "Guarde cuando cada sección iguale su fondo requerido. CSV y PDF también pueden exportarse mientras el plan sea borrador.")}</span></article></div><div className="worked-example"><strong>{tt("Example", "Ejemplo")}: 10,000 − 2,000 = 8,000</strong><span>{tt("70% Labor = 5,600 · 20% Incentive = 1,600 · 10% Project Earnings = 800. If Direct Production is 85%, it receives 4,760 and Administration receives 840.", "70% Mano de Obra = 5,600 · 20% Incentivo = 1,600 · 10% Ganancias = 800. Si Producción Directa es 85%, recibe 4,760 y Administración recibe 840.")}</span></div></section>}
        <section className="panel"><div className="section-title"><h2>1. {tt("Plan setup", "Configuración del plan")}</h2><button onClick={loadSampleTemplate}><Sparkles size={15}/>{tt("Use complete BIM sample", "Usar ejemplo BIM completo")}</button></div>{helpVisible && <SectionHelp>{tt("Name this reusable financial setup. The sample fills every allocation with Ruben's BIM-services percentages and can be edited afterward.", "Nombre esta configuración financiera reutilizable. El ejemplo completa cada distribución con los porcentajes BIM de Rubén y luego puede editarse.")}</SectionHelp>}<div className="fields three"><Field label={tt("Plan name", "Nombre del plan")} value={plan.name} onChange={(value) => setPlan({ ...plan, name: value })}/><Field label={tt("Currency", "Moneda")} value={plan.currency} onChange={(value) => setPlan({ ...plan, currency: value.toUpperCase().slice(0, 3) })}/><div><span className="label">{tt("Project", "Proyecto")}</span><strong>{projectName}</strong></div></div></section>
        <section className="panel"><h2>2. {tt("Value foundation", "Base de valor")}</h2>{helpVisible && <SectionHelp>{tt("Selling Price is what the client pays. Fixed Company Cost is the protected company cost removed first. The remaining Net Distributable Value funds everything below.", "El Precio de Venta es lo que paga el cliente. El Costo Fijo de Empresa es el costo protegido que se retira primero. El Valor Neto restante financia todo lo demás.")}</SectionHelp>}<div className="fields three"><Money label={tt("Selling Price", "Precio de venta")} value={plan.sellingPrice} onChange={(value) => setFoundation("sellingPrice", value)}/><Money label={tt("Fixed Company Cost", "Costo fijo de empresa")} value={plan.fixedCompanyCost} onChange={(value) => setFoundation("fixedCompanyCost", value)}/><Metric label={tt("Net Distributable Value", "Valor neto distribuible")} value={format(values.net)} currency={plan.currency}/></div></section>
        <section className="panel"><h2>3. {tt("Allocate net value", "Distribuir valor neto")}</h2>{helpVisible && <SectionHelp>{tt("Type either an amount or a percentage for Labor and Incentive. Project Earnings is the company margin and is calculated as the automatic remainder so the three rows always target 100%.", "Ingrese un monto o porcentaje para Mano de Obra e Incentivo. Ganancias del Proyecto es el margen de la empresa y se calcula como remanente automático para que las tres filas lleguen a 100%.")}</SectionHelp>}<div className="allocation-grid"><AllocationRow label={tt("Labor Operating Pool", "Fondo Operativo de Mano de Obra")} amount={plan.allocations.labor} percent={plan.allocationPercentages.labor} onAmount={(value) => setAllocation("labor", value)} onPercent={(value) => setAllocationPercent("labor", value)}/><AllocationRow label={tt("Project Incentive Reserve", "Reserva de Incentivos del Proyecto")} amount={plan.allocations.bonus} percent={plan.allocationPercentages.bonus} onAmount={(value) => setAllocation("bonus", value)} onPercent={(value) => setAllocationPercent("bonus", value)}/><AllocationRow label={tt("Project Earnings (automatic remainder)", "Ganancias del Proyecto (remanente automático)")} amount={plan.allocations.taskEarnings} percent={plan.allocationPercentages.taskEarnings} readOnly/></div><Balance actual={values.allocations} expected={values.net}/></section>
        <section className="panel"><h2>4. {tt("Split the Labor Operating Pool", "Dividir el Fondo Operativo de Mano de Obra")}</h2>{helpVisible && <SectionHelp>{tt("Direct Production Labor pays the work that creates contracted deliverables—drafting, modeling, coordination production, QA corrections, and issued packages. Project Administrative Labor pays project leadership, planning, meetings, client coordination, document control, and internal administration. Editing either percentage automatically gives the other row the remainder.", "La Mano de Obra de Producción Directa paga el trabajo que crea entregables contratados—dibujo, modelado, producción de coordinación, correcciones QA y paquetes emitidos. La Mano de Obra Administrativa paga liderazgo, planificación, reuniones, coordinación con cliente, control documental y administración interna. Al editar cualquiera de los porcentajes, la otra fila recibe automáticamente el remanente.")}</SectionHelp>}<div className="allocation-grid"><AllocationRow label={tt("Direct Production Labor", "Mano de Obra de Producción Directa")} amount={plan.laborSplit.production} percent={plan.laborSplitPercentages.production} onAmount={(value) => setSplitAmount("production", value)} onPercent={(value) => setSplitPercent("production", value)}/><AllocationRow label={tt("Project Administrative Labor", "Mano de Obra Administrativa del Proyecto")} amount={plan.laborSplit.administrative} percent={plan.laborSplitPercentages.administrative} onAmount={(value) => setSplitAmount("administrative", value)} onPercent={(value) => setSplitPercent("administrative", value)}/></div><Balance actual={values.laborSplit} expected={cents(plan.allocations.labor)}/></section>
        <LineEditor title={`5. ${tt("Distribute Direct Production by phase", "Distribuir Producción Directa por fase")}`} help={helpVisible ? tt("These are the delivery stages that consume the Direct Production pool. For BIM services, Ruben's sample uses Preliminary, Coordination, For Record, and As-Built. Percentages must total 100% of Direct Production—not 100% of the selling price.", "Estas son las etapas de entrega que consumen el fondo de Producción Directa. Para servicios BIM, el ejemplo de Rubén usa Preliminar, Coordinación, Para Registro y As-Built. Los porcentajes deben sumar 100% de Producción Directa—no 100% del precio de venta.") : undefined} rows={plan.productionPhases} base={cents(plan.laborSplit.production)} onAdd={() => addLine("productionPhases")} onChange={(id, field, value) => setLine("productionPhases", id, field, value)} onPercent={(id, value) => setLinePercent("productionPhases", id, value)} onComplete={() => finishLineRemainder("productionPhases")} onEqual={() => equalizeLines("productionPhases")} onRemove={(id) => removeLine("productionPhases", id)} actual={values.phases} expected={cents(plan.laborSplit.production)} tt={tt}/>
        <LineEditor title={`6. ${tt("Distribute Project Administration by activity", "Distribuir Administración del Proyecto por actividad")}`} help={helpVisible ? tt("Create the non-production activities needed to run the project, such as project management, coordination meetings, document control, client communication, and administration. These lines must total 100% of the Administrative pool.", "Cree las actividades no productivas necesarias para dirigir el proyecto, como gestión, reuniones de coordinación, control documental, comunicación con cliente y administración. Estas líneas deben sumar 100% del fondo Administrativo.") : undefined} rows={plan.administrativeLines} base={cents(plan.laborSplit.administrative)} onAdd={() => addLine("administrativeLines")} onChange={(id, field, value) => setLine("administrativeLines", id, field, value)} onPercent={(id, value) => setLinePercent("administrativeLines", id, value)} onComplete={() => finishLineRemainder("administrativeLines")} onEqual={() => equalizeLines("administrativeLines")} onRemove={(id) => removeLine("administrativeLines", id)} actual={values.admin} expected={cents(plan.laborSplit.administrative)} tt={tt}/>
        <section className="panel performance" data-testid="cost-value-performance-module">
          <div className="section-title"><div><p className="eyebrow">{tt("Module 2", "Módulo 2")}</p><h2>{tt("Project performance & bonus", "Rendimiento del proyecto y bono")}</h2></div><button onClick={() => void exportPerformance()} disabled={performanceHistory.length === 0}><Download size={15}/>{tt("Power BI CSV", "CSV para Power BI")}</button></div>
          <p className="module-copy">{tt("Record an earned-value snapshot. CPI controls bonus eligibility; SPI is calculated only when a credible baseline is supplied.", "Registre una instantánea de valor ganado. El CPI controla la elegibilidad del bono; el SPI se calcula solo cuando se proporciona una línea base creíble.")}</p>
          {helpVisible && <SectionHelp>{tt("PV is the budgeted value that should be complete by the snapshot date. EV is the budgeted value of work actually completed. AC is what that completed work actually cost. CPI = EV ÷ AC; above 1.00 is favorable. SPI = EV ÷ PV and is meaningful only with a credible schedule baseline. Save the financial plan first, then save performance snapshots over time.", "PV es el valor presupuestado que debería estar completo en la fecha de corte. EV es el valor presupuestado del trabajo realmente completado. AC es el costo real de ese trabajo. CPI = EV ÷ AC; mayor de 1.00 es favorable. SPI = EV ÷ PV y solo es útil con una línea base de cronograma creíble. Primero guarde el plan financiero y luego guarde instantáneas de rendimiento.")}</SectionHelp>}
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
          {helpVisible && <SectionHelp>{tt("Forecasting uses the latest saved plan plus the latest performance snapshot. EAC estimates final cost, ETC estimates remaining cost, VAC compares the final estimate with the approved budget, and TCPI shows the efficiency required to finish on budget. Save a plan and at least one performance snapshot before calculating a forecast.", "El pronóstico usa el último plan guardado y la última instantánea de rendimiento. EAC estima el costo final, ETC el costo restante, VAC compara la estimación final con el presupuesto aprobado y TCPI muestra la eficiencia necesaria para terminar dentro del presupuesto. Guarde un plan y al menos una instantánea antes de calcular un pronóstico.")}</SectionHelp>}
          <div className="fields three performance-fields"><Field label={tt("Forecast label", "Nombre del pronóstico")} value={forecast.label} onChange={(value) => setForecast({ ...forecast, label: value })}/><Field label={tt("Assumption / source note", "Supuesto / nota de fuente")} value={forecast.sourceNote} onChange={(value) => setForecast({ ...forecast, sourceNote: value })}/><div><span className="label">{tt("Saved forecasts", "Pronósticos guardados")}</span><strong>{forecastHistory.length}</strong></div></div>
          {latestForecast && <><div className="performance-results"><Metric label="BAC" value={latestForecast.evaluation.budgetAtCompletion} currency={plan.currency}/><Metric label="TCPI" value={latestForecast.evaluation.tcpi ?? "—"} currency=""/><Metric label={tt("Cost variance", "Variación de costo")} value={latestForecast.evaluation.costVariance} currency={plan.currency}/><Metric label={tt("Schedule variance", "Variación de cronograma")} value={latestForecast.evaluation.scheduleVariance} currency={plan.currency}/></div><div className="forecast-scenarios">{latestForecast.evaluation.scenarios.map((scenario) => <article key={scenario.name} className={`scenario ${scenario.name}`}><strong>{scenario.name}</strong><span>EAC: {scenario.eac} {plan.currency}</span><span>ETC: {scenario.etc} {plan.currency}</span><span>VAC: {scenario.vac} {plan.currency}</span><span>{tt("Margin", "Margen")}: {scenario.projectedMargin} {plan.currency}</span><span>{tt("Bonus", "Bono")}: {scenario.projectedBonusPercent}% · {scenario.projectedBonusAmount} {plan.currency}</span></article>)}</div><p className={`forecast-status ${latestForecast.evaluation.status}`}>{tt("Early-warning status", "Estado de alerta temprana")}: {latestForecast.evaluation.status}</p></>}
          <div className="performance-actions"><small>{tt("Expected uses current CPI; optimistic assumes remaining work meets budget; conservative combines CPI and SPI when available.", "El esperado usa el CPI actual; el optimista supone que el trabajo restante cumple el presupuesto; el conservador combina CPI y SPI cuando están disponibles.")}</small><button className="primary" disabled={!plan.version || !latestPerformance || forecastSaving || !forecast.label.trim()} onClick={() => void saveForecast()}><Save size={16}/>{forecastSaving ? tt("Calculating…", "Calculando…") : tt("Calculate & save forecast", "Calcular y guardar pronóstico")}</button></div>
        </section>
        <section className={`panel readiness ${balanceIssues.length === 0 ? "ready" : "needs-work"}`} data-testid="cost-value-save-readiness"><div className="section-title"><div><p className="eyebrow">{tt("Save readiness", "Preparación para guardar")}</p><h2>{balanceIssues.length === 0 ? tt("Everything balances—this plan can be saved", "Todo balancea—este plan puede guardarse") : tt(`${balanceIssues.length} corrections remain`, `Faltan ${balanceIssues.length} correcciones`)}</h2></div>{balanceIssues.length > 0 && <button onClick={autoBalanceDetailLines}><Sparkles size={15}/>{tt("Complete detail remainders", "Completar remanentes de detalle")}</button>}</div>{balanceIssues.length > 0 ? <ol>{balanceIssues.map((issue) => <li key={issue}>{issue}</li>)}</ol> : <p>{tt("Saving creates a new immutable version. Your previous saved version remains preserved.", "Guardar crea una nueva versión inmutable. La versión guardada anterior permanece preservada.")}</p>}</section>
        <div className="savebar"><div><strong>{balanceIssues.length === 0 ? tt("Ready to save", "Listo para guardar") : balanceIssues[0]}</strong>{plan.savedAt && <small>{tt("Version", "Versión")} {plan.version} · {tt("saved", "guardada")} {new Date(plan.savedAt).toLocaleString()}</small>}</div><div className="save-actions"><button onClick={() => void load()} disabled={saving}><RotateCcw size={15}/>{tt("Reset draft", "Restablecer borrador")}</button><button onClick={exportPlanCsv}><FileSpreadsheet size={15}/>{tt("Export CSV", "Exportar CSV")}</button><button className="primary" disabled={balanceIssues.length > 0 || saving} onClick={() => void save()}><Save size={16}/>{saving ? tt("Saving…", "Guardando…") : tt("Save plan", "Guardar plan")}</button></div></div>
      </>}
    </main>
  </FinancialProjectShell>;
}

const allocationStyles = `.mode-switch{display:flex;gap:6px}.mode-switch .selected{background:#1D4ED8!important;color:white!important}.calculated-amounts{font-size:12px;color:hsl(var(--muted-foreground));margin-top:10px}`;

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function Money({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input inputMode="decimal" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeTwoDecimals(value))}/></label>; }
function Percent({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><div style={{position:"relative"}}><input inputMode="decimal" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeTwoDecimals(value))} style={{paddingRight:30}}/><span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)"}}>%</span></div></label>; }
function AllocationRow({ label, amount, percent, onAmount, onPercent, readOnly = false }: { label: string; amount: string; percent: string; onAmount?: (value: string) => void; onPercent?: (value: string) => void; readOnly?: boolean }) { return <div className="allocation-row"><strong>{label}</strong><label><span className="label">Amount</span><input aria-label={`${label} amount`} inputMode="decimal" value={amount} readOnly={readOnly} onFocus={(event) => !readOnly && event.currentTarget.select()} onChange={(event) => onAmount?.(event.target.value)} onBlur={() => onAmount?.(normalizeTwoDecimals(amount))}/></label><label><span className="label">%</span><div className="percent-input"><input aria-label={`${label} percentage`} inputMode="decimal" value={percent} readOnly={readOnly} onFocus={(event) => !readOnly && event.currentTarget.select()} onChange={(event) => onPercent?.(event.target.value)} onBlur={() => onPercent?.(normalizeTwoDecimals(percent))}/><span>%</span></div></label></div>; }
function Metric({ label, value, currency }: { label: string; value: string; currency: string }) { return <div className="metric"><span className="label">{label}</span><strong>{value} {currency}</strong></div>; }
function Balance({ actual, expected }: { actual: bigint | null; expected: bigint | null }) { const ok = actual != null && expected != null && actual === expected; return <p className={ok ? "balance ok" : "balance"}>{ok ? "Balanced" : `Total ${format(actual)} / Required ${format(expected)}`}</p>; }
function SectionHelp({ children }: { children: string }) { return <p className="section-help"><Info size={16}/><span>{children}</span></p>; }
function LineEditor({ title, help, rows, base: _base, onAdd, onChange, onPercent, onComplete, onEqual, onRemove, actual, expected, tt }: { title: string; help?: string; rows: Line[]; base: bigint | null; onAdd: () => void; onChange: (id: string, field: "name" | "amount", value: string) => void; onPercent: (id: string, value: string) => void; onComplete: () => void; onEqual: () => void; onRemove: (id: string) => void; actual: bigint | null; expected: bigint | null; tt: (en: string, es: string) => string }) { return <section className="panel"><div className="section-title"><h2>{title}</h2><div className="section-actions"><button onClick={onEqual}><Sparkles size={15}/>{tt("Split equally", "Dividir igualmente")}</button><button onClick={onComplete}><Sparkles size={15}/>{tt("Complete remainder", "Completar remanente")}</button><button onClick={onAdd}><Plus size={15}/>{tt("Add line", "Agregar línea")}</button></div></div>{help && <SectionHelp>{help}</SectionHelp>}<div className="line-head"><span>{tt("Name", "Nombre")}</span><span>{tt("Amount", "Monto")}</span><span>%</span><span/></div><div className="lines">{rows.map((line) => <div className="line" key={line.id}><input aria-label={tt("Line name", "Nombre de línea")} placeholder={tt("Name", "Nombre")} value={line.name} onChange={(event) => onChange(line.id, "name", event.target.value)}/><input aria-label={tt("Line amount", "Monto de línea")} inputMode="decimal" value={line.amount} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(line.id, "amount", event.target.value)} onBlur={() => onChange(line.id, "amount", normalizeTwoDecimals(line.amount))}/><div className="percent-input"><input aria-label={tt("Line percentage", "Porcentaje de línea")} inputMode="decimal" value={line.percentage} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onPercent(line.id, event.target.value)} onBlur={() => onPercent(line.id, normalizeTwoDecimals(line.percentage))}/><span>%</span></div><button aria-label={tt("Remove line", "Eliminar línea")} onClick={() => onRemove(line.id)}><Trash2 size={15}/></button></div>)}</div><Balance actual={actual} expected={expected}/></section>; }

const styles = `.cvp{max-width:1200px;margin:0 auto;padding:24px 24px 120px;display:grid;gap:16px}.cvp header{display:flex;justify-content:space-between;gap:16px}.cvp header button,.save-actions button,.text-action{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:7px 9px;cursor:pointer}.header-actions,.save-actions,.section-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.text-action{margin-bottom:12px}.cvp h1{margin:2px 0 6px;font-size:29px}.cvp h2{font-size:17px;margin:0 0 14px}.cvp p{margin:0;color:hsl(var(--muted-foreground))}.eyebrow,.label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:hsl(var(--muted-foreground));margin-bottom:6px}.version{border:1px solid hsl(var(--border));border-radius:99px;padding:7px 10px;height:max-content}.panel{border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--card));padding:18px}.guide{border-color:#2563EB66;background:#EFF6FF}.guide-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.guide-grid article{display:grid;align-content:start;gap:6px;padding:12px;border:1px solid #2563EB33;border-radius:9px;background:#fff}.guide-grid article span,.worked-example span{font-size:13px;line-height:1.45;color:#334155}.worked-example{display:grid;gap:4px;margin-top:12px;padding:12px 14px;border-left:4px solid #2563EB;background:#fff;border-radius:8px}.section-help{display:flex!important;align-items:flex-start;gap:8px;margin:0 0 16px!important;padding:10px 12px;border-radius:8px;background:hsl(var(--muted)/.45);font-size:13px;line-height:1.5}.section-help svg{flex:0 0 auto;margin-top:2px;color:#2563EB}.fields{display:grid;gap:12px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}input{width:100%;box-sizing:border-box;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:10px 11px;font:inherit}input:focus{outline:3px solid #2563EB25;border-color:#2563EB}input[readonly]{background:hsl(var(--muted)/.55);font-weight:700}.metric{border-radius:9px;background:hsl(var(--muted)/.55);padding:10px 12px}.metric strong{font-size:18px}.balance{margin-top:10px!important;font-size:12px;color:#B45309!important}.balance.ok{color:#15803D!important}.section-title,.savebar,.performance-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.section-title h2{margin:0}.section-title button,.line button,.panel button{display:inline-flex;align-items:center;gap:6px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:7px;padding:7px 9px;cursor:pointer}.allocation-grid{display:grid;gap:9px}.allocation-row{display:grid;grid-template-columns:minmax(220px,1fr) 180px 140px;gap:10px;align-items:end;padding:10px;border:1px solid hsl(var(--border));border-radius:9px}.allocation-row>strong{align-self:center}.percent-input{position:relative}.percent-input input{padding-right:30px}.percent-input span{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-weight:700}.lines{display:grid;gap:8px;margin-top:8px}.line,.line-head{display:grid;grid-template-columns:1fr 180px 130px auto;gap:8px}.line-head{font-size:11px;text-transform:uppercase;font-weight:800;color:hsl(var(--muted-foreground));padding:12px 0 0}.notice{padding:11px 13px;border-radius:8px}.notice.error,.panel.error{border:1px solid #DC262666;background:#FEF2F2;color:#991B1B}.notice.success{border:1px solid #16A34A55;background:#F0FDF4;color:#166534}.module-copy{margin-bottom:16px!important}.performance-fields{margin-top:16px}.performance-results{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.performance-actions{margin-top:16px;border-top:1px solid hsl(var(--border));padding-top:14px}.performance-actions small{max-width:650px;color:hsl(var(--muted-foreground))}.readiness.needs-work{border-color:#F59E0B88;background:#FFFBEB}.readiness.ready{border-color:#22C55E66;background:#F0FDF4}.readiness ol{margin:12px 0 0;padding-left:22px;display:grid;gap:7px;font-size:13px;color:#7C2D12}.savebar{position:sticky;bottom:12px;background:hsl(var(--card));border:1px solid hsl(var(--border));box-shadow:0 8px 24px #0002;border-radius:12px;padding:14px 16px;z-index:2}.savebar>div:first-child{display:grid;max-width:520px}.savebar>div:first-child>strong{font-size:13px;line-height:1.35}.savebar small{color:hsl(var(--muted-foreground));margin-top:4px}.primary{display:inline-flex;align-items:center;gap:7px;background:#1D4ED8!important;color:white!important;border:0!important;border-radius:8px;padding:10px 14px!important;font-weight:750;cursor:pointer}.primary:disabled,.save-actions button:disabled{opacity:.45;cursor:not-allowed}@media print{.financial-page-content>aside,.text-action,.header-actions,.save-actions,.performance-actions button,.section-actions,.readiness button{display:none!important}.cvp{padding:0;max-width:none}.savebar{position:static;box-shadow:none}}@media(max-width:980px){.guide-grid{grid-template-columns:1fr 1fr}.section-title{align-items:flex-start;flex-direction:column}}@media(max-width:760px){.cvp{padding:15px 15px 32px}.fields.three,.fields.two,.performance-results,.guide-grid{grid-template-columns:1fr}.allocation-row{grid-template-columns:1fr 1fr}.allocation-row>strong{grid-column:1/-1}.line,.line-head{grid-template-columns:1fr 110px 90px auto}.savebar,.performance-actions{position:static;align-items:flex-start;flex-direction:column}}`;
