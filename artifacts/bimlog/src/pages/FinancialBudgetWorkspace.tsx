import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { PrintPdfButton } from "@/components/PrintPdfButton";

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
type ExportFilters = {
  search: string;
  status: string;
  sort: string;
  includeInactive: boolean;
  includeNotes: boolean;
  includeTotals: boolean;
};
const valueText = (value: unknown) => String(value ?? "");
const matchesBudgetSearch = (values: unknown[], search: string) =>
  !search.trim() || values.map(valueText).join(" ").toLowerCase().includes(search.trim().toLowerCase());
const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sortLabel = (sort: string, tt: (a: string, b: string) => string) => {
  if (sort === "code_asc") return tt("Cost code A-Z", "Codigo A-Z");
  if (sort === "amount_desc") return tt("Amount high to low", "Monto mayor a menor");
  if (sort === "version_desc") return tt("Newest version", "Version mas nueva");
  if (sort === "version_asc") return tt("Oldest version", "Version mas antigua");
  if (sort === "status_asc") return tt("Status A-Z", "Estado A-Z");
  return tt("Default order", "Orden predeterminado");
};
const sortBudgetRows = <T extends Record<string, any>>(rows: T[], sort: string) => {
  if (sort === "code_asc")
    return [...rows].sort((a, b) =>
      valueText(a.project_code ?? a.hierarchical_path).localeCompare(valueText(b.project_code ?? b.hierarchical_path)),
    );
  if (sort === "amount_desc")
    return [...rows].sort((a, b) => Number(b.amount ?? b.calculated_total ?? 0) - Number(a.amount ?? a.calculated_total ?? 0));
  if (sort === "version_desc") return [...rows].sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0));
  if (sort === "version_asc") return [...rows].sort((a, b) => Number(a.version ?? 0) - Number(b.version ?? 0));
  if (sort === "status_asc")
    return [...rows].sort((a, b) => valueText(a.status).localeCompare(valueText(b.status)) || Number(b.version ?? 0) - Number(a.version ?? 0));
  return [...rows];
};
const safeFileName = (name: string, fallback: string) => {
  const cleaned = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
};
const fileNameFromDisposition = (header: string | null, fallback: string) => {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basic = header.match(/filename="?([^";]+)"?/i)?.[1];
  try {
    return safeFileName(utf8 ? decodeURIComponent(utf8) : basic ?? "", fallback);
  } catch {
    return safeFileName(basic ?? "", fallback);
  }
};
export function FinancialBudgetWorkspace({ mode }: { mode: Mode }) {
  const { token } = useAuthStore(),
    { language, tt } = useI18n();
  const lang = language;
  const [, base] = useRoute("/projects/:id/financial/:page"),
    [, snap] = useRoute("/projects/:id/financial/snapshots/:snapshotId");
  const projectId = Number((snap?.id ?? base?.id) as string),
    snapshotId = snap?.snapshotId;
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [filters, setFilters] = useState<ExportFilters>({
      search: "",
      status: "all",
      sort: "default",
      includeInactive: true,
      includeNotes: true,
      includeTotals: true,
    });
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
  const visibleNodes = data
    ? sortBudgetRows(
        data.nodes
          .filter((n: any) => filters.includeInactive || n.active)
          .filter((n: any) => matchesBudgetSearch([n.project_code, n.project_name, n.mapping_provenance], filters.search)),
        filters.sort,
      )
    : [];
  const visibleBudgets = data
    ? sortBudgetRows(
        data.budgets
          .filter((b: any) => filters.status === "all" || b.status === filters.status)
          .filter((b: any) => {
            const searchValues = mode === "history"
              ? [b.version, b.status, b.purpose, b.calculated_total, b.currency]
              : [b.version, b.status, b.purpose, b.calculated_total, b.currency, b.content_fingerprint];
            return matchesBudgetSearch(searchValues, filters.search);
          }),
        filters.sort,
      )
    : [];
  const visibleSnapshotLines = data?.snapshot
    ? sortBudgetRows(
        data.snapshot.lines.filter((l: any) => {
          const searchValues = filters.includeNotes
            ? [l.hierarchical_path, l.project_name, l.description, l.amount, l.notes]
            : [l.hierarchical_path, l.project_name, l.description, l.amount];
          return matchesBudgetSearch(searchValues, filters.search);
        }),
        filters.sort,
      )
    : [];
  const visibleCount =
    mode === "structure" ? visibleNodes.length : mode === "snapshot" ? visibleSnapshotLines.length : visibleBudgets.length;
  const exportCurrentViewPdf = async () => {
    if (!data || exporting) return;
    setExporting(true);
    setExportError("");
    const params = new URLSearchParams({
      view: mode,
      lang: language === "es" ? "es" : "en",
      search: filters.search.trim(),
      status: filters.status,
      sort: filters.sort,
      include_inactive: String(filters.includeInactive),
      include_notes: String(filters.includeNotes),
      include_totals: String(filters.includeTotals),
    });
    if (snapshotId) params.set("snapshotId", snapshotId);
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/current-view/export.pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.[language] || body?.error?.en || tt("Budget PDF export failed.", "Error al exportar PDF de presupuesto."));
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFromDisposition(response.headers.get("Content-Disposition"), `budget-current-view-${mode}.pdf`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };
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
      <style>{exportStyles}</style>
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
          <section className="fb-current-view" aria-label={tt("Budget current view export controls", "Controles de exportacion de vista actual")}>
            <div className="fb-current-view-head">
              <div>
                <strong>{tt("Current view controls", "Controles de vista actual")}</strong>
                <p>{tt("These controls filter the rows shown here and the current-view PDF.", "Estos controles filtran las filas visibles y el PDF de vista actual.")}</p>
              </div>
              <PrintPdfButton
                lang={lang}
                onClick={exportCurrentViewPdf}
                loading={exporting}
                disabled={!data}
              />
            </div>
            <div className="fb-export-toolbar">
              <label>
                {tt("Search", "Busqueda")}
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder={mode === "history" ? tt("Version, status, purpose, amount", "Version, estado, motivo, monto") : tt("Code, purpose, amount, fingerprint", "Codigo, motivo, monto, huella")}
                />
              </label>
              {(mode === "budget" || mode === "history") && (
                <label>
                  {tt("Status", "Estado")}
                  <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                    <option value="all">{tt("All statuses", "Todos los estados")}</option>
                    <option value="draft">{tt("Draft", "Borrador")}</option>
                    <option value="submitted">{tt("Submitted", "Enviado")}</option>
                    <option value="under_review">{tt("Under review", "En revision")}</option>
                    <option value="approved">{tt("Approved", "Aprobado")}</option>
                    <option value="returned">{tt("Returned", "Devuelto")}</option>
                    <option value="rejected">{tt("Rejected", "Rechazado")}</option>
                    <option value="withdrawn">{tt("Withdrawn", "Retirado")}</option>
                  </select>
                </label>
              )}
              <label>
                {tt("Sort", "Orden")}
                <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
                  <option value="default">{tt("Default order", "Orden predeterminado")}</option>
                  <option value="code_asc">{tt("Cost code A-Z", "Codigo A-Z")}</option>
                  <option value="amount_desc">{tt("Amount high to low", "Monto mayor a menor")}</option>
                  {(mode === "budget" || mode === "history") && <option value="version_desc">{tt("Newest version", "Version mas nueva")}</option>}
                  {(mode === "budget" || mode === "history") && <option value="version_asc">{tt("Oldest version", "Version mas antigua")}</option>}
                  {(mode === "budget" || mode === "history") && <option value="status_asc">{tt("Status A-Z", "Estado A-Z")}</option>}
                </select>
              </label>
              {mode === "structure" && (
                <label className="fb-check">
                  <input
                    type="checkbox"
                    checked={filters.includeInactive}
                    onChange={(event) => setFilters((current) => ({ ...current, includeInactive: event.target.checked }))}
                  />
                  {tt("Include inactive cost codes", "Incluir codigos inactivos")}
                </label>
              )}
              {mode === "snapshot" && (
                <label className="fb-check">
                  <input
                    type="checkbox"
                    checked={filters.includeNotes}
                    onChange={(event) => setFilters((current) => ({ ...current, includeNotes: event.target.checked }))}
                  />
                  {tt("Include notes column", "Incluir columna de notas")}
                </label>
              )}
              {mode !== "structure" && (
                <label className="fb-check">
                  <input
                    type="checkbox"
                    checked={filters.includeTotals}
                    onChange={(event) => setFilters((current) => ({ ...current, includeTotals: event.target.checked }))}
                  />
                  {tt("Include financial totals", "Incluir totales financieros")}
                </label>
              )}
            </div>
            <div className="fb-filter-summary">
              <span>{tt("Visible rows", "Filas visibles")}: {visibleCount}</span>
              {(mode === "budget" || mode === "history") && (
                <span>{tt("Status", "Estado")}: {filters.status === "all" ? tt("All", "Todos") : statusLabel(filters.status)}</span>
              )}
              <span>{tt("Sort", "Orden")}: {sortLabel(filters.sort, tt)}</span>
              {filters.search.trim() && <span>{tt("Search", "Busqueda")}: {filters.search.trim()}</span>}
            </div>
            {exportError && <div className="fb-export-error" role="alert">{exportError}</div>}
          </section>
          {mode !== "structure" && filters.includeTotals && (
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
          {mode === "structure" && <CostStructure data={data} tt={tt} nodes={visibleNodes} />}{" "}
          {mode === "budget" && (
            <Budget
              data={data}
              budgets={visibleBudgets}
              tt={tt}
              projectId={projectId}
              token={token ?? ""}
              reload={load}
            />
          )}{" "}
          {mode === "history" && (
            <History data={data} tt={tt} projectId={projectId} budgets={visibleBudgets} />
          )}{" "}
          {mode === "snapshot" && (
            <Snapshot data={data} tt={tt} projectId={projectId} token={token ?? ""} lines={visibleSnapshotLines} includeNotes={filters.includeNotes} />
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
  nodes,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  nodes: any[];
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
          {!nodes.length ? (
            <Empty>
              {tt(
                "No cost structure rows match the current view.",
                "Ninguna fila de estructura coincide con la vista actual.",
              )}
            </Empty>
          ) : (
          <div className="fb-table" role="table">
            <div className="fb-row fb-head" role="row">
              <span>{tt("Hierarchy / Code", "Jerarquía / Código")}</span>
              <span>{tt("Name", "Nombre")}</span>
              <span>{tt("Mapping provenance", "Procedencia del mapeo")}</span>
            </div>
            {nodes.map((n: any) => (
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
          )}
        </>
      )}
    </section>
  );
}
function Budget({
  data,
  budgets,
  tt,
  projectId,
  token,
  reload,
}: {
  data: Workspace;
  budgets: any[];
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
      {!budgets.length ? (
        <Empty>
          {tt(
            data.budgets.length
              ? "No budget versions match the current view."
              : "No budget draft exists. Authorized Cost Preparers can create or import one.",
            data.budgets.length
              ? "Ninguna version coincide con la vista actual."
              : "No existe un borrador. Los Preparadores autorizados pueden crear o importar uno.",
          )}
        </Empty>
      ) : (
        <div className="fb-cards">
          {budgets.map((b: any) => (
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
  budgets,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  projectId: number;
  budgets: any[];
}) {
  return (
    <section className="fb-panel">
      <h2>
        {tt("Budget version history", "Historial de versiones del presupuesto")}
      </h2>
      {!budgets.length ? (
        <Empty>
          {tt(
            data.budgets.length ? "No versions match the current view." : "No versions have been recorded.",
            data.budgets.length ? "Ninguna version coincide con la vista actual." : "No se han registrado versiones.",
          )}
        </Empty>
      ) : (
        <div className="fb-table">
          <div className="fb-row fb-head">
            <span>{tt("Version", "Versión")}</span>
            <span>{tt("Status / Purpose", "Estado / Motivo")}</span>
            <span>{tt("Exact total", "Total exacto")}</span>
          </div>
          {budgets.map((b: any) => (
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
  lines,
  includeNotes,
}: {
  data: Workspace;
  tt: (a: string, b: string) => string;
  projectId: number;
  token: string;
  lines: any[];
  includeNotes: boolean;
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
          <div className="fb-export-panel" aria-label={tt("Approved snapshot exports", "Exportaciones de instantánea aprobada")}>
            <div>
              <strong>{tt("Generate approved snapshot outputs", "Generar salidas de instantánea aprobada")}</strong>
              <p>
                {tt(
                  "Choose the formal PDF report for sharing and record retention, or the XLSX workbook for reconciliation and analysis.",
                  "Elija el reporte PDF formal para compartir y conservar el registro, o el libro XLSX para conciliación y análisis.",
                )}
              </p>
            </div>
            <div className="fb-actions">
              <ExportButton
                projectId={projectId}
                snapshotId={s.id}
                format="pdf"
                token={token}
                title={tt("Generate PDF Report", "Generar reporte PDF")}
                description={tt(
                  "Formal approved budget baseline report. Uses this immutable snapshot.",
                  "Reporte formal de línea base presupuestaria aprobada. Usa esta instantánea inmutable.",
                )}
                deniedLabel={tt("PDF export denied.", "Exportación PDF denegada.")}
              />
              <ExportButton
                projectId={projectId}
                snapshotId={s.id}
                format="xlsx"
                token={token}
                title={tt("Download XLSX Workbook", "Descargar libro XLSX")}
                description={tt(
                  "Spreadsheet workbook for analysis and reconciliation. Uses this same approved snapshot.",
                  "Libro de cálculo para análisis y conciliación. Usa esta misma instantánea aprobada.",
                )}
                deniedLabel={tt("XLSX export denied.", "Exportación XLSX denegada.")}
              />
            </div>
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
      {!lines.length ? (
        <Empty>
          {tt(
            "No snapshot lines match the current view.",
            "Ninguna linea de instantanea coincide con la vista actual.",
          )}
        </Empty>
      ) : (
      <div className="fb-table">
        <div className={`fb-row fb-head ${includeNotes ? "fb-row-four" : ""}`}>
          <span>{tt("Hierarchy / Cost code", "Jerarquía / Código")}</span>
          <span>{tt("Description", "Descripción")}</span>
          <span>{tt("Approved amount", "Monto aprobado")}</span>
          {includeNotes && <span>{tt("Notes", "Notas")}</span>}
        </div>
        {lines.map((l: any) => (
          <div className={`fb-row ${includeNotes ? "fb-row-four" : ""}`} key={l.stable_line_id}>
            <span>
              <b>{l.hierarchical_path}</b>
              <br />
              {l.project_name}
            </span>
            <span>{l.description}</span>
            <span>
              {String(l.amount)} {s.currency}
            </span>
            {includeNotes && <span>{l.notes || "-"}</span>}
          </div>
        ))}
      </div>
      )}
      <div className="fb-fingerprints">
        <code>{s.contentFingerprint}</code>
        <code>{s.snapshotFingerprint}</code>
      </div>
    </section>
  );
}
function ExportButton({
  projectId,
  snapshotId,
  format,
  token,
  title,
  description,
  deniedLabel,
}: {
  projectId: number;
  snapshotId: string;
  format: "pdf" | "xlsx";
  token: string;
  title: string;
  description: string;
  deniedLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/snapshots/${snapshotId}/export.${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(deniedLabel);
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url;
      link.download = fileNameFromDisposition(response.headers.get("Content-Disposition"), `approved-budget-baseline.${format}`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : deniedLabel);
    } finally { setBusy(false); }
  };
  return (
    <div className="fb-export-option">
      <button
        onClick={download}
        disabled={busy}
        title={description}
        aria-describedby={`budget-export-${format}-help`}
      >
        {busy ? `${title}...` : title}
      </button>
      <small id={`budget-export-${format}-help`}>{description}</small>
      {error && <small className="fb-export-error" role="alert">{error}</small>}
    </div>
  );
}
const styles = `.fb-page{min-height:100vh;background:#f5f7fa;color:#15202b;padding:24px;overflow-x:hidden}.fb-page>*{max-width:1180px;margin-left:auto;margin-right:auto}.fb-header{display:flex;justify-content:space-between;gap:20px;align-items:end}.fb-header h1{font-size:28px;margin:8px 0}.fb-header p,.fb-panel p{color:#5b6572}.fb-back{font-size:13px}.fb-authority{max-width:330px;padding:10px 12px;background:#e8f2ff;border-radius:8px;font-size:12px}.fb-nav{display:flex;gap:8px;margin-top:20px;overflow-x:auto;padding-bottom:8px}.fb-nav a,.fb-actions a,.fb-actions button,.fb-state button,.fb-preview button{white-space:nowrap;border:1px solid #ccd5df;border-radius:7px;padding:8px 12px;background:white;color:#174b7a;text-decoration:none;cursor:pointer}.fb-boundary{margin:16px 0;padding:12px;border-left:4px solid #d58b16;background:#fff9ec}.fb-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.fb-card,.fb-panel{background:white;border:1px solid #dfe5eb;border-radius:10px;padding:18px}.fb-card span{display:block;color:#66717e;font-size:12px}.fb-card strong{display:block;font-size:20px;margin-top:7px;font-variant-numeric:tabular-nums}.fb-panel{margin-top:14px}.fb-panel h2{margin:0 0 8px}.fb-panel-title{display:flex;justify-content:space-between;gap:16px;align-items:start}.fb-meta,.fb-actions{display:flex;gap:10px;flex-wrap:wrap}.fb-meta{font-size:12px;color:#596574;margin:12px 0}.fb-export-panel{display:grid;gap:12px;min-width:320px;max-width:430px;padding:12px;border:1px solid #ccdff1;border-radius:10px;background:#f8fbff}.fb-export-panel strong{display:block;color:#123f68;font-size:13px}.fb-export-panel p{margin:4px 0 0;font-size:12px;line-height:1.45}.fb-export-option{display:grid;gap:5px;max-width:210px}.fb-export-option small{font-size:11px;line-height:1.35;color:#596574;white-space:normal}.fb-export-error{color:#a22626}.fb-table{overflow-x:auto;border:1px solid #e4e9ef;border-radius:8px}.fb-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(220px,2fr) minmax(180px,1fr);gap:12px;padding:10px;border-bottom:1px solid #edf0f3;min-width:650px}.fb-head{font-size:11px;text-transform:uppercase;background:#f3f6f9;font-weight:700}.fb-empty,.fb-state{padding:36px;text-align:center;color:#66717e}.fb-error{color:#a22626}.fb-cards{display:grid;gap:10px}.fb-budget{border:1px solid #e2e7ed;border-radius:8px;padding:14px}.fb-budget>div:first-child{display:flex;justify-content:space-between}.fb-budget small,.fb-fingerprints code{display:block;overflow-wrap:anywhere;color:#697585}.fb-status{padding:3px 7px;border-radius:99px;background:#eef3f8;font-size:11px}.fb-message{padding:10px;background:#eef8ef;margin:10px 0}.fb-fingerprints{margin-top:14px}.fb-import{border:1px solid #dce4ec;border-radius:8px;padding:14px;margin:14px 0}.fb-import h3{margin:0}.fb-import-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fb-import-fields label{display:grid;gap:4px;font-size:12px;color:#596574}.fb-import-fields input{min-width:0;border:1px solid #ccd5df;border-radius:6px;padding:8px;background:white}.fb-preview{display:grid;gap:7px;margin-top:12px;padding:12px;background:#f4f8fc;border-radius:7px}.fb-preview code,.fb-preview small{overflow-wrap:anywhere}.fb-preview button{justify-self:start}@media(max-width:720px){.fb-page{padding:12px}.fb-header{display:block}.fb-authority{display:block;margin-top:10px}.fb-summary,.fb-import-fields{grid-template-columns:1fr}.fb-panel-title{display:block}.fb-export-panel{min-width:0;max-width:none;margin-top:12px}.fb-export-option{max-width:none}.fb-row{min-width:0;grid-template-columns:1fr;gap:4px}.fb-head{display:none}.fb-table{overflow:visible}.fb-row span{overflow-wrap:anywhere}.fb-row span:last-child{font-variant-numeric:tabular-nums}.fb-actions{margin-top:10px}}`;
const exportStyles = `.fb-current-view{background:white;border:1px solid #dfe5eb;border-radius:10px;padding:14px;margin:14px 0}.fb-current-view-head{display:flex;justify-content:space-between;gap:14px;align-items:start}.fb-current-view-head p{margin:4px 0 0;color:#5b6572;font-size:12px;line-height:1.45}.fb-current-view button{border:1px solid #174b7a;border-radius:7px;padding:9px 13px;background:#174b7a;color:white;font-weight:700;cursor:pointer}.fb-current-view button:disabled{background:#eef3f8;border-color:#ccd5df;color:#66717e;cursor:not-allowed}.fb-export-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:12px}.fb-export-toolbar label{display:grid;gap:4px;min-width:0;font-size:12px;color:#596574}.fb-export-toolbar input,.fb-export-toolbar select{width:100%;min-width:0;border:1px solid #ccd5df;border-radius:7px;padding:8px;background:white;color:#15202b}.fb-check{align-content:end;grid-template-columns:auto 1fr!important;align-items:center;color:#15202b!important}.fb-check input{width:auto}.fb-filter-summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.fb-filter-summary span{border:1px solid #dfe5eb;border-radius:999px;padding:4px 8px;background:#f8fafc;font-size:12px;color:#344256}.fb-current-view .fb-export-error{margin-top:10px;border:1px solid #f3c5c5;background:#fff5f5;border-radius:7px;padding:8px;color:#9f1d1d}.fb-row-four{grid-template-columns:minmax(150px,1fr) minmax(190px,1.4fr) minmax(140px,.8fr) minmax(160px,1fr)}@media(max-width:720px){.fb-current-view-head{display:block}.fb-current-view button{width:100%;margin-top:10px;white-space:normal}.fb-export-toolbar{grid-template-columns:1fr}.fb-filter-summary span{max-width:100%;overflow-wrap:anywhere}.fb-row-four{grid-template-columns:1fr}}`;
