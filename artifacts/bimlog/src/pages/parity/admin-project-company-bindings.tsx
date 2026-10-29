import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Option = { id: number; name: string; code?: string };
type Binding = { projectId: number; companyId: number; version: number; reasonCode: string; explanation: { en: string; es: string }; timestamp: string };

async function request(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const localized = body?.error && typeof body.error === "object" ? body.error : undefined;
    throw new Error(String(localized?.en || body?.error || body?.code || `REQUEST_${response.status}`));
  }
  return body;
}

export function ProjectCompanyBindings() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const [projects, setProjects] = useState<Option[]>([]), [companies, setCompanies] = useState<Option[]>([]);
  const [projectId, setProjectId] = useState(""), [companyId, setCompanyId] = useState(""), [reasonCode, setReasonCode] = useState("");
  const [explanationEn, setExplanationEn] = useState(""), [explanationEs, setExplanationEs] = useState("");
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading"), [error, setError] = useState(""), [success, setSuccess] = useState("");

  const loadOptions = async () => { if (!token) return; setState("loading"); setError(""); try { const [projectRows, companyRows] = await Promise.all([request("/admin/projects", token), request("/admin/companies", token)]); setProjects(Array.isArray(projectRows) ? projectRows : []); setCompanies(Array.isArray(companyRows) ? companyRows : []); setState("ready"); } catch (caught) { setError(caught instanceof Error ? caught.message : t("Authority options could not be loaded.", "No se pudieron cargar las opciones de autoridad.")); setState("error"); } };
  const loadHistory = async (nextProjectId = projectId) => { if (!token || !nextProjectId) { setBindings([]); return; } setError(""); try { const body = await request(`/admin/project-company-bindings/${nextProjectId}`, token); setBindings(Array.isArray(body.bindings) ? body.bindings : []); } catch (caught) { setBindings([]); setError(caught instanceof Error ? caught.message : t("Binding history could not be loaded.", "No se pudo cargar el historial de vinculaciones.")); } };
  useEffect(() => { void loadOptions(); }, [token]);
  const save = async () => { if (!token || !projectId || !companyId || !reasonCode.trim() || !explanationEn.trim() || !explanationEs.trim()) { setError(t("Project, company, reason code, and both explanations are required.", "Se requieren proyecto, empresa, código de motivo y ambas explicaciones.")); return; } setState("saving"); setError(""); setSuccess(""); try { const result = await request("/admin/project-company-bindings", token, { method: "POST", body: JSON.stringify({ projectId: Number(projectId), companyId: Number(companyId), reasonCode: reasonCode.trim(), explanation: { en: explanationEn.trim(), es: explanationEs.trim() } }) }); setSuccess(t(`Binding version ${result.version} saved. Immutable evidence is visible below.`, `Vinculación versión ${result.version} guardada. La evidencia inmutable está visible abajo.`)); await loadHistory(projectId); setState("ready"); } catch (caught) { setError(caught instanceof Error ? caught.message : t("Binding could not be saved.", "No se pudo guardar la vinculación.")); setState("error"); } };

  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1050, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}><Button variant="outline" onClick={() => setLocation("/all-tools")}>{t("Back to All Tools", "Volver a Todas las herramientas")}</Button><h1>{t("Project Company Authority", "Autoridad de empresa del proyecto")}</h1><p>{t("Bind a project to the company whose policies and governed configuration apply. Only a verified super administrator can change this metadata. Every change creates a new immutable version; it does not rewrite history.", "Vincule un proyecto con la empresa cuyas políticas y configuración gobernada aplican. Solo un superadministrador verificado puede cambiar estos metadatos. Cada cambio crea una nueva versión inmutable; no reescribe el historial.")}</p>
    {state === "loading" && <p role="status">{t("Loading projects and companies…", "Cargando proyectos y empresas…")}</p>}{error && <div role="alert" style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, color: "#991b1b" }}>{error} {state === "error" && <Button size="sm" variant="outline" onClick={() => void loadOptions()}>{t("Try again", "Intentar de nuevo")}</Button>}</div>}{success && <div role="status" aria-live="polite" style={{ padding: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 8, color: "#166534" }}>{success}</div>}
    {state !== "loading" && projects.length === 0 && <p role="status">{t("No projects are available. Create a project before assigning company authority.", "No hay proyectos disponibles. Cree un proyecto antes de asignar autoridad de empresa.")}</p>}{state !== "loading" && companies.length === 0 && <p role="status">{t("No active companies are available. Create or restore a company before binding a project.", "No hay empresas activas disponibles. Cree o restaure una empresa antes de vincular un proyecto.")}</p>}
    {projects.length > 0 && companies.length > 0 && <section aria-labelledby="binding-form" style={{ display: "grid", gap: 12, marginTop: 24, padding: 18, border: "1px solid hsl(var(--border))", borderRadius: 12 }}><h2 id="binding-form" style={{ margin: 0, fontSize: 18 }}>{t("Create the next binding version", "Crear la siguiente versión de vinculación")}</h2><label>{t("Project", "Proyecto")}<select value={projectId} onChange={event => { setProjectId(event.target.value); setSuccess(""); void loadHistory(event.target.value); }} style={{ display: "block", width: "100%", padding: 9 }}><option value="">{t("Select project", "Seleccione proyecto")}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.code ? `${project.code} — ` : ""}{project.name}</option>)}</select></label><label>{t("Authoritative company", "Empresa autorizada")}<select value={companyId} onChange={event => setCompanyId(event.target.value)} style={{ display: "block", width: "100%", padding: 9 }}><option value="">{t("Select company", "Seleccione empresa")}</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>{t("Reason code", "Código de motivo")}<Input value={reasonCode} onChange={event => setReasonCode(event.target.value)} placeholder="PROJECT_COMPANY_AUTHORITY_CHANGED" /></label><label>{t("Explanation (English)", "Explicación (inglés)")}<Input value={explanationEn} onChange={event => setExplanationEn(event.target.value)} /></label><label>{t("Explanation (Spanish)", "Explicación (español)")}<Input value={explanationEs} onChange={event => setExplanationEs(event.target.value)} /></label><Button disabled={state === "saving"} onClick={() => void save()}>{state === "saving" ? t("Saving immutable version…", "Guardando versión inmutable…") : t("Save binding version", "Guardar versión de vinculación")}</Button></section>}
    {projectId && <section aria-labelledby="binding-history" style={{ marginTop: 28 }}><h2 id="binding-history">{t("Immutable binding history", "Historial inmutable de vinculaciones")}</h2>{bindings.length === 0 ? <p role="status">{t("No binding versions exist for this project yet.", "Todavía no existen versiones de vinculación para este proyecto.")}</p> : <ol>{bindings.map(binding => <li key={`${binding.projectId}:${binding.version}`} style={{ marginBottom: 12 }}><strong>{t("Version", "Versión")} {binding.version}</strong> · {companies.find(company => company.id === binding.companyId)?.name || `#${binding.companyId}`}<div>{binding.reasonCode} · {new Date(binding.timestamp).toLocaleString()}</div><div>{lang === "es" ? binding.explanation.es : binding.explanation.en}</div></li>)}</ol>}</section>}</main>;
}
export default ProjectCompanyBindings;
