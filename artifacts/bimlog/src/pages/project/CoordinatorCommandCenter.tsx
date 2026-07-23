import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Focus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { CoordinatorBulkActions } from "./CoordinatorBulkActions";

type SourceModule = "lens" | "rfi" | "submittal" | "meeting" | "schedule";
type DeadlineState = "overdue" | "due_this_week" | "upcoming" | "no_due_date";
type BuiltInView = "my_items" | "this_week" | "overdue" | "next_coordination_meeting" | "all_actionable";

type SavedViewConfig = {
  schemaVersion: 1;
  builtInView: BuiltInView;
  modules: SourceModule[];
  lensStatuses: string[];
  originalStatuses: string[];
  presentationStatuses: string[];
  deadline: "all" | DeadlineState;
  dueFrom: string | null;
  dueTo: string | null;
  overdue: boolean;
  meetingId: number | null;
  search: string | null;
  responsibleCompany: string | null;
  responsiblePerson: string | null;
  floor: string | null;
  discipline: string | null;
  timezone: string;
};

type SavedView = {
  id: string;
  projectId: number;
  name: string;
  configuration: SavedViewConfig;
  version: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};

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

export type ActionItem = {
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
  builtInView: BuiltInView;
  meetingContext: { status: "not_requested" | "ok" | "none" | "failed"; id: number | null; title: string | null; meetingAt: string | null };
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

const BUILT_IN_ORDER: BuiltInView[] = ["my_items", "this_week", "overdue", "next_coordination_meeting", "all_actionable"];

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
  const [builtInView, setBuiltInView] = useState<BuiltInView>("all_actionable");
  const [lensStatus, setLensStatus] = useState("all");
  const [originalStatus, setOriginalStatus] = useState("all");
  const [presentationStatus, setPresentationStatus] = useState("all");
  const [deadline, setDeadline] = useState<"all" | DeadlineState>("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [meetingId, setMeetingId] = useState("");
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
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewError, setSavedViewError] = useState("");
  const [activeSavedViewId, setActiveSavedViewId] = useState("");
  const [savedViewBusy, setSavedViewBusy] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, ActionItem>>({});
  const [selectionError, setSelectionError] = useState("");
  const urlInitialized = useRef(false);
  const defaultApplied = useRef(false);

  const builtInLabel = (view: BuiltInView) => ({
    my_items: tr("My Items", "Mis Elementos"),
    this_week: tr("This Week", "Esta Semana"),
    overdue: tr("Overdue", "Vencidos"),
    next_coordination_meeting: tr("Next Coordination Meeting", "Próxima Reunión de Coordinación"),
    all_actionable: tr("All Actionable", "Todos los Accionables"),
  })[view];

  const applyConfiguration = (config: SavedViewConfig) => {
    setBuiltInView(config.builtInView);
    setModules(config.modules);
    setLensStatus(config.lensStatuses[0] ?? "all");
    setOriginalStatus(config.originalStatuses[0] ?? "all");
    setPresentationStatus(config.presentationStatuses[0] ?? "all");
    setDeadline(config.deadline);
    setDueFrom(config.dueFrom ?? "");
    setDueTo(config.dueTo ?? "");
    setOverdueOnly(config.overdue);
    setMeetingId(config.meetingId ? String(config.meetingId) : "");
    setSearch(config.search ?? "");
    setCompany(config.responsibleCompany ?? "");
    setPerson(config.responsiblePerson ?? "");
    setFloor(config.floor ?? "");
    setDiscipline(config.discipline ?? "");
    setPage(1);
  };

  const currentConfiguration = (): SavedViewConfig => ({
    schemaVersion: 1,
    builtInView,
    modules,
    lensStatuses: lensStatus === "all" ? [] : [lensStatus],
    originalStatuses: originalStatus === "all" ? [] : [originalStatus],
    presentationStatuses: presentationStatus === "all" ? [] : [presentationStatus],
    deadline,
    dueFrom: dueFrom || null,
    dueTo: dueTo || null,
    overdue: overdueOnly,
    meetingId: meetingId ? Number(meetingId) : null,
    search: search.trim() || null,
    responsibleCompany: company.trim() || null,
    responsiblePerson: person.trim() || null,
    floor: floor.trim() || null,
    discipline: discipline.trim() || null,
    timezone,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasState = [...params.keys()].some((key) => key.startsWith("cc"));
    if (hasState) {
      const selected = (params.get("ccModules") ?? "").split(",").filter((value): value is SourceModule => SOURCE_ORDER.includes(value as SourceModule));
      setModules(params.get("ccModules") === "none" ? [] : (selected.length ? SOURCE_ORDER.filter((module) => selected.includes(module)) : SOURCE_ORDER));
      const view = params.get("ccView") as BuiltInView | null;
      if (view && BUILT_IN_ORDER.includes(view)) setBuiltInView(view);
      setLensStatus(params.get("ccLensStatus") ?? "all");
      setOriginalStatus(params.get("ccOriginalStatus") ?? "all");
      setPresentationStatus(params.get("ccPresentationStatus") ?? "all");
      setDeadline((params.get("ccDeadline") as "all" | DeadlineState) ?? "all");
      setDueFrom(params.get("ccDueFrom") ?? "");
      setDueTo(params.get("ccDueTo") ?? "");
      setOverdueOnly(params.get("ccOverdue") === "true");
      setMeetingId(params.get("ccMeeting") ?? "");
      setSearch(params.get("ccSearch") ?? "");
      setCompany(params.get("ccCompany") ?? "");
      setPerson(params.get("ccPerson") ?? "");
      setFloor(params.get("ccFloor") ?? "");
      setDiscipline(params.get("ccDiscipline") ?? "");
    }
    urlInitialized.current = true;
  }, [projectId]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      modules: modules.length ? modules.join(",") : "none",
      timezone,
      builtInView,
    });
    if (lensStatus !== "all") params.set("lensStatuses", lensStatus);
    if (originalStatus !== "all") params.set("originalStatuses", originalStatus);
    if (presentationStatus !== "all") params.set("presentationStatuses", presentationStatus);
    if (deadline !== "all") params.set("deadline", deadline);
    if (dueFrom) params.set("dueFrom", dueFrom);
    if (dueTo) params.set("dueTo", dueTo);
    if (overdueOnly) params.set("overdue", "true");
    if (meetingId) params.set("meetingId", meetingId);
    if (search.trim()) params.set("search", search.trim());
    if (company.trim()) params.set("responsibleCompany", company.trim());
    if (person.trim()) params.set("responsiblePerson", person.trim());
    if (floor.trim()) params.set("floor", floor.trim());
    if (discipline.trim()) params.set("discipline", discipline.trim());
    return params.toString();
  }, [
    page,
    modules,
    builtInView,
    lensStatus,
    originalStatus,
    presentationStatus,
    deadline,
    dueFrom,
    dueTo,
    overdueOnly,
    meetingId,
    search,
    company,
    person,
    floor,
    discipline,
    timezone,
  ]);

  useEffect(() => {
    if (!urlInitialized.current) return;
    const params = new URLSearchParams(window.location.search);
    [...params.keys()].filter((key) => key.startsWith("cc")).forEach((key) => params.delete(key));
    params.set("ccView", builtInView);
    if (modules.length !== SOURCE_ORDER.length) params.set("ccModules", modules.length ? modules.join(",") : "none");
    if (lensStatus !== "all") params.set("ccLensStatus", lensStatus);
    if (originalStatus !== "all") params.set("ccOriginalStatus", originalStatus);
    if (presentationStatus !== "all") params.set("ccPresentationStatus", presentationStatus);
    if (deadline !== "all") params.set("ccDeadline", deadline);
    if (dueFrom) params.set("ccDueFrom", dueFrom);
    if (dueTo) params.set("ccDueTo", dueTo);
    if (overdueOnly) params.set("ccOverdue", "true");
    if (meetingId) params.set("ccMeeting", meetingId);
    if (search.trim()) params.set("ccSearch", search.trim());
    if (company.trim()) params.set("ccCompany", company.trim());
    if (person.trim()) params.set("ccPerson", person.trim());
    if (floor.trim()) params.set("ccFloor", floor.trim());
    if (discipline.trim()) params.set("ccDiscipline", discipline.trim());
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  }, [builtInView, modules, lensStatus, originalStatus, presentationStatus, deadline, dueFrom, dueTo, overdueOnly, meetingId, search, company, person, floor, discipline]);

  const loadSavedViews = async () => {
    if (!token) return;
    setSavedViewsLoading(true);
    setSavedViewError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/coordinator-saved-views`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((lang === "es" ? body.messageEs : body.message) || tr("Saved views could not be loaded.", "No se pudieron cargar las vistas guardadas."));
      const views = (body.views ?? []) as SavedView[];
      setSavedViews(views);
      if (!defaultApplied.current && ![...new URLSearchParams(window.location.search).keys()].some((key) => key.startsWith("cc"))) {
        const personalDefault = views.find((view) => view.isDefault);
        if (personalDefault) { applyConfiguration(personalDefault.configuration); setActiveSavedViewId(personalDefault.id); }
      }
      defaultApplied.current = true;
    } catch (loadError) {
      setSavedViewError(loadError instanceof Error ? loadError.message : tr("Saved views could not be loaded.", "No se pudieron cargar las vistas guardadas."));
    } finally {
      setSavedViewsLoading(false);
    }
  };

  useEffect(() => { defaultApplied.current = false; void loadSavedViews(); }, [projectId, token, lang]);

  const savedViewRequest = async (path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    if (!token) return null;
    setSavedViewBusy(true);
    setSavedViewError("");
    try {
      const response = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((lang === "es" ? payload.messageEs : payload.message) || tr("The saved-view operation failed.", "La operación de la vista guardada falló."));
      await loadSavedViews();
      return payload.view as SavedView;
    } catch (saveError) {
      setSavedViewError(saveError instanceof Error ? saveError.message : tr("The saved-view operation failed.", "La operación de la vista guardada falló."));
      return null;
    } finally {
      setSavedViewBusy(false);
    }
  };

  const clearFilters = () => {
    setBuiltInView("all_actionable"); setModules(SOURCE_ORDER); setLensStatus("all"); setOriginalStatus("all"); setPresentationStatus("all");
    setDeadline("all"); setDueFrom(""); setDueTo(""); setOverdueOnly(false); setMeetingId(""); setSearch(""); setCompany(""); setPerson(""); setFloor(""); setDiscipline(""); setPage(1); setActiveSavedViewId("");
  };

  const activeFilterSummary = useMemo(() => {
    const values = [builtInLabel(builtInView)];
    if (modules.length !== SOURCE_ORDER.length) values.push(`${modules.length} ${tr("sources", "fuentes")}`);
    if (lensStatus !== "all") values.push(`Lens: ${statusLabel(lensStatus, lang)}`);
    if (originalStatus !== "all") values.push(`${tr("Original", "Original")}: ${statusLabel(originalStatus, lang)}`);
    if (presentationStatus !== "all") values.push(`${tr("Presentation", "Presentación")}: ${statusLabel(presentationStatus, lang)}`);
    if (deadline !== "all") values.push(deadline.replaceAll("_", " "));
    if (dueFrom || dueTo) values.push(`${dueFrom || "…"} – ${dueTo || "…"}`);
    if (meetingId) values.push(`${tr("Meeting", "Reunión")} #${meetingId}`);
    if (company || person || floor || discipline || search) values.push(tr("Operational details", "Detalles operativos"));
    return values;
  }, [builtInView, modules, lensStatus, originalStatus, presentationStatus, deadline, dueFrom, dueTo, meetingId, company, person, floor, discipline, search, lang]);

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

  const toggleSelection = (item: ActionItem) => {
    setSelectionError("");
    setSelectedItems((current) => {
      if (current[item.key]) {
        const next = { ...current };
        delete next[item.key];
        return next;
      }
      if (Object.keys(current).length >= 50) {
        setSelectionError(
          tr(
            "Select no more than 50 actions per controlled operation.",
            "Seleccione como máximo 50 acciones por operación controlada.",
          ),
        );
        return current;
      }
      return { ...current, [item.key]: item };
    });
  };

  useEffect(() => {
    setSelectedItems({});
    setSelectionError("");
  }, [projectId]);

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
        <div className="ccc-view-bar">
          <label>
            <span>{tr("Built-in view", "Vista integrada")}</span>
            <select value={builtInView} onChange={(event) => { setBuiltInView(event.target.value as BuiltInView); setPage(1); setActiveSavedViewId(""); }}>
              {BUILT_IN_ORDER.map((view) => <option key={view} value={view}>{builtInLabel(view)}</option>)}
            </select>
          </label>
          <label>
            <span><Bookmark size={12} /> {tr("Personal saved view", "Vista personal guardada")}</span>
            <select
              value={activeSavedViewId}
              disabled={savedViewsLoading}
              onChange={(event) => {
                const selected = savedViews.find((view) => view.id === event.target.value);
                setActiveSavedViewId(event.target.value);
                if (selected) applyConfiguration(selected.configuration);
              }}
            >
              <option value="">{savedViewsLoading ? tr("Loading…", "Cargando…") : tr("Current filters (unsaved)", "Filtros actuales (sin guardar)")}</option>
              {savedViews.map((view) => <option key={view.id} value={view.id}>{view.isDefault ? "★ " : ""}{view.name}</option>)}
            </select>
          </label>
          <div className="ccc-saved-actions">
            <button
              type="button"
              disabled={savedViewBusy}
              onClick={async () => {
                const name = window.prompt(tr("Name this personal view", "Nombre de esta vista personal"));
                if (!name) return;
                const view = await savedViewRequest(`/api/v1/projects/${projectId}/coordinator-saved-views`, "POST", { name, configuration: currentConfiguration(), isDefault: false, idempotencyKey: window.crypto.randomUUID() });
                if (view) setActiveSavedViewId(view.id);
              }}
            ><Save size={13} /> {tr("Save", "Guardar")}</button>
            <button
              type="button"
              disabled={!activeSavedViewId || savedViewBusy}
              title={tr("Update selected view", "Actualizar vista seleccionada")}
              onClick={async () => {
                const selected = savedViews.find((view) => view.id === activeSavedViewId);
                if (!selected) return;
                await savedViewRequest(`/api/v1/projects/${projectId}/coordinator-saved-views/${selected.id}`, "PATCH", { configuration: currentConfiguration(), expectedVersion: selected.version, idempotencyKey: window.crypto.randomUUID() });
              }}
            ><Save size={13} /><span className="sr-only">{tr("Update selected view", "Actualizar vista seleccionada")}</span></button>
            <button
              type="button"
              disabled={!activeSavedViewId || savedViewBusy}
              title={tr("Rename", "Renombrar")}
              onClick={async () => {
                const selected = savedViews.find((view) => view.id === activeSavedViewId);
                if (!selected) return;
                const name = window.prompt(tr("Rename personal view", "Renombrar vista personal"), selected.name);
                if (!name || name === selected.name) return;
                await savedViewRequest(`/api/v1/projects/${projectId}/coordinator-saved-views/${selected.id}`, "PATCH", { name, expectedVersion: selected.version, idempotencyKey: window.crypto.randomUUID() });
              }}
            ><Pencil size={13} /><span className="sr-only">{tr("Rename", "Renombrar")}</span></button>
            <button
              type="button"
              disabled={!activeSavedViewId || savedViewBusy}
              title={tr("Make my default", "Establecer como mi predeterminada")}
              onClick={async () => {
                const selected = savedViews.find((view) => view.id === activeSavedViewId);
                if (!selected || selected.isDefault) return;
                await savedViewRequest(`/api/v1/projects/${projectId}/coordinator-saved-views/${selected.id}`, "PATCH", { isDefault: true, expectedVersion: selected.version, idempotencyKey: window.crypto.randomUUID() });
              }}
            ><Star size={13} /><span className="sr-only">{tr("Make my default", "Establecer como mi predeterminada")}</span></button>
            <button
              type="button"
              disabled={!activeSavedViewId || savedViewBusy}
              title={tr("Delete", "Eliminar")}
              onClick={async () => {
                const selected = savedViews.find((view) => view.id === activeSavedViewId);
                if (!selected || !window.confirm(tr(`Delete “${selected.name}”?`, `¿Eliminar “${selected.name}”?`))) return;
                const deleted = await savedViewRequest(`/api/v1/projects/${projectId}/coordinator-saved-views/${selected.id}`, "DELETE", { expectedVersion: selected.version, idempotencyKey: window.crypto.randomUUID() });
                if (deleted) { setActiveSavedViewId(""); clearFilters(); }
              }}
            ><Trash2 size={13} /><span className="sr-only">{tr("Delete", "Eliminar")}</span></button>
          </div>
        </div>

        <div className="ccc-filter-heading">
          <Filter size={15} /> <strong>{tr("Operational filters", "Filtros operativos")}</strong>
          <div className="ccc-filter-reset">
            <button type="button" onClick={clearFilters}><RotateCcw size={12} /> {tr("Clear all", "Limpiar todo")}</button>
            <button
              type="button"
              disabled={!savedViews.some((view) => view.isDefault)}
              onClick={() => {
                const personalDefault = savedViews.find((view) => view.isDefault);
                if (personalDefault) { applyConfiguration(personalDefault.configuration); setActiveSavedViewId(personalDefault.id); }
              }}
            >{tr("Reset to my default", "Restablecer mi predeterminada")}</button>
          </div>
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
            <span>{tr("Lens lifecycle", "Ciclo de vida Lens")}</span>
            <select value="active" disabled><option value="active">{tr("Active / current only", "Solo activa / vigente")}</option></select>
          </label>
          <label>
            <span>{tr("Lens status", "Estado Lens")}</span>
            <select
              value={lensStatus}
              onChange={(event) => {
                setPage(1);
                setLensStatus(event.target.value);
              }}
            >
              <option value="all">{tr("All actionable Lens statuses", "Todos los estados accionables de Lens")}</option>
              {(["open", "follow_up", "waiting_design"] as const).map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{tr("Original source status", "Estado original de origen")}</span>
            <select value={originalStatus} onChange={(event) => { setPage(1); setOriginalStatus(event.target.value); }}>
              <option value="all">{tr("All original statuses", "Todos los estados originales")}</option>
              {(["open", "follow_up", "waiting_design", "pending", "submitted", "under_review", "in_review", "revise_resubmit", "rejected", "in_progress", "blocked", "delayed", "scheduled"] as const).map((value) => <option key={value} value={value}>{statusLabel(value, lang)}</option>)}
            </select>
          </label>
          <label>
            <span>{tr("Presentation status", "Estado de presentación")}</span>
            <select value={presentationStatus} onChange={(event) => { setPage(1); setPresentationStatus(event.target.value); }}>
              <option value="all">{tr("All presentation statuses", "Todos los estados de presentación")}</option>
              {(["open", "follow_up", "waiting_design", "pending", "submitted", "in_review", "action_required", "scheduled"] as const).map((value) => <option key={value} value={value}>{statusLabel(value, lang)}</option>)}
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
            <span>{tr("Due from", "Vence desde")}</span>
            <input type="date" value={dueFrom} onChange={(event) => { setPage(1); setDueFrom(event.target.value); }} />
          </label>
          <label>
            <span>{tr("Due through", "Vence hasta")}</span>
            <input type="date" value={dueTo} onChange={(event) => { setPage(1); setDueTo(event.target.value); }} />
          </label>
          <label>
            <span>{tr("Meeting context", "Contexto de reunión")}</span>
            <input type="number" min="1" inputMode="numeric" value={meetingId} onChange={(event) => { setPage(1); setMeetingId(event.target.value); }} placeholder={tr("Exact meeting ID", "ID exacto de reunión")} />
          </label>
          <label className="ccc-check-filter">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => { setPage(1); setOverdueOnly(event.target.checked); }} />
            <span>{tr("Overdue only", "Solo vencidos")}</span>
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
        <div className="ccc-active-summary" aria-label={tr("Active filter summary", "Resumen de filtros activos")}>
          <strong>{tr("Active", "Activos")}:</strong>
          {activeFilterSummary.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}
        </div>
      </div>

      {selectionError && (
        <div className="ccc-alert ccc-alert-error" role="alert">
          <AlertTriangle size={18} />
          <div><strong>{tr("Selection limit", "Límite de selección")}</strong><span>{selectionError}</span></div>
        </div>
      )}

      <CoordinatorBulkActions
        projectId={projectId}
        selected={Object.values(selectedItems)}
        onClear={() => setSelectedItems({})}
        onRefresh={() => setRetryKey((value) => value + 1)}
        lang={lang}
      />

      {savedViewError && (
        <div className="ccc-alert ccc-alert-error" role="alert">
          <AlertTriangle size={18} /><div><strong>{tr("Personal views unavailable", "Vistas personales no disponibles")}</strong><span>{savedViewError}</span></div>
          <button type="button" onClick={() => void loadSavedViews()}><RefreshCw size={13} /> {tr("Retry", "Reintentar")}</button>
        </div>
      )}

      {builtInView === "next_coordination_meeting" && data?.meetingContext.status === "failed" && (
        <div className="ccc-alert ccc-alert-warning" role="alert">
          <AlertTriangle size={18} /><div><strong>{tr("Meeting context unavailable", "Contexto de reunión no disponible")}</strong><span>{tr("The next canonical meeting could not be resolved. Results are intentionally empty and partial.", "No se pudo resolver la próxima reunión canónica. Los resultados están vacíos y parciales intencionalmente.")}</span></div>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}><RefreshCw size={13} /> {tr("Retry", "Reintentar")}</button>
        </div>
      )}

      {builtInView === "next_coordination_meeting" && data?.meetingContext.status === "ok" && (
        <div className="ccc-meeting-context"><CalendarClock size={14} /><span><strong>{data.meetingContext.title}</strong> · {formatDate(data.meetingContext.meetingAt)}</span></div>
      )}

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
            {builtInView === "next_coordination_meeting" && data.meetingContext.status === "none"
              ? tr("No future canonical meeting is available. The view remains empty.", "No hay una reunión canónica futura disponible. La vista permanece vacía.")
              : tr("This is an honest filtered result. The register does not fall back to all records.", "Este es un resultado filtrado real. El registro no vuelve a mostrar todos los registros.")}
          </span>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="ccc-table-wrap">
            <table className="ccc-table">
              <thead>
                <tr>
                  <th className="ccc-select-cell">
                    <input
                      type="checkbox"
                      aria-label={tr("Select all actions on this page", "Seleccionar todas las acciones de esta página")}
                      checked={data.items.length > 0 && data.items.every((item) => !!selectedItems[item.key])}
                      onChange={(event) => {
                        if (!event.target.checked) {
                          setSelectedItems((current) => {
                            const next = { ...current };
                            data.items.forEach((item) => delete next[item.key]);
                            return next;
                          });
                          return;
                        }
                        setSelectedItems((current) => {
                          const next = { ...current };
                          for (const item of data.items) {
                            if (Object.keys(next).length >= 50) break;
                            next[item.key] = item;
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
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
                    selected={!!selectedItems[item.key]}
                    onToggle={() => toggleSelection(item)}
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
                selected={!!selectedItems[item.key]}
                onToggle={() => toggleSelection(item)}
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
  selected: boolean;
  onToggle: () => void;
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
  selected,
  onToggle,
}: SharedItemProps) {
  return (
    <tr>
      <td className="ccc-select-cell">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={tr(`Select ${item.displayIdentifier}`, `Seleccionar ${item.displayIdentifier}`)}
        />
      </td>
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
  selected,
  onToggle,
}: SharedItemProps) {
  return (
    <article className="ccc-card">
      <div className="ccc-card-top">
        <label className="ccc-card-select">
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <span className={`ccc-source ccc-source-${item.sourceModule}`}>
            {sourceLabel(item.sourceModule, lang)}
          </span>
        </label>
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
