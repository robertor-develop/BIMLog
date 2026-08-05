import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type LocalizedText = { en: string; es: string };
type ApuCapabilities = {
  canCreate: boolean;
  canApply: boolean;
  canCommit: boolean;
  canApprove: boolean;
  canApproveOverrun: boolean;
  reason?: LocalizedText;
};
type ApuApplicationSummary = {
  id: string;
  status: ApuApplicationStatus;
  currency: string;
  template: {
    id: string;
    name: string;
    version: string;
    fingerprint: string;
  };
  totals: {
    originalBudget: string | null;
    committed: string | null;
    approved: string | null;
    paidReleased: string | null;
    remaining: string | null;
    overrun: string | null;
  } | null;
};
type ApuApplicationStatus =
  | "draft"
  | "applied"
  | "committed"
  | "approved"
  | "rejected"
  | "superseded"
  | "voided"
  | "closed";
type ApuWorkspace = {
  project: { id: number; name: string; code: string };
  company: { id: string; name: string } | null;
  boundary: LocalizedText;
  capabilities: ApuCapabilities;
  applications: ApuApplicationSummary[];
  contract: {
    schemaVersion: string;
    evaluatorVersion: string | null;
    evaluationSupported: boolean;
  };
  meta: { revision: string; fingerprint: string };
};
type ApuErrorKind =
  | "denied"
  | "binding"
  | "mismatch"
  | "not_found"
  | "unsupported"
  | "conflict"
  | "invalid_project"
  | "error";
type ApuFailure = {
  kind: ApuErrorKind;
  code: string;
  message: LocalizedText;
  correlationId?: string;
};

const fallbackMessages: Record<ApuErrorKind, LocalizedText> = {
  denied: {
    en: "You do not have the current Finance authority required to view Generic APU.",
    es: "No tiene la autoridad financiera vigente requerida para ver el APU genérico.",
  },
  binding: {
    en: "The project needs an accepted company binding before Generic APU can be opened.",
    es: "El proyecto necesita una vinculación de empresa aceptada antes de abrir el APU genérico.",
  },
  mismatch: {
    en: "The current project-company boundary does not match this Generic APU resource.",
    es: "El límite vigente entre proyecto y empresa no coincide con este recurso de APU genérico.",
  },
  not_found: {
    en: "No Generic APU resource is available for this project.",
    es: "No hay un recurso de APU genérico disponible para este proyecto.",
  },
  unsupported: {
    en: "APU evaluation is on hold until the required versioned financial contract is available.",
    es: "La evaluación de APU está en espera hasta que esté disponible el contrato financiero versionado requerido.",
  },
  conflict: {
    en: "This Generic APU changed. Reload and review the current version before continuing.",
    es: "Este APU genérico cambió. Recargue y revise la versión vigente antes de continuar.",
  },
  invalid_project: {
    en: "A valid project is required to open Generic APU.",
    es: "Se requiere un proyecto válido para abrir el APU genérico.",
  },
  error: {
    en: "Generic APU could not be loaded. Retry after confirming the current project context.",
    es: "No se pudo cargar el APU genérico. Reintente después de confirmar el contexto vigente del proyecto.",
  },
};

function failureKind(status: number, code: string): ApuErrorKind {
  if (status === 403 && code === "FIN_PROJECT_COMPANY_MISMATCH") return "mismatch";
  if (status === 401 || status === 403) return "denied";
  if (status === 409 && code === "FIN_PROJECT_BINDING_REQUIRED") return "binding";
  if (status === 404) return "not_found";
  if (status === 422 && code === "APU_EVALUATION_UNSUPPORTED") return "unsupported";
  if (status === 409) return "conflict";
  return "error";
}

function localized(value: unknown): LocalizedText | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.en === "string" && typeof candidate.es === "string"
    ? { en: candidate.en, es: candidate.es }
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nullableText(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

const applicationStatuses = new Set<ApuApplicationStatus>([
  "draft", "applied", "committed", "approved", "rejected", "superseded", "voided", "closed",
]);

function parseApplication(value: unknown, evaluationSupported: boolean): ApuApplicationSummary {
  const application = record(value);
  const template = record(application?.template);
  const totals = application?.totals === null ? null : record(application?.totals);
  const id = requiredText(application?.id);
  const status = requiredText(application?.status)?.toLowerCase();
  const currency = requiredText(application?.currency);
  const templateId = requiredText(template?.id);
  const templateName = requiredText(template?.name);
  const templateVersion = requiredText(template?.version);
  const templateFingerprint = requiredText(template?.fingerprint);
  if (!application || !template || !id || !status || !currency || !templateId ||
      !templateName || !templateVersion || !templateFingerprint ||
      !applicationStatuses.has(status as ApuApplicationStatus)) {
    throw new Error("APU_SCHEMA_INVALID");
  }
  let parsedTotals: ApuApplicationSummary["totals"] = null;
  if (totals) {
    const originalBudget = nullableText(totals.originalBudget);
    const committed = nullableText(totals.committed);
    const approved = nullableText(totals.approved);
    const paidReleased = nullableText(totals.paidReleased);
    const remaining = nullableText(totals.remaining);
    const overrun = nullableText(totals.overrun);
    if ([originalBudget, committed, approved, paidReleased, remaining, overrun]
      .some((entry) => entry === undefined)) throw new Error("APU_SCHEMA_INVALID");
    parsedTotals = {
      originalBudget: originalBudget!, committed: committed!, approved: approved!,
      paidReleased: paidReleased!, remaining: remaining!, overrun: overrun!,
    };
  } else if (application.totals !== null || evaluationSupported) {
    throw new Error("APU_SCHEMA_INVALID");
  }
  return {
    id,
    status: status as ApuApplicationStatus,
    currency,
    template: { id: templateId, name: templateName, version: templateVersion, fingerprint: templateFingerprint },
    totals: parsedTotals,
  };
}

function parseWorkspace(value: unknown, expectedProjectId: number): ApuWorkspace {
  if (!value || typeof value !== "object") throw new Error("APU_SCHEMA_INVALID");
  const envelope = value as Record<string, unknown>;
  const data = record(envelope.data);
  const meta = record(envelope.meta);
  if (!data || !meta || !Array.isArray(data.applications)) throw new Error("APU_SCHEMA_INVALID");
  const project = record(data.project);
  const contract = record(data.contract);
  const capabilities = record(data.capabilities);
  const company = data.company === null ? null : record(data.company);
  const boundary = localized(data.boundary);
  const evaluationSupported = contract?.evaluationSupported;
  const evaluatorVersion = contract?.evaluatorVersion === null
    ? null
    : requiredText(contract?.evaluatorVersion);
  const capabilityKeys: Array<keyof Omit<ApuCapabilities, "reason">> = [
    "canCreate", "canApply", "canCommit", "canApprove", "canApproveOverrun",
  ];
  if (
    !project || typeof project.id !== "number" || typeof project.name !== "string" ||
    typeof project.code !== "string" || !contract || !capabilities || !boundary ||
    capabilityKeys.some((key) => typeof capabilities[key] !== "boolean") ||
    (data.company !== null && (!company || !requiredText(company.id) || !requiredText(company.name))) ||
    typeof contract.schemaVersion !== "string" || typeof evaluationSupported !== "boolean" ||
    (contract.evaluatorVersion !== null && !evaluatorVersion) ||
    (evaluationSupported && !evaluatorVersion) ||
    typeof meta.revision !== "string" || typeof meta.fingerprint !== "string"
  ) throw new Error("APU_SCHEMA_INVALID");
  if (project.id !== expectedProjectId) {
    throw {
      kind: "mismatch",
      code: "APU_PROJECT_CONTEXT_MISMATCH",
      message: fallbackMessages.mismatch,
    } satisfies ApuFailure;
  }
  return {
    project: { id: project.id, name: project.name, code: project.code },
    company: company
      ? { id: String(company.id), name: String(company.name) }
      : null,
    boundary,
    capabilities: {
      canCreate: capabilities.canCreate === true,
      canApply: capabilities.canApply === true,
      canCommit: capabilities.canCommit === true,
      canApprove: capabilities.canApprove === true,
      canApproveOverrun: capabilities.canApproveOverrun === true,
      reason: localized(capabilities.reason) ?? undefined,
    },
    applications: data.applications.map((application) => parseApplication(application, evaluationSupported)),
    contract: {
      schemaVersion: contract.schemaVersion,
      evaluatorVersion,
      evaluationSupported,
    },
    meta: { revision: meta.revision, fingerprint: meta.fingerprint },
  };
}

export function FinancialApuWorkspace() {
  const { token } = useAuthStore();
  const { language, tt } = useI18n();
  const [, route] = useRoute("/projects/:id/financial/apu");
  const projectId = Number(route?.id);
  const [workspace, setWorkspace] = useState<ApuWorkspace | null>(null);
  const [failure, setFailure] = useState<ApuFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    const sequence = ++requestSequence.current;
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      setWorkspace(null);
      setFailure({ kind: "invalid_project", code: "APU_INVALID_PROJECT", message: fallbackMessages.invalid_project });
      setLoading(false);
      return () => undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailure(null);
    fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/apu`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = typeof body?.code === "string" ? body.code : "APU_REQUEST_FAILED";
          const kind = failureKind(response.status, code);
          throw {
            kind,
            code,
            message: localized(body?.error) ?? fallbackMessages[kind],
            correlationId: typeof body?.correlationId === "string" ? body.correlationId : undefined,
          } satisfies ApuFailure;
        }
        return parseWorkspace(body, projectId);
      })
      .then((next) => {
        if (sequence !== requestSequence.current) return;
        setWorkspace(next);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setWorkspace(null);
        if (error && typeof error === "object" && "kind" in error) setFailure(error as ApuFailure);
        else setFailure({ kind: "error", code: "APU_REQUEST_FAILED", message: fallbackMessages.error });
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, token]);

  useEffect(() => load(), [load]);
  useEffect(() => { headingRef.current?.focus(); }, []);

  const copy = (value: LocalizedText) => value[language === "es" ? "es" : "en"];
  const authorityReason = workspace?.capabilities.reason
    ? copy(workspace.capabilities.reason)
    : tt(
        "Project membership and screen roles do not grant Finance authority. Every operation is reauthorized by the server.",
        "La membresía del proyecto y los roles de pantalla no otorgan autoridad financiera. El servidor vuelve a autorizar cada operación.",
      );
  const canAuthor = workspace
    ? Object.values(workspace.capabilities).some((value) => value === true)
    : false;
  const capabilityRows = workspace ? [
    ["canCreate", tt("Create analysis", "Crear análisis")],
    ["canApply", tt("Apply template", "Aplicar plantilla")],
    ["canCommit", tt("Commit values", "Comprometer valores")],
    ["canApprove", tt("Approve", "Aprobar")],
    ["canApproveOverrun", tt("Approve overrun", "Aprobar exceso")],
  ] as const : [];
  const statusLabel = (status: ApuApplicationStatus) => {
    const labels: Record<ApuApplicationStatus, LocalizedText> = {
      draft: { en: "Draft", es: "Borrador" },
      applied: { en: "Applied", es: "Aplicado" },
      committed: { en: "Committed", es: "Comprometido" },
      approved: { en: "Approved", es: "Aprobado" },
      rejected: { en: "Rejected", es: "Rechazado" },
      superseded: { en: "Superseded", es: "Reemplazado" },
      voided: { en: "Voided", es: "Anulado" },
      closed: { en: "Closed", es: "Cerrado" },
    };
    return copy(labels[status]);
  };

  return (
    <FinancialProjectShell projectId={projectId} activeTab="apu">
      <main className="apu-page" data-testid="financial-apu-workspace">
        <style>{styles}</style>
        <header className="apu-header">
          <div>
            <p className="apu-eyebrow">{tt("Commercial · Financial authority", "Comercial · Autoridad financiera")}</p>
            <h1 ref={headingRef} tabIndex={-1}>{tt("Generic APU", "APU genérico")}</h1>
            <p>{tt("Resource and unit-price analysis with governed project provenance.", "Análisis de recursos y precios unitarios con procedencia de proyecto gobernada.")}</p>
          </div>
          <span className="apu-boundary"><ShieldCheck size={16} aria-hidden="true" /> {tt("Server-authorized", "Autorizado por el servidor")}</span>
        </header>

        {loading && (
          <section className="apu-state" role="status" aria-live="polite" data-testid="apu-loading">
            <RefreshCw className="apu-spin" size={20} aria-hidden="true" />
            <div><h2>{tt("Loading Generic APU", "Cargando APU genérico")}</h2><p>{tt("Verifying the current project and Finance boundary…", "Verificando el proyecto vigente y el límite financiero…")}</p></div>
          </section>
        )}

        {!loading && failure && (
          <section className="apu-state apu-error" role="alert" data-testid={`apu-state-${failure.kind}`}>
            <TriangleAlert size={22} aria-hidden="true" />
            <div>
              <h2>{failure.kind === "unsupported" ? tt("Evaluation hold", "Evaluación en espera") : tt("Generic APU unavailable", "APU genérico no disponible")}</h2>
              <p>{copy(failure.message)}</p>
              <p className="apu-code">{failure.code}{failure.correlationId ? ` · ${tt("Reference", "Referencia")}: ${failure.correlationId}` : ""}</p>
              {(failure.kind === "error" || failure.kind === "conflict") && <button type="button" onClick={load}>{tt("Reload current state", "Recargar estado vigente")}</button>}
            </div>
          </section>
        )}

        {!loading && workspace && (
          <>
            <section className="apu-provenance" aria-labelledby="apu-provenance-title">
              <div><h2 id="apu-provenance-title">{tt("Authorized provenance", "Procedencia autorizada")}</h2><p>{copy(workspace.boundary)}</p></div>
              <dl>
                <div><dt>{tt("Project", "Proyecto")}</dt><dd>{workspace.project.name} ({workspace.project.code})</dd></div>
                <div><dt>{tt("Company boundary", "Límite de empresa")}</dt><dd>{workspace.company?.name ?? tt("Binding unavailable", "Vinculación no disponible")}</dd></div>
                <div><dt>{tt("Schema", "Esquema")}</dt><dd>{workspace.contract.schemaVersion}</dd></div>
                <div><dt>{tt("Evaluator", "Evaluador")}</dt><dd>{workspace.contract.evaluatorVersion ?? tt("Not available", "No disponible")}</dd></div>
                <div><dt>{tt("Revision", "Revisión")}</dt><dd className="apu-mono">{workspace.meta.revision}</dd></div>
                <div><dt>{tt("Fingerprint", "Huella")}</dt><dd className="apu-mono">{workspace.meta.fingerprint}</dd></div>
              </dl>
            </section>

            {!workspace.contract.evaluationSupported && (
              <section className="apu-state apu-hold" role="status" data-testid="apu-evaluation-hold">
                <TriangleAlert size={22} aria-hidden="true" />
                <div><h2>{tt("Evaluation hold", "Evaluación en espera")}</h2><p>{fallbackMessages.unsupported[language === "es" ? "es" : "en"]}</p><p>{tt("No calculated total, Remaining value, cap result, or placeholder zero is shown.", "No se muestra ningún total calculado, valor restante, resultado de límite ni cero provisional.")}</p></div>
              </section>
            )}

            <section className="apu-authority" aria-labelledby="apu-authority-title">
              <div><h2 id="apu-authority-title">{tt("Operation authority", "Autoridad de operación")}</h2><p>{authorityReason}</p></div>
              <span>{canAuthor ? tt("Server capabilities received", "Capacidades del servidor recibidas") : tt("Read only", "Solo lectura")}</span>
              <ul aria-label={tt("Server-authorized operations", "Operaciones autorizadas por el servidor")}>
                {capabilityRows.map(([key, label]) => (
                  <li key={key}><span>{label}</span><strong>{workspace.capabilities[key] ? tt("Allowed", "Permitido") : tt("Unavailable", "No disponible")}</strong></li>
                ))}
              </ul>
            </section>

            {workspace.applications.length === 0 ? (
              <section className="apu-empty" data-testid="apu-empty"><h2>{tt("No applied APU", "Sin APU aplicado")}</h2><p>{tt("No template version has been applied to this project. Nothing was created automatically.", "No se ha aplicado una versión de plantilla a este proyecto. No se creó nada automáticamente.")}</p></section>
            ) : (
              <section aria-labelledby="apu-applications-title">
                <h2 id="apu-applications-title">{tt("Applied analyses", "Análisis aplicados")}</h2>
                <div className="apu-grid">
                  {workspace.applications.map((application) => (
                    <article className="apu-card" key={application.id}>
                      <div className="apu-card-heading"><div><h3>{application.template.name}</h3><p>{tt("Version", "Versión")} {application.template.version}</p></div><span>{statusLabel(application.status)}</span></div>
                      <dl>
                        <div><dt>{tt("Currency", "Moneda")}</dt><dd>{application.currency}</dd></div>
                        <div><dt>{tt("Template ID", "ID de plantilla")}</dt><dd className="apu-mono">{application.template.id}</dd></div>
                        <div><dt>{tt("Fingerprint", "Huella")}</dt><dd className="apu-mono">{application.template.fingerprint}</dd></div>
                      </dl>
                      {workspace.contract.evaluationSupported && application.totals ? (
                        <div className="apu-totals" aria-label={tt("Server-computed totals", "Totales calculados por el servidor")}>
                          {([
                            ["Original", "Original", application.totals.originalBudget],
                            ["Committed", "Comprometido", application.totals.committed],
                            ["Approved", "Aprobado", application.totals.approved],
                            ["Paid / released", "Pagado / liberado", application.totals.paidReleased],
                            ["Remaining", "Restante", application.totals.remaining],
                            ["Overrun", "Exceso", application.totals.overrun],
                          ] as const).map(([en, es, value]) => <div key={en}><span>{tt(en, es)}</span><strong>{value === null ? tt("Unavailable", "No disponible") : `${value} ${application.currency}`}</strong></div>)}
                        </div>
                      ) : <p className="apu-no-totals">{tt("Calculated values are unavailable while evaluation is on hold.", "Los valores calculados no están disponibles mientras la evaluación esté en espera.")}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </FinancialProjectShell>
  );
}

const styles = `
.apu-page{width:100%;max-width:1120px;margin:0 auto;padding:24px 20px 56px;box-sizing:border-box;display:grid;gap:20px;color:hsl(var(--foreground))}
.apu-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}.apu-header h1{font-size:28px;margin:3px 0 7px;outline:none}.apu-header p{margin:0;color:hsl(var(--muted-foreground));line-height:1.5}.apu-eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:800}.apu-boundary{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid hsl(var(--border));border-radius:999px;font-size:12px;font-weight:750;background:hsl(var(--card))}
.apu-state,.apu-provenance,.apu-authority,.apu-empty,.apu-card{border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--card));padding:18px}.apu-state{display:flex;gap:12px;align-items:flex-start}.apu-state h2,.apu-provenance h2,.apu-authority h2,.apu-empty h2{font-size:17px;margin:0 0 6px}.apu-state p,.apu-provenance p,.apu-authority p,.apu-empty p{margin:0;color:hsl(var(--muted-foreground));line-height:1.55}.apu-error{border-color:#DC262666}.apu-hold{border-color:#B4530966}.apu-code{font:11px ui-monospace,SFMono-Regular,Consolas,monospace;margin-top:8px!important;overflow-wrap:anywhere}.apu-state button{margin-top:12px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:8px 11px;font-weight:700;cursor:pointer}.apu-spin{animation:apu-spin 1s linear infinite}@keyframes apu-spin{to{transform:rotate(360deg)}}
.apu-provenance{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,1.4fr);gap:18px}.apu-provenance dl,.apu-card dl{margin:0;display:grid;gap:8px}.apu-provenance dl{grid-template-columns:repeat(2,minmax(0,1fr))}.apu-provenance dl div,.apu-card dl div{min-width:0}.apu-provenance dt,.apu-card dt{font-size:11px;color:hsl(var(--muted-foreground));font-weight:800;text-transform:uppercase}.apu-provenance dd,.apu-card dd{margin:3px 0 0;font-size:13px;overflow-wrap:anywhere}.apu-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.apu-authority{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start}.apu-authority>span{white-space:nowrap;padding:7px 10px;border-radius:999px;background:hsl(var(--muted));font-size:12px;font-weight:800}.apu-authority ul{grid-column:1/-1;list-style:none;margin:0;padding:12px 0 0;border-top:1px solid hsl(var(--border));display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.apu-authority li{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;background:hsl(var(--muted)/.55);font-size:12px}.apu-authority li strong{font-size:11px}.apu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.apu-card-heading{display:flex;justify-content:space-between;gap:12px}.apu-card-heading h3{margin:0;font-size:16px}.apu-card-heading p{margin:3px 0 0;color:hsl(var(--muted-foreground));font-size:12px}.apu-card-heading>span{font-size:11px;font-weight:800;text-transform:uppercase}.apu-card dl{margin-top:14px}.apu-totals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:15px}.apu-totals div{border-top:1px solid hsl(var(--border));padding-top:8px;display:grid;gap:3px}.apu-totals span{font-size:11px;color:hsl(var(--muted-foreground))}.apu-totals strong{font-size:13px}.apu-no-totals{margin:15px 0 0;color:hsl(var(--muted-foreground));font-size:13px}
@media(max-width:700px){.apu-page{padding:18px 12px 44px}.apu-provenance{grid-template-columns:1fr}.apu-provenance dl{grid-template-columns:1fr}.apu-authority{grid-template-columns:1fr}.apu-authority>span{white-space:normal}.apu-authority ul{grid-column:1;grid-template-columns:1fr}.apu-grid{grid-template-columns:1fr}.apu-totals{grid-template-columns:1fr}}
`;
