import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Mode = "structure" | "budget" | "history" | "snapshot";
type Workspace = {
  project: { id: number; name: string; code: string; companyName: string };
  structures: any[];
  nodes: any[];
  budgets: any[];
  snapshots: any[];
  snapshot: any | null;
  boundary: { en: string; es: string };
};
export function FinancialBudgetWorkspace({ mode }: { mode: Mode }) {
  const { token } = useAuthStore(),
    { language, tt } = useI18n();
  const [, base] = useRoute("/projects/:id/financial/:page"),
    [, snap] = useRoute("/projects/:id/financial/snapshots/:snapshotId");
  const projectId = Number((snap?.id ?? base?.id) as string),
    snapshotId = snap?.snapshotId;
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const endpoint = snapshotId
    ? `/projects/${projectId}/financial/snapshots/${snapshotId}`
    : `/projects/${projectId}/financial/workspace`;
  const load = () => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(
            body?.error?.[language] ||
              tt(
                "Financial access was denied.",
                "Se denegó el acceso financiero.",
              ),
          );
        return body;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [endpoint, token, language]);
  const current = data?.snapshots?.[0],
    original = data?.snapshots?.[data.snapshots.length - 1];
  const money = (value: unknown, currency?: string) =>
    `${String(value ?? "0")} ${currency ?? data?.budgets?.[0]?.currency ?? ""}`.trim();
  const titles = {
    structure: tt("Cost Structure", "Estructura de Costos"),
    budget: tt("Project Budget", "Presupuesto del Proyecto"),
    history: tt("Budget Version History", "Historial de Versiones"),
    snapshot: tt(
      "Approved Baseline Snapshot",
      "Instantánea de Línea Base Aprobada",
    ),
  };
  return (
    <div className="fb-page">
      <style>{styles}</style>
      <header className="fb-header">
        <div>
          <Link href={`/projects/${projectId}/dashboard`} className="fb-back">
            ← BIMLog
          </Link>
          <h1>{titles[mode]}</h1>
          <p>
            {data
              ? `${data.project.companyName} · ${data.project.name} (${data.project.code})`
              : tt(
                  "Loading project context…",
                  "Cargando contexto del proyecto…",
                )}
          </p>
        </div>
        <span className="fb-authority">
          {tt(
            "Entitlement + explicit financial authority required",
            "Se requiere derecho + autoridad financiera explícita",
          )}
        </span>
      </header>
      <nav
        className="fb-nav"
        aria-label={tt("Financial controls", "Controles financieros")}
      >
        <Link href={`/projects/${projectId}/financial/cost-structure`}>
          {tt("Cost Structure", "Estructura")}
        </Link>
        <Link href={`/projects/${projectId}/financial/budget`}>
          {tt("Project Budget", "Presupuesto")}
        </Link>
        <Link href={`/projects/${projectId}/financial/history`}>
          {tt("Version History", "Versiones")}
        </Link>
        {current && (
          <Link
            href={`/projects/${projectId}/financial/snapshots/${current.id}`}
          >
            {tt("Approved Baseline", "Línea Base")}
          </Link>
        )}
      </nav>
      {loading && (
        <main className="fb-state">
          {tt(
            "Loading controlled financial records…",
            "Cargando registros financieros controlados…",
          )}
        </main>
      )}
      {error && (
        <main className="fb-state fb-error">
          <p>{error}</p>
          <button onClick={load}>{tt("Retry", "Reintentar")}</button>
        </main>
      )}
      {data && !loading && !error && (
        <main>
          <section className="fb-boundary">
            {language === "es" ? data.boundary.es : data.boundary.en}
          </section>
          {mode !== "structure" && (
            <section className="fb-summary">
              <Summary
                label={tt("Original Budget", "Presupuesto Original")}
                value={money(original?.originalTotal ?? "0", current?.currency)}
              />
              <Summary
                label={tt("Current Budget", "Presupuesto Actual")}
                value={money(current?.currentTotal ?? "0", current?.currency)}
              />
              <Summary
                label={tt(
                  "Difference from Original",
                  "Diferencia del Original",
                )}
                value={money(
                  current?.differenceFromOriginal ?? "0",
                  current?.currency,
                )}
              />
            </section>
          )}
          {mode === "structure" && <CostStructure data={data} tt={tt} />}{" "}
          {mode === "budget" && (
            <Budget
              data={data}
              tt={tt}
              projectId={projectId}
              token={token ?? ""}
              reload={load}
            />
          )}{" "}
          {mode === "history" && (
            <History data={data} tt={tt} projectId={projectId} />
          )}{" "}
          {mode === "snapshot" && (
            <Snapshot data={data} tt={tt} projectId={projectId} token={token ?? ""} />
          )}
        </main>
      )}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="fb-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ children }: { children: string }) {
  return <div className="fb-empty">{children}</div>;
}
function CostStructure({
  data,
  tt,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
}) {
  const structure = data.structures[0];
  return (
    <section className="fb-panel">
      <h2>
        {tt("Pinned project cost structure", "Estructura de costos fijada")}
      </h2>
      {!structure ? (
        <Empty>
          {tt(
            "No approved project cost structure is pinned yet.",
            "Aún no hay una estructura de costos aprobada fijada.",
          )}
        </Empty>
      ) : (
        <>
          <div className="fb-meta">
            <span>
              {tt("Structure version", "Versión de estructura")}:{" "}
              {structure.version}
            </span>
            <span>
              {tt("Pinned library version", "Versión de biblioteca fijada")}:{" "}
              {structure.library_version}
            </span>
            <span>
              {tt("Status", "Estado")}: {structure.status}
            </span>
          </div>
          <div className="fb-table" role="table">
            <div className="fb-row fb-head" role="row">
              <span>{tt("Hierarchy / Code", "Jerarquía / Código")}</span>
              <span>{tt("Name", "Nombre")}</span>
              <span>{tt("Mapping provenance", "Procedencia del mapeo")}</span>
            </div>
            {data.nodes.map((n: any) => (
              <div className="fb-row" role="row" key={n.id}>
                <span>
                  <b>{n.project_code}</b>
                </span>
                <span>
                  {n.project_name}
                  {!n.active && <em> {tt("Deprecated", "Obsoleto")}</em>}
                </span>
                <span>{n.mapping_provenance}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function Budget({
  data,
  tt,
  projectId,
  token,
  reload,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  projectId: number;
  token: string;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [importFile, setImportFile] = useState<File | null>(null),
    [sourceFileId, setSourceFileId] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [purpose, setPurpose] = useState("Initial controlled budget import"),
    [preview, setPreview] = useState<any | null>(null);
  const previewImport = async () => {
    if (!importFile || !sourceFileId) return;
    setBusy("import-preview");
    setMessage("");
    setPreview(null);
    const form = new FormData();
    form.append("file", importFile);
    form.append("sourceFileId", sourceFileId);
    form.append("currency", currency.trim().toUpperCase());
    form.append("idempotencyKey", crypto.randomUUID());
    try {
      const r = await fetch(
        `${API_BASE}/api/v1/projects/${projectId}/financial/imports/preview`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.en || "Import preview denied");
      setPreview(body);
      setMessage(
        tt(
          "Preview created; no budget has been written.",
          "Vista previa creada; no se ha escrito ningún presupuesto.",
        ),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const confirmImport = async () => {
    const structureVersionId = data.structures[0]?.id;
    if (!preview || !structureVersionId) return;
    setBusy("import-confirm");
    setMessage("");
    try {
      const r = await fetch(
        `${API_BASE}/api/v1/projects/${projectId}/financial/imports/${preview.id}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileHash: preview.fileHash,
            parsedFingerprint: preview.parsedFingerprint,
            currency: preview.currency,
            total: preview.total,
            structureVersionId,
            purpose,
          }),
        },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.en || "Import confirmation denied");
      setPreview(null);
      setMessage(tt("Budget draft created.", "Borrador de presupuesto creado."));
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const act = async (row: any, action: string) => {
    setBusy(row.id);
    setMessage("");
    const url =
      action === "approve"
        ? `/projects/${projectId}/financial/budgets/${row.id}/approve`
        : `/projects/${projectId}/financial/budgets/${row.id}/actions`;
    const body =
      action === "approve"
        ? {
            expectedRevision: row.revision,
            confirmationFingerprint: row.content_fingerprint,
          }
        : {
            action,
            expectedRevision: row.revision,
            reason: ["return", "reject", "withdraw"].includes(action)
              ? tt(
                  "Controlled workflow decision.",
                  "Decisión controlada del flujo.",
                )
              : undefined,
          };
    try {
      const r = await fetch(`${API_BASE}/api/v1${url}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(b?.error?.en || "Request denied");
      setMessage(
        tt("Controlled action recorded.", "Acción controlada registrada."),
      );
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="fb-panel">
      <div className="fb-panel-title">
        <div>
          <h2>
            {tt(
              "Controlled budget workflow",
              "Flujo presupuestario controlado",
            )}
          </h2>
          <p>
            {tt(
              "Draft → Submitted → Under Review → Approved. Submission freezes line values.",
              "Borrador → Enviado → En Revisión → Aprobado. El envío congela los valores.",
            )}
          </p>
        </div>
      </div>
      {message && (
        <div className="fb-message" role="status">
          {message}
        </div>
      )}
      <div className="fb-import">
        <h3>{tt("Controlled CSV/XLSX import", "Importación CSV/XLSX controlada")}</h3>
        <p>
          {tt(
            "Preview validates exact decimals, currency, cost-node mappings, formulas, and the authenticated source-file identity before any draft is created.",
            "La vista previa valida decimales exactos, moneda, mapeos, fórmulas e identidad autenticada del archivo antes de crear un borrador.",
          )}
        </p>
        <div className="fb-import-fields">
          <label>
            {tt("Evidence file", "Archivo de evidencia")}
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>
          <label>
            {tt("Authenticated file ID", "ID de archivo autenticado")}
            <input
              inputMode="numeric"
              value={sourceFileId}
              onChange={(event) => {
                setSourceFileId(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            {tt("ISO currency", "Moneda ISO")}
            <input
              maxLength={3}
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            {tt("Budget purpose", "Motivo del presupuesto")}
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
        </div>
        <div className="fb-actions">
          <button
            disabled={!importFile || !sourceFileId || busy !== ""}
            onClick={previewImport}
          >
            {tt("Validate preview", "Validar vista previa")}
          </button>
        </div>
        {preview && (
          <div className="fb-preview" role="status">
            <b>
              {tt("Exact preview total", "Total exacto de vista previa")}: {preview.total}{" "}
              {preview.currency}
            </b>
            <span>
              {tt("Accepted rows", "Filas aceptadas")}: {preview.acceptedCount} ·{" "}
              {tt("Rejected rows", "Filas rechazadas")}: {preview.rejectedCount}
            </span>
            {preview.rejected?.map((row: any) => (
              <small key={`${row.row}-${row.reasons.join("-")}`}>
                {tt("Row", "Fila")} {row.row}: {row.reasons.join(", ")}
              </small>
            ))}
            <code>{preview.parsedFingerprint}</code>
            <button
              disabled={
                preview.rejectedCount !== 0 || !data.structures[0]?.id || busy !== ""
              }
              onClick={confirmImport}
            >
              {tt("Confirm exact draft creation", "Confirmar creación exacta del borrador")}
            </button>
          </div>
        )}
      </div>
      {!data.budgets.length ? (
        <Empty>
          {tt(
            "No budget draft exists. Authorized Cost Preparers can create or import one.",
            "No existe un borrador. Los Preparadores autorizados pueden crear o importar uno.",
          )}
        </Empty>
      ) : (
        <div className="fb-cards">
          {data.budgets.map((b: any) => (
            <article className="fb-budget" key={b.id}>
              <div>
                <b>
                  {tt("Version", "Versión")} {b.version}
                </b>
                <span className="fb-status">{b.status}</span>
              </div>
              <strong>
                {String(b.calculated_total)} {b.currency}
              </strong>
              <p>{b.purpose}</p>
              <small>
                {tt("Fingerprint", "Huella")}: {b.content_fingerprint}
              </small>
              <div className="fb-actions">
                {b.status === "draft" && (
                  <button
                    disabled={busy === b.id}
                    onClick={() => act(b, "submit")}
                  >
                    {tt("Submit", "Enviar")}
                  </button>
                )}
                {b.status === "submitted" && (
                  <>
                    <button
                      disabled={busy === b.id}
                      onClick={() => act(b, "start_review")}
                    >
                      {tt("Start review", "Iniciar revisión")}
                    </button>
                    <button
                      disabled={busy === b.id}
                      onClick={() => act(b, "withdraw")}
                    >
                      {tt("Withdraw", "Retirar")}
                    </button>
                  </>
                )}
                {b.status === "under_review" && (
                  <>
                    <button
                      disabled={busy === b.id}
                      onClick={() => act(b, "approve")}
                    >
                      {tt(
                        "Confirm exact approval",
                        "Confirmar aprobación exacta",
                      )}
                    </button>
                    <button
                      disabled={busy === b.id}
                      onClick={() => act(b, "return")}
                    >
                      {tt("Return", "Devolver")}
                    </button>
                    <button
                      disabled={busy === b.id}
                      onClick={() => act(b, "reject")}
                    >
                      {tt("Reject", "Rechazar")}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function History({
  data,
  tt,
  projectId,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  projectId: number;
}) {
  return (
    <section className="fb-panel">
      <h2>
        {tt("Budget version history", "Historial de versiones del presupuesto")}
      </h2>
      {!data.budgets.length ? (
        <Empty>
          {tt(
            "No versions have been recorded.",
            "No se han registrado versiones.",
          )}
        </Empty>
      ) : (
        <div className="fb-table">
          <div className="fb-row fb-head">
            <span>{tt("Version", "Versión")}</span>
            <span>{tt("Status / Purpose", "Estado / Motivo")}</span>
            <span>{tt("Exact total", "Total exacto")}</span>
          </div>
          {data.budgets.map((b: any) => (
            <div className="fb-row" key={b.id}>
              <span>v{b.version}</span>
              <span>
                {b.status} · {b.purpose}
              </span>
              <span>
                {String(b.calculated_total)} {b.currency}
                {b.approved_snapshot_id && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/projects/${projectId}/financial/snapshots/${b.approved_snapshot_id}`}
                    >
                      {tt("Open snapshot", "Abrir instantánea")}
                    </Link>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function Snapshot({
  data,
  tt,
  projectId,
  token,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  projectId: number;
  token: string;
}) {
  const s = data.snapshot;
  if (!s)
    return (
      <section className="fb-panel">
        <Empty>
          {tt(
            "Select an approved baseline from version history.",
            "Seleccione una línea base aprobada del historial.",
          )}
        </Empty>
      </section>
    );
  return (
    <section className="fb-panel">
      <div className="fb-panel-title">
        <div>
          <h2>
            {tt("Immutable approved baseline", "Línea base aprobada inmutable")}
          </h2>
          <p>
            {tt(
              "Browser, PDF, and XLSX use this same snapshot source.",
              "El navegador, PDF y XLSX usan esta misma instantánea.",
            )}
          </p>
        </div>
          <div className="fb-actions">
            <ExportButton projectId={projectId} snapshotId={s.id} format="pdf" token={token} />
            <ExportButton projectId={projectId} snapshotId={s.id} format="xlsx" token={token} />
          </div>
      </div>
      <div className="fb-meta">
        <span>
          {tt("Approved", "Aprobado")}: {s.approvedAt}
        </span>
        <span>
          {tt("Applicable exact limit", "Límite exacto aplicable")}:{" "}
          {s.approvalLimit} {s.currency}
        </span>
      </div>
      <div className="fb-table">
        <div className="fb-row fb-head">
          <span>{tt("Hierarchy / Cost code", "Jerarquía / Código")}</span>
          <span>{tt("Description", "Descripción")}</span>
          <span>{tt("Approved amount", "Monto aprobado")}</span>
        </div>
        {s.lines.map((l: any) => (
          <div className="fb-row" key={l.stable_line_id}>
            <span>
              <b>{l.hierarchical_path}</b>
              <br />
              {l.project_name}
            </span>
            <span>{l.description}</span>
            <span>
              {String(l.amount)} {s.currency}
            </span>
          </div>
        ))}
      </div>
      <div className="fb-fingerprints">
        <code>{s.contentFingerprint}</code>
        <code>{s.snapshotFingerprint}</code>
      </div>
    </section>
  );
}
function ExportButton({ projectId, snapshotId, format, token }: { projectId: number; snapshotId: string; format: "pdf" | "xlsx"; token: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/snapshots/${snapshotId}/export.${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Export denied");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = `approved-budget-baseline.${format}`; link.click(); URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };
  return <button onClick={download} disabled={busy}>{format.toUpperCase()}</button>;
}
const styles = `.fb-page{min-height:100vh;background:#f5f7fa;color:#15202b;padding:24px;overflow-x:hidden}.fb-page>*{max-width:1180px;margin-left:auto;margin-right:auto}.fb-header{display:flex;justify-content:space-between;gap:20px;align-items:end}.fb-header h1{font-size:28px;margin:8px 0}.fb-header p,.fb-panel p{color:#5b6572}.fb-back{font-size:13px}.fb-authority{max-width:330px;padding:10px 12px;background:#e8f2ff;border-radius:8px;font-size:12px}.fb-nav{display:flex;gap:8px;margin-top:20px;overflow-x:auto;padding-bottom:8px}.fb-nav a,.fb-actions a,.fb-actions button,.fb-state button,.fb-preview button{white-space:nowrap;border:1px solid #ccd5df;border-radius:7px;padding:8px 12px;background:white;color:#174b7a;text-decoration:none;cursor:pointer}.fb-boundary{margin:16px 0;padding:12px;border-left:4px solid #d58b16;background:#fff9ec}.fb-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.fb-card,.fb-panel{background:white;border:1px solid #dfe5eb;border-radius:10px;padding:18px}.fb-card span{display:block;color:#66717e;font-size:12px}.fb-card strong{display:block;font-size:20px;margin-top:7px;font-variant-numeric:tabular-nums}.fb-panel{margin-top:14px}.fb-panel h2{margin:0 0 8px}.fb-panel-title{display:flex;justify-content:space-between;gap:16px;align-items:start}.fb-meta,.fb-actions{display:flex;gap:10px;flex-wrap:wrap}.fb-meta{font-size:12px;color:#596574;margin:12px 0}.fb-table{overflow-x:auto;border:1px solid #e4e9ef;border-radius:8px}.fb-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(220px,2fr) minmax(180px,1fr);gap:12px;padding:10px;border-bottom:1px solid #edf0f3;min-width:650px}.fb-head{font-size:11px;text-transform:uppercase;background:#f3f6f9;font-weight:700}.fb-empty,.fb-state{padding:36px;text-align:center;color:#66717e}.fb-error{color:#a22626}.fb-cards{display:grid;gap:10px}.fb-budget{border:1px solid #e2e7ed;border-radius:8px;padding:14px}.fb-budget>div:first-child{display:flex;justify-content:space-between}.fb-budget small,.fb-fingerprints code{display:block;overflow-wrap:anywhere;color:#697585}.fb-status{padding:3px 7px;border-radius:99px;background:#eef3f8;font-size:11px}.fb-message{padding:10px;background:#eef8ef;margin:10px 0}.fb-fingerprints{margin-top:14px}.fb-import{border:1px solid #dce4ec;border-radius:8px;padding:14px;margin:14px 0}.fb-import h3{margin:0}.fb-import-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fb-import-fields label{display:grid;gap:4px;font-size:12px;color:#596574}.fb-import-fields input{min-width:0;border:1px solid #ccd5df;border-radius:6px;padding:8px;background:white}.fb-preview{display:grid;gap:7px;margin-top:12px;padding:12px;background:#f4f8fc;border-radius:7px}.fb-preview code,.fb-preview small{overflow-wrap:anywhere}.fb-preview button{justify-self:start}@media(max-width:720px){.fb-page{padding:12px}.fb-header{display:block}.fb-authority{display:block;margin-top:10px}.fb-summary,.fb-import-fields{grid-template-columns:1fr}.fb-panel-title{display:block}.fb-row{min-width:0;grid-template-columns:1fr;gap:4px}.fb-head{display:none}.fb-table{overflow:visible}.fb-row span{overflow-wrap:anywhere}.fb-row span:last-child{font-variant-numeric:tabular-nums}.fb-actions{margin-top:10px}}`;
