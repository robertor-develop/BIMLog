import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { selectNextAction } from "@/lib/next-action";
import { responsibilityGapLabel, responsibilityStatusLabel } from "@/lib/responsibility-presentation";

type Scope = "my_work" | "my_company" | "authorized_projects";
type Group = "all" | "due" | "overdue" | "blocked" | "noResponse";
type Item = {
  key: string; title: string; status: string; deadline: string | null;
  project: { id: number; name: string; code: string };
  owner: { person: string | null; company: string | null };
  contextGaps: string[];
  classification: { groups: Record<Exclude<Group, "all">, boolean>; metrics: { recordAgeDays: number | null; deadlineDaysLate: number | null; reviewerDelayDays: number | null } };
  action: { label: string; openLink: string; publishUpdateMeaning: string; lensEvidenceLink: string | null };
};
type PerformanceAggregate = { identity: string; company: string | null; actionableCount: number; dueCount: number; overdueCount: number; blockedCount: number; noResponseCount: number; sourceReferences: Array<{ key: string; authorizedLink: string }> };
type Payload = { items: Item[]; total: number; partial: boolean; groupCounts: Record<Exclude<Group, "all">, number>; performanceSummary?: { aggregates: PerformanceAggregate[]; escalationPreparation: { neutral: true; automaticScore: false; notificationSent: false } } };

const SCOPE_KEY = "bimlog:headquarters:responsibility-scope";
const GROUP_KEY = "bimlog:headquarters:responsibility-group";
const scopes: Scope[] = ["my_work", "my_company", "authorized_projects"];
const groups: Group[] = ["all", "due", "overdue", "blocked", "noResponse"];
function saved<T extends string>(key: string, allowed: T[], fallback: T): T {
  try { const value = window.localStorage.getItem(key) as T | null; return value && allowed.includes(value) ? value : fallback; } catch { return fallback; }
}

export function ResponsibilityWorkspace({ token, lang }: { token?: string; lang: string }) {
  const [, navigate] = useLocation();
  const es = lang === "es";
  const [scope, setScope] = useState<Scope>(() => saved(SCOPE_KEY, scopes, "my_work"));
  const [group, setGroup] = useState<Group>(() => saved(GROUP_KEY, groups, "all"));
  const [payload, setPayload] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { try { localStorage.setItem(SCOPE_KEY, scope); } catch { /* context remains usable */ } }, [scope]);
  useEffect(() => { try { localStorage.setItem(GROUP_KEY, group); } catch { /* context remains usable */ } }, [group]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/v1/dashboard/responsibilities?scope=${encodeURIComponent(scope)}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("load failed"); return response.json() as Promise<Payload>; })
      .then(result => { setPayload(result); setState("ready"); })
      .catch(error => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [scope, token]);
  const visible = useMemo(() => (payload?.items ?? []).filter(item => group === "all" || item.classification.groups[group]), [payload, group]);
  const nextAction = useMemo(() => selectNextAction(visible), [visible]);
  const displayed = expanded ? visible : visible.slice(0, 5);
  const scopeLabels: Record<Scope, string> = es ? { my_work: "Mi trabajo", my_company: "Mi empresa", authorized_projects: "Proyectos autorizados" } : { my_work: "My Work", my_company: "My Company", authorized_projects: "Authorized Projects" };
  const groupLabels: Record<Group, string> = es ? { all: "Todo", due: "Vence hoy", overdue: "Vencido", blocked: "Bloqueado", noResponse: "Sin respuesta" } : { all: "All", due: "Due today", overdue: "Overdue", blocked: "Blocked", noResponse: "No response" };
  return <section aria-labelledby="responsibility-heading" style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 16, marginBottom: 20, background: "hsl(var(--card))" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><h2 id="responsibility-heading" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{es ? "Espacio de responsabilidades" : "Responsibility workspace"}</h2><p style={{ fontSize: 11, margin: "4px 0 12px", color: "hsl(var(--muted-foreground))" }}>{es ? "Cada acción abre su registro fuente autorizado; BIMLog no crea tareas paralelas." : "Each action opens its authorized source record; BIMLog does not create parallel tasks."}</p></div>
      {payload?.partial && <span role="status" style={{ color: "#92400e", fontSize: 11 }}>{es ? "Algunas fuentes no están disponibles; los resultados visibles siguen siendo utilizables." : "Some sources are unavailable; visible results remain usable."}</span>}
    </div>
    <div role="tablist" aria-label={es ? "Alcance de responsabilidad" : "Responsibility scope"} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {scopes.map(value => <button key={value} role="tab" aria-selected={scope === value} onClick={() => setScope(value)} style={{ border: "1px solid #93c5fd", borderRadius: 6, padding: "7px 10px", background: scope === value ? "#1d4ed8" : "transparent", color: scope === value ? "white" : "inherit", cursor: "pointer" }}>{scopeLabels[value]}</button>)}
    </div>
    <div aria-label={es ? "Agrupar responsabilidades" : "Group responsibilities"} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {groups.map(value => <button key={value} aria-pressed={group === value} onClick={() => setGroup(value)} style={{ border: "1px solid hsl(var(--border))", borderRadius: 999, padding: "5px 9px", background: group === value ? "hsl(var(--accent))" : "transparent", cursor: "pointer", fontSize: 11 }}>{groupLabels[value]} ({value === "all" ? payload?.total ?? 0 : payload?.groupCounts?.[value] ?? 0})</button>)}
    </div>
    {state === "ready" && <NextActionCard item={nextAction} lang={lang} onOpen={navigate} />}
    {(payload?.performanceSummary?.aggregates.length ?? 0) > 0 && <details style={{ marginBottom: 12 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{es ? "Ver resumen por empresa" : "View company summary"}</summary><div aria-label={es ? "Resumen trazable de responsabilidad" : "Traceable responsibility summary"} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginTop: 8 }}>
      {payload!.performanceSummary!.aggregates.map(aggregate => <div key={aggregate.identity} style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, padding: 10 }}>
        <strong style={{ fontSize: 12 }}>{aggregate.company || (es ? "Sin asignar" : "Unassigned")}</strong>
        <div style={{ fontSize: 11, marginTop: 4 }}>{es ? "Accionables" : "Actionable"}: {aggregate.actionableCount} · {es ? "Vencidos" : "Overdue"}: {aggregate.overdueCount} · {es ? "Bloqueados" : "Blocked"}: {aggregate.blockedCount}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{aggregate.sourceReferences.slice(0, 3).map((source, index) => <button key={source.key} onClick={() => navigate(source.authorizedLink)} style={{ border: 0, background: "none", color: "#2563eb", padding: 0, textDecoration: "underline", cursor: "pointer", fontSize: 10 }}>{es ? "Abrir fuente" : "Open source"} {index + 1}</button>)}</div>
      </div>)}
      <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{es ? "Resumen neutral basado en registros fuente. No califica personas ni envía notificaciones." : "Neutral source-record summary. It does not score people or send notifications."}</p>
    </div></details>}
    {state === "loading" && <p role="status">{es ? "Cargando responsabilidades…" : "Loading responsibilities…"}</p>}
    {state === "error" && <p role="alert">{es ? "No se pudo cargar. Actualice para intentar de nuevo." : "Could not load. Refresh to try again."}</p>}
    {state === "ready" && visible.length === 0 && <p>{es ? "No hay acciones en esta vista." : "No actions in this view."}</p>}
    {visible.length > 0 && <><ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {displayed.map(item => <li key={item.key} style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.title}</strong><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{item.project.code} · {item.project.name} · {responsibilityStatusLabel(item.status, lang)}</div></div><button onClick={() => navigate(item.action.openLink)} style={{ cursor: "pointer", borderRadius: 6, border: "1px solid #2563eb", padding: "6px 10px", background: "#2563eb", color: "white" }}>{item.action.label}</button></div>
        <div style={{ fontSize: 11, marginTop: 8 }}>{es ? "Responsable" : "Owner"}: {item.owner.person || item.owner.company || (es ? "No asignado" : "Unassigned")} · {es ? "Fecha límite" : "Deadline"}: {item.deadline ? new Date(item.deadline).toLocaleDateString() : (es ? "No definida" : "Not set")}</div>
        {item.contextGaps.length > 0 && <div style={{ fontSize: 11, color: "#92400e", marginTop: 5 }}>{es ? "Contexto faltante" : "Missing context"}: {item.contextGaps.map(gap => responsibilityGapLabel(gap, lang)).join(", ")}</div>}
        {item.action.lensEvidenceLink && <button onClick={() => navigate(item.action.lensEvidenceLink!)} style={{ border: 0, padding: 0, marginTop: 7, background: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}>{es ? "Abrir evidencia vinculada de Lens" : "Open linked Lens evidence"}</button>}
        <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{item.action.publishUpdateMeaning}</div>
      </li>)}
    </ul>{visible.length > 5 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} style={{ marginTop: 10, border: "1px solid hsl(var(--border))", borderRadius: 7, padding: "7px 10px", background: "transparent", cursor: "pointer", fontWeight: 700 }}>{expanded ? (es ? "Mostrar menos" : "Show fewer") : (es ? `Ver las ${visible.length} acciones` : `View all ${visible.length} actions`)}</button>}</>}
  </section>;
}
