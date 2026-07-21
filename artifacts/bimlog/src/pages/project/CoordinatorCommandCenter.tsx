import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Focus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

type SourceModule = "lens" | "rfi" | "submittal" | "meeting" | "schedule";
type DeadlineState = "overdue" | "due_this_week" | "upcoming" | "no_due_date";

type RelatedIdentity = { id: number; internalLink: string };
type LensIdentity = {
  serverId: number;
  displayId: string | null;
  viewpointId: string;
  navisworksGuid?: string | null;
  bimlogPhysicalId?: string | null;
  lifecycleStatus: string;
  revisionNumber: number;
  supersedesId?: number | null;
  issueGroupId?: string | null;
};

type ActionItem = {
  key: string;
  sourceModule: SourceModule;
  sourceId: number;
  projectId: number;
  displayIdentifier: string;
  originalStatus: string;
  presentationStatus: string;
  title: string;
  responsibility: {
    company: string | null;
    person: string | null;
    userId: number | null;
  };
  dueAt: string | null;
  deadlineState: DeadlineState;
  floor: string | null;
  discipline: string | null;
  priority: string | null;
  sourceUpdatedAt: string | null;
  internalLink: string;
  related: {
    meetings: RelatedIdentity[];
    schedule: RelatedIdentity[];
    lens: LensIdentity | null;
  };
};

type SourceState = {
  module: SourceModule;
  status: "ok" | "failed" | "unauthorized" | "not_requested";
  count: number | null;
  code?: string;
};
type RegisterResponse = {
  items: ActionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: {
    complete: boolean;
    byModule: Record<SourceModule, number | null>;
    byPresentationStatus: Record<string, number>;
  };
  sources: SourceState[];
  partial: boolean;
  timezone: string;
  generatedAt: string;
  readOnly: true;
  canonicalModulesRemainAuthoritative: true;
  aiUsed: false;
};

const SOURCE_ORDER: SourceModule[] = [
  "lens",
  "rfi",
  "submittal",
  "meeting",
  "schedule",
];

function humanStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(value: string, lang: "en" | "es") {
  const labels: Record<string, [string, string]> = {
    open: ["Open", "Abierto"],
    follow_up: ["Follow Up", "Seguimiento"],
    waiting_design: ["Waiting Design", "Esperando Diseño"],
    pending: ["Pending", "Pendiente"],
    submitted: ["Submitted", "Enviado"],
    under_review: ["Under Review", "En Revisión"],
    in_review: ["In Review", "En Revisión"],
    in_progress: ["In Progress", "En Progreso"],
    action_required: ["Action Required", "Acción Requerida"],
    revise_resubmit: ["Revise and Resubmit", "Revisar y Reenviar"],
    rejected: ["Rejected", "Rechazado"],
    blocked: ["Blocked", "Bloqueado"],
    delayed: ["Delayed", "Atrasado"],
    scheduled: ["Scheduled", "Programado"],
  };
  return labels[value]?.[lang === "es" ? 1 : 0] ?? humanStatus(value);
}

function sourceLabel(module: SourceModule, lang: "en" | "es") {
  const labels: Record<SourceModule, [string, string]> = {
    lens: ["Lens Viewpoint", "Vista Lens"],
    rfi: ["RFI", "RFI"],
    submittal: ["Submittal", "Submittal"],
    meeting: ["Meeting Action", "Acción de Reunión"],
    schedule: ["Schedule Task", "Tarea del Cronograma"],
  };
  return labels[module][lang === "es" ? 1 : 0];
}

function statusClass(status: string) {
  if (["open", "action_required"].includes(status))
    return "ccc-status ccc-status-danger";
  if (["follow_up", "pending", "submitted"].includes(status))
    return "ccc-status ccc-status-warning";
  if (["waiting_design", "in_review"].includes(status))
    return "ccc-status ccc-status-review";
  return "ccc-status ccc-status-neutral";
}

export function CoordinatorCommandCenter({ projectId }: { projectId: number }) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const tr = (en: string, es: string) => (lang === "es" ? es : en);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const [modules, setModules] = useState<SourceModule[]>(SOURCE_ORDER);
  const [status, setStatus] = useState("all");
  const [deadline, setDeadline] = useState<"all" | DeadlineState>("all");
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [person, setPerson] = useState("");
  const [floor, setFloor] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RegisterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      modules: modules.join(","),
      timezone,
    });
    if (status !== "all") params.set("statuses", status);
    if (deadline !== "all") params.set("deadline", deadline);
    if (search.trim()) params.set("search", search.trim());
    if (company.trim()) params.set("responsibleCompany", company.trim());
    if (person.trim()) params.set("responsiblePerson", person.trim());
    if (floor.trim()) params.set("floor", floor.trim());
    if (discipline.trim()) params.set("discipline", discipline.trim());
    return params.toString();
  }, [
    page,
    modules,
    status,
    deadline,
    search,
    company,
    person,
    floor,
    discipline,
    timezone,
  ]);

  useEffect(() => {
    if (!token || modules.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/v1/projects/${projectId}/coordinator-actions?${queryString}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.message ||
              tr(
                "The command center could not be loaded.",
                "No se pudo cargar el centro de control.",
              ),
          );
        setData(body as RegisterResponse);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : tr(
                  "The command center could not be loaded.",
                  "No se pudo cargar el centro de control.",
                ),
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [projectId, token, queryString, retryKey]);

  const toggleModule = (module: SourceModule) => {
    setPage(1);
    setModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : SOURCE_ORDER.filter((item) => [...current, module].includes(item)),
    );
  };

  const formatDate = (value: string | null) => {
    if (!value) return tr("No deadline", "Sin fecha límite");
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
      timeZone: dateOnly ? "UTC" : timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateOnly ? `${value}T12:00:00.000Z` : value));
  };

  const deadlineLabel = (state: DeadlineState) =>
    ({
      overdue: tr("Overdue", "Vencido"),
      due_this_week: tr("Due this week", "Vence esta semana"),
      upcoming: tr("Upcoming", "Próximo"),
      no_due_date: tr("No deadline", "Sin fecha límite"),
    })[state];

  const partialSources =
    data?.sources.filter(
      (source) => modules.includes(source.module) && source.status !== "ok",
    ) ?? [];
  const overdueCount = data?.counts.byPresentationStatus
    ? data.items.filter((item) => item.deadlineState === "overdue").length
    : 0;
  const dueWeekCount =
    data?.items.filter((item) => item.deadlineState === "due_this_week")
      .length ?? 0;

  return (
    <section className="ccc-shell" aria-labelledby="ccc-title">
      <header className="ccc-hero">
        <div className="ccc-hero-copy">
          <div className="ccc-eyebrow">
            <Focus size={14} />{" "}
            {tr(
              "Lens-first project operations",
              "Operaciones del proyecto con Lens primero",
            )}
          </div>
          <h1 id="ccc-title">
            {tr(
              "Coordinator Command Center",
              "Centro de Control de Coordinación",
            )}
          </h1>
          <p>
            {tr(
              "One read-only action register for current Lens Viewpoints, RFIs, Submittals, Meeting actions, and Schedule tasks.",
              "Un registro de acciones de solo lectura para Vistas Lens, RFIs, Submittals, acciones de Reunión y tareas del Cronograma vigentes.",
            )}
          </p>
        </div>
        <div className="ccc-trust-card">
          <CheckCircle2 size={17} />
          <div>
            <strong>
              {tr(
                "Original modules remain authoritative",
                "Los módulos originales mantienen la autoridad",
              )}
            </strong>
            <span>
              {tr(
                "Read-only · deterministic · no AI use or charges",
                "Solo lectura · determinístico · sin uso ni cargos de IA",
              )}
            </span>
          </div>
        </div>
      </header>

      <div
        className="ccc-kpis"
        aria-label={tr(
          "Action register summary",
          "Resumen del registro de acciones",
        )}
      >
        <div>
          <span>{tr("Filtered actions", "Acciones filtradas")}</span>
          <strong>{data?.total ?? "—"}</strong>
        </div>
        <div className="ccc-kpi-danger">
          <span>{tr("Overdue on this page", "Vencidas en esta página")}</span>
          <strong>{overdueCount}</strong>
        </div>
        <div className="ccc-kpi-warning">
          <span>
            {tr(
              "Due this week on this page",
              "Vencen esta semana en esta página",
            )}
          </span>
          <strong>{dueWeekCount}</strong>
        </div>
        <div>
          <span>{tr("Sources reporting", "Fuentes disponibles")}</span>
          <strong>
            {data
              ? data.sources.filter((source) => source.status === "ok").length
              : "—"}
            /{modules.length}
          </strong>
        </div>
      </div>

      <div className="ccc-filter-panel">
        <div className="ccc-filter-heading">
          <Filter size={15} />
          <strong>{tr("Filter the register", "Filtrar el registro")}</strong>
        </div>
        <div
          className="ccc-module-filters"
          role="group"
          aria-label={tr("Source modules", "Módulos de origen")}
        >
          {SOURCE_ORDER.map((module) => (
            <button
              key={module}
              type="button"
              className={modules.includes(module) ? "active" : ""}
              onClick={() => toggleModule(module)}
            >
              {sourceLabel(module, lang)}
              {data?.counts.byModule[module] != null && (
                <span>{data.counts.byModule[module]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ccc-filter-grid">
          <label className="ccc-search">
            <span>{tr("Search", "Buscar")}</span>
            <div>
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder={tr(
                  "ID, title, responsible, floor…",
                  "ID, título, responsable, piso…",
                )}
              />
            </div>
          </label>
          <label>
            <span>{tr("Status", "Estado")}</span>
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="all">
                {tr("All actionable statuses", "Todos los estados accionables")}
              </option>
              {(
                [
                  "open",
                  "follow_up",
                  "waiting_design",
                  "pending",
                  "submitted",
                  "in_review",
                  "action_required",
                  "scheduled",
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{tr("Deadline", "Fecha límite")}</span>
            <select
              value={deadline}
              onChange={(event) => {
                setPage(1);
                setDeadline(event.target.value as typeof deadline);
              }}
            >
              <option value="all">
                {tr("All deadlines", "Todas las fechas")}
              </option>
              <option value="overdue">{tr("Overdue", "Vencido")}</option>
              <option value="due_this_week">
                {tr("Due this week", "Vence esta semana")}
              </option>
              <option value="upcoming">{tr("Upcoming", "Próximo")}</option>
              <option value="no_due_date">
                {tr("No deadline", "Sin fecha límite")}
              </option>
            </select>
          </label>
          <label>
            <span>{tr("Responsible company", "Empresa responsable")}</span>
            <input
              value={company}
              onChange={(event) => {
                setPage(1);
                setCompany(event.target.value);
              }}
            />
          </label>
          <label>
            <span>{tr("Responsible person", "Persona responsable")}</span>
            <input
              value={person}
              onChange={(event) => {
                setPage(1);
                setPerson(event.target.value);
              }}
            />
          </label>
          <label>
            <span>{tr("Floor / area", "Piso / área")}</span>
            <input
              value={floor}
              onChange={(event) => {
                setPage(1);
                setFloor(event.target.value);
              }}
            />
          </label>
          <label>
            <span>{tr("Discipline / trade", "Disciplina / especialidad")}</span>
            <input
              value={discipline}
              onChange={(event) => {
                setPage(1);
                setDiscipline(event.target.value);
              }}
            />
          </label>
        </div>
      </div>

      {partialSources.length > 0 && (
        <div className="ccc-alert ccc-alert-warning" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {tr(
                "Some authoritative sources are unavailable",
                "Algunas fuentes autorizadas no están disponibles",
              )}
            </strong>
            <span>
              {partialSources
                .map((source) => sourceLabel(source.module, lang))
                .join(", ")}
              .{" "}
              {tr(
                "Counts are partial; no missing source is treated as zero.",
                "Los conteos son parciales; ninguna fuente ausente se trata como cero.",
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            <RefreshCw size={13} /> {tr("Retry", "Reintentar")}
          </button>
        </div>
      )}

      {error && (
        <div className="ccc-alert ccc-alert-error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {tr(
                "Command center unavailable",
                "Centro de control no disponible",
              )}
            </strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            <RefreshCw size={13} /> {tr("Retry", "Reintentar")}
          </button>
        </div>
      )}

      {loading && (
        <div className="ccc-loading" aria-live="polite">
          <RefreshCw className="ccc-spin" size={20} />
          <span>
            {tr(
              "Loading authorized project actions…",
              "Cargando acciones autorizadas del proyecto…",
            )}
          </span>
        </div>
      )}

      {!loading && !error && modules.length === 0 && (
        <div className="ccc-empty">
          <Filter size={28} />
          <strong>
            {tr("Choose at least one source", "Seleccione al menos una fuente")}
          </strong>
          <span>
            {tr(
              "No source is selected, so the register is intentionally empty.",
              "No hay una fuente seleccionada, por eso el registro está vacío intencionalmente.",
            )}
          </span>
        </div>
      )}

      {!loading && !error && modules.length > 0 && data?.items.length === 0 && (
        <div className="ccc-empty">
          <CheckCircle2 size={30} />
          <strong>
            {tr(
              "No actions match these filters",
              "Ninguna acción coincide con estos filtros",
            )}
          </strong>
          <span>
            {tr(
              "This is an honest filtered result. The register does not fall back to all records.",
              "Este es un resultado filtrado real. El registro no vuelve a mostrar todos los registros.",
            )}
          </span>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="ccc-table-wrap">
            <table className="ccc-table">
              <thead>
                <tr>
                  <th>{tr("Source", "Fuente")}</th>
                  <th>{tr("Action", "Acción")}</th>
                  <th>{tr("Status", "Estado")}</th>
                  <th>{tr("Responsible", "Responsable")}</th>
                  <th>{tr("Floor / discipline", "Piso / disciplina")}</th>
                  <th>{tr("Deadline", "Fecha límite")}</th>
                  <th>{tr("Priority", "Prioridad")}</th>
                  <th>
                    <span className="sr-only">
                      {tr("Open original", "Abrir original")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <ActionRow
                    key={item.key}
                    item={item}
                    lang={lang}
                    tr={tr}
                    formatDate={formatDate}
                    deadlineLabel={deadlineLabel}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="ccc-mobile-list">
            {data.items.map((item) => (
              <ActionCard
                key={item.key}
                item={item}
                lang={lang}
                tr={tr}
                formatDate={formatDate}
                deadlineLabel={deadlineLabel}
              />
            ))}
          </div>
          <footer className="ccc-pagination">
            <span>
              {tr("Page", "Página")} {data.page} {tr("of", "de")}{" "}
              {Math.max(1, data.totalPages)} · {data.total}{" "}
              {tr("actions", "acciones")}
            </span>
            <div>
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft size={15} /> {tr("Previous", "Anterior")}
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                {tr("Next", "Siguiente")} <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

type SharedItemProps = {
  item: ActionItem;
  lang: "en" | "es";
  tr: (en: string, es: string) => string;
  formatDate: (value: string | null) => string;
  deadlineLabel: (value: DeadlineState) => string;
};

function ItemIdentity({ item, tr }: Pick<SharedItemProps, "item" | "tr">) {
  const lens = item.related.lens;
  return (
    <div className="ccc-identity">
      <strong>{item.displayIdentifier}</strong>
      {lens && (
        <span>
          {tr("Server", "Servidor")} #{lens.serverId} · Rev{" "}
          {lens.revisionNumber}
          {(lens.navisworksGuid || lens.bimlogPhysicalId) && (
            <>
              {" "}
              · {tr("Physical", "Física")}{" "}
              {lens.navisworksGuid || lens.bimlogPhysicalId}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function RelatedBadges({ item, tr }: Pick<SharedItemProps, "item" | "tr">) {
  return (
    <div className="ccc-related">
      {item.related.meetings.length > 0 && (
        <span>
          {item.related.meetings.length} {tr("meeting", "reunión")}
        </span>
      )}
      {item.related.schedule.length > 0 && (
        <span>
          {item.related.schedule.length} {tr("schedule", "cronograma")}
        </span>
      )}
      {item.related.lens && item.sourceModule !== "lens" && (
        <span>{tr("Lens linked", "Lens vinculada")}</span>
      )}
    </div>
  );
}

function ActionRow({
  item,
  lang,
  tr,
  formatDate,
  deadlineLabel,
}: SharedItemProps) {
  return (
    <tr>
      <td>
        <span className={`ccc-source ccc-source-${item.sourceModule}`}>
          {sourceLabel(item.sourceModule, lang)}
        </span>
        <ItemIdentity item={item} tr={tr} />
      </td>
      <td>
        <strong className="ccc-title">{item.title}</strong>
        <RelatedBadges item={item} tr={tr} />
      </td>
      <td>
        <span className={statusClass(item.presentationStatus)}>
          {statusLabel(item.presentationStatus, lang)}
        </span>
        <small>
          {tr("Original", "Original")}: {statusLabel(item.originalStatus, lang)}
        </small>
      </td>
      <td>
        <strong>{item.responsibility.company || "—"}</strong>
        <span>{item.responsibility.person || "—"}</span>
      </td>
      <td>
        <strong>{item.floor || "—"}</strong>
        <span>{item.discipline || "—"}</span>
      </td>
      <td>
        <span className={`ccc-deadline ccc-deadline-${item.deadlineState}`}>
          <CalendarClock size={13} /> {deadlineLabel(item.deadlineState)}
        </span>
        <small>{formatDate(item.dueAt)}</small>
      </td>
      <td>{item.priority || "—"}</td>
      <td>
        <a className="ccc-open" href={item.internalLink}>
          <ExternalLink size={14} /> {tr("Open Original", "Abrir Original")}
        </a>
      </td>
    </tr>
  );
}

function ActionCard({
  item,
  lang,
  tr,
  formatDate,
  deadlineLabel,
}: SharedItemProps) {
  return (
    <article className="ccc-card">
      <div className="ccc-card-top">
        <span className={`ccc-source ccc-source-${item.sourceModule}`}>
          {sourceLabel(item.sourceModule, lang)}
        </span>
        <span className={statusClass(item.presentationStatus)}>
          {statusLabel(item.presentationStatus, lang)}
        </span>
      </div>
      <ItemIdentity item={item} tr={tr} />
      <h2>{item.title}</h2>
      <div className="ccc-card-grid">
        <div>
          <span>{tr("Responsible", "Responsable")}</span>
          <strong>
            {item.responsibility.company || item.responsibility.person || "—"}
          </strong>
          {item.responsibility.company && item.responsibility.person && (
            <small>{item.responsibility.person}</small>
          )}
        </div>
        <div>
          <span>{tr("Floor / discipline", "Piso / disciplina")}</span>
          <strong>{item.floor || "—"}</strong>
          <small>{item.discipline || "—"}</small>
        </div>
      </div>
      <div className="ccc-card-deadline">
        <span className={`ccc-deadline ccc-deadline-${item.deadlineState}`}>
          <CalendarClock size={13} /> {deadlineLabel(item.deadlineState)}
        </span>
        <small>
          {formatDate(item.dueAt)} · {tr("Original", "Original")}:{" "}
          {statusLabel(item.originalStatus, lang)}
        </small>
      </div>
      <RelatedBadges item={item} tr={tr} />
      <a className="ccc-open" href={item.internalLink}>
        <ExternalLink size={14} /> {tr("Open Original", "Abrir Original")}
      </a>
    </article>
  );
}
