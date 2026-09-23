import React from "react";
import { Columns3, Eye, Filter, HelpCircle, ImageOff, List, PanelLeftClose, PanelLeftOpen, Plus, Settings, Table2, X } from "lucide-react";
import { LENS_NEXT_DEFAULT_FILTERS, LENS_NEXT_STATUSES } from "./lens-next-types";
import {
  LENS_NEXT_VIEW_DIMENSIONS,
  type LensNextIssueGroupNode,
  type LensNextViewDimension,
  type LensNextViewPresetId,
} from "./lens-next-view-settings";
import type { LensNextAttachmentsResult, LensNextKnowledgeContext, LensNextLinksResult, LensNextLinkedItemType, LensNextReferenceAttachment, LensNextResolutionDraft, LensNextResolutionEvidence, LensNextResolutionRecord } from "./lens-next-types";
import { LensNextKnowledgePanel } from "./LensNextKnowledgePanel";
import { LensNextResolutionPanel } from "./LensNextResolutionPanel";
import type {
  LensNextConnectionState,
  LensNextCreateDraft,
  LensNextFilters,
  LensNextHistory,
  LensNextIssue,
  LensNextLocalViewpoint,
  LensNextInventorySummary,
  LensNextSyncPlan,
  LensNextProjectOption,
  LensNextPublishAction,
  LensNextStatus,
  LensNextRefreshState,
} from "./lens-next-types";
import { readLensNextWorkspaceLayout, writeLensNextWorkspaceLayout } from "./lens-next-workspace-layout";
import { lensNextDockWidth } from "./lens-next-dock-width";
import type { LensNextIssueSort } from "./lens-next-model";
import { LENS_NEXT_STATUS_LABELS, lensNextIssueAccessibleLabel, lensNextIssueDescription, lensNextPriorityLabel } from "./lens-next-issue-presentation";
import { lensNextSyncLabel, lensNextSyncPlanSummary, lensNextSyncRecoveryGuidance, lensNextSyncReviewCount, lensNextSyncReviewItems, type LensNextSyncReviewFilter } from "./lens-next-sync-presentation";
import { lensNextSelectionTarget, type LensNextSelectionDirection } from "./lens-next-selection-navigation";
import { summarizeLensNextIssues } from "./lens-next-issue-summary";
import { lensNextCaptureKey, lensNextImageStatus, type LensNextImageLoad } from "./lens-next-image-state";
import { useI18n } from "../../lib/i18n";

const STATUS_LABELS = LENS_NEXT_STATUS_LABELS;
const STATUS_LABELS_ES: Record<LensNextStatus, string> = {
  open: "Abierta", follow_up: "Seguimiento", waiting_design: "En espera de diseño", approved: "Aprobada", resolved: "Resuelta",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function displayCode(issue: LensNextIssue): string {
  return issue.displayId ?? issue.identity.viewpointId;
}

function ConnectionBadge({
  label,
  state,
}: {
  label: string;
  state: LensNextConnectionState;
}) {
  return (
    <span
      className={`lens-next__connection lens-next__connection--${state}`}
      title={`${label}: ${state}`}
    >
      <span aria-hidden="true" className="lens-next__connection-dot" />
      {label}: {state}
    </span>
  );
}

function Thumbnail({ issue }: { issue: LensNextIssue }) {
  const { tt } = useI18n();
  const [load, setLoad] = React.useState<LensNextImageLoad | null>(null);
  const imageKey = lensNextCaptureKey(issue);
  const status = lensNextImageStatus(load, imageKey, issue.screenshotUrl);
  if (status === "missing") {
    return (
      <div
        className="lens-next__thumbnail lens-next__thumbnail--empty"
        role="img"
        aria-label={tt("No captured thumbnail", "Sin miniatura capturada")}
      >
        <ImageOff aria-hidden="true" size={20} strokeWidth={1.75} />
        <small>{tt("No captured thumbnail", "Sin miniatura")}</small>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div
        className="lens-next__thumbnail lens-next__thumbnail--error"
        role="img"
        aria-label={`${tt("Thumbnail unavailable for issue", "Miniatura no disponible para la incidencia")} ${displayCode(issue)}`}
      >
        <ImageOff aria-hidden="true" size={20} strokeWidth={1.75} />
        <small>{tt("Thumbnail unavailable", "Miniatura no disponible")}</small>
      </div>
    );
  }
  return (
    <span className="lens-next__thumbnail-frame" aria-busy={status === "loading"}>
      <img
        className="lens-next__thumbnail"
        src={issue.screenshotUrl ?? undefined}
        alt={status === "loaded" ? `${tt("Captured image for issue", "Imagen capturada para la incidencia")} ${displayCode(issue)}` : ""}
        data-load-state={status}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={() => setLoad({ key: imageKey, status: "loaded" })}
        onError={() => setLoad({ key: imageKey, status: "error" })}
      />
      <small className="lens-next__thumbnail-state">{status === "loaded" ? tt("Captured image", "Imagen capturada") : tt("Loading image", "Cargando imagen")}</small>
    </span>
  );
}

function CapturedView({ issue }: { issue: LensNextIssue }) {
  const { tt } = useI18n();
  const [load, setLoad] = React.useState<LensNextImageLoad | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const imageKey = lensNextCaptureKey(issue, attempt);
  const status = lensNextImageStatus(load, imageKey, issue.screenshotUrl);
  return (
    <figure className="lens-next__captured-view">
      {status === "missing" || status === "error" ? (
        <div className="lens-next__captured-view-empty" role="img" aria-label={status === "error" ? tt("Captured image could not be loaded", "No se pudo cargar la imagen capturada") : tt("No captured image available", "No hay imagen capturada")}>
          <ImageOff aria-hidden="true" size={30} />
          <span>{status === "error" ? tt("Captured image could not be loaded", "No se pudo cargar la imagen capturada") : tt("No captured image available", "No hay imagen capturada")}</span>
        </div>
      ) : (
        <div className="lens-next__captured-image-frame" aria-busy={status === "loading"}>
          <img key={imageKey} src={issue.screenshotUrl ?? undefined} data-load-state={status} alt={status === "loaded" ? `${tt("Captured BIMLog view for issue", "Vista BIMLog capturada para la incidencia")} ${displayCode(issue)}` : ""} decoding="async" onLoad={() => setLoad({ key: imageKey, status: "loaded" })} onError={() => setLoad({ key: imageKey, status: "error" })} />
          {status === "loading" && <span className="lens-next__captured-image-loading" role="status">{tt("Loading stored capture…", "Cargando captura guardada…")}</span>}
        </div>
      )}
      <figcaption>{status === "error" ? tt("The stored capture could not be displayed. No replacement image was generated.", "No se pudo mostrar la captura guardada. No se generó una imagen de reemplazo.") : status === "loaded" ? `${tt("BIMLog capture", "Captura BIMLog")} · ${formatTimestamp(issue.capturedAt)}` : status === "loading" ? tt("A stored image reference exists; display is pending.", "Existe una referencia a la imagen guardada; su visualización está pendiente.") : tt("No image is stored for this issue. Open its governed Working View in Navisworks when available.", "Esta incidencia no tiene una imagen guardada. Abra su vista de trabajo controlada en Navisworks cuando esté disponible.")}</figcaption>
      {status === "error" && <button type="button" onClick={() => setAttempt(value => value + 1)}>{tt("Retry image", "Reintentar imagen")}</button>}
    </figure>
  );
}

function OperationStatus({ label, state }: { label: string; state: "idle" | "capturing" | "creating" | "running" | "uploading" | "publishing" | "success" | "published" | "error" }) {
  if (state === "idle") return null;
  const active = state === "capturing" || state === "creating" || state === "running" || state === "uploading" || state === "publishing";
  const completed = state === "success" || state === "published";
  return (
    <span className={`lens-next__operation lens-next__operation--${state}`} role={state === "error" ? "alert" : "status"}>
      <span aria-hidden="true" className="lens-next__operation-dot" />
      <strong>{label}</strong>
      <span>{active ? "In progress" : completed ? "Complete" : "Stopped"}</span>
    </span>
  );
}

const IssueCard = React.memo(function IssueCard({
  issue,
  selected,
  onSelect,
}: {
  issue: LensNextIssue;
  selected: boolean;
  onSelect(): void;
}) {
  const cardRef=React.useRef<HTMLButtonElement|null>(null);
  React.useEffect(()=>{if(selected)cardRef.current?.scrollIntoView({block:"nearest",inline:"nearest"});},[selected]);
  return (
    <button
      ref={cardRef}
      type="button"
      className={`lens-next__issue-card${selected ? " lens-next__issue-card--selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={lensNextIssueAccessibleLabel(issue)}
      data-priority={issue.priority ?? "none"}
      data-status={issue.status}
    >
      <Thumbnail issue={issue} />
      <span className="lens-next__issue-summary">
        <span className="lens-next__issue-title">
          <strong>{displayCode(issue)}</strong>
          <span className={`lens-next__priority lens-next__priority--${issue.priority ?? "none"}`}>
            {lensNextPriorityLabel(issue.priority)}
          </span>
        </span>
        <span className="lens-next__issue-note">{lensNextIssueDescription(issue)}</span>
        <span className="lens-next__issue-meta">
          <span className={`lens-next__status lens-next__status--${issue.status}`}>
            {STATUS_LABELS[issue.status]}
          </span>
          <span>{issue.trade ?? "Trade not recorded"}</span>
          <span>{issue.floor ?? "Floor not recorded"}</span>
        </span>
      </span>
    </button>
  );
});

function IssueGroups({
  groups,
  selectedServerId,
  onSelectIssue,
  depth = 0,
}: {
  groups: readonly LensNextIssueGroupNode[];
  selectedServerId: number | null;
  onSelectIssue(serverId: number): void;
  depth?: number;
}) {
  return (
    <>
      {groups.map((group) => (
        <section className="lens-next__group" key={`${depth}:${group.key}`}>
          <h4 className="lens-next__group-title" style={{ paddingLeft: `${depth * 10}px` }}>
            {group.label}
          </h4>
          {group.children.length > 0 ? (
            <IssueGroups
              groups={group.children}
              selectedServerId={selectedServerId}
              onSelectIssue={onSelectIssue}
              depth={depth + 1}
            />
          ) : (
            group.issues.map((issue) => (
              <IssueCard
                key={issue.identity.serverId}
                issue={issue}
                selected={issue.identity.serverId === selectedServerId}
                onSelect={() => onSelectIssue(issue.identity.serverId)}
              />
            ))
          )}
        </section>
      ))}
    </>
  );
}

const IssueTable = React.memo(function IssueTable({
  issues,
  selectedServerId,
  onSelectIssue,
}: {
  issues: readonly LensNextIssue[];
  selectedServerId: number | null;
  onSelectIssue(serverId: number): void;
}) {
  const { tt } = useI18n();
  return (
    <div className="lens-next__issue-table-scroll">
      <table className="lens-next__issue-table">
        <thead><tr><th>{tt("Issue", "Incidencia")}</th><th>{tt("Priority", "Prioridad")}</th><th>{tt("Status", "Estado")}</th><th>{tt("Trade", "Disciplina")}</th><th>{tt("Floor", "Piso")}</th><th>{tt("Company", "Empresa")}</th><th>{tt("Report type", "Tipo de informe")}</th><th>{tt("Image", "Imagen")}</th></tr></thead>
        <tbody>
          {issues.map(issue => {
            const selected = issue.identity.serverId === selectedServerId;
            return (
              <tr key={issue.identity.serverId} className={selected ? "lens-next__issue-row--selected" : undefined}>
                <td><button type="button" aria-pressed={selected} aria-label={lensNextIssueAccessibleLabel(issue)} onClick={() => onSelectIssue(issue.identity.serverId)}>{displayCode(issue)}<small>{lensNextIssueDescription(issue)}</small></button></td>
                <td>{lensNextPriorityLabel(issue.priority)}</td>
                <td><span className={`lens-next__status lens-next__status--${issue.status}`}>{STATUS_LABELS[issue.status]}</span></td>
                <td>{issue.trade ?? "Not recorded"}</td>
                <td>{issue.floor ?? "Not recorded"}</td>
                <td>{issue.responsibleCompany ?? tt("Unassigned", "Sin asignar")}</td>
                <td>{issue.reportType ?? tt("Not recorded", "Sin registrar")}</td>
                <td>{issue.screenshotUrl ? tt("Image recorded", "Imagen registrada") : tt("Not recorded", "Sin registrar")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

function HistoryView({ history }: { history: LensNextHistory }) {
  return (
    <section
      className="lens-next__history"
      aria-label="Read-only revision history"
    >
      <h4>Revision history</h4>
      {history.revisions.length === 0 ? (
        <p>No revision history recorded.</p>
      ) : (
        <ol>
          {history.revisions.map((revision) => (
            <li key={revision.serverId}>
              <strong>Rev {revision.revisionNumber}</strong> ·{" "}
              {revision.lifecycleStatus}
              <span>{revision.note ?? "No revision note"}</span>
              <small>
                {formatTimestamp(revision.updatedAt ?? revision.createdAt)}
              </small>
            </li>
          ))}
        </ol>
      )}
      <h4>Activity</h4>
      {history.events.length === 0 ? (
        <p>No activity events recorded.</p>
      ) : (
        <ol>
          {history.events.map((event) => (
            <li key={event.id}>
              <strong>{event.actionType}</strong>
              <span>{event.details ?? "No event detail"}</span>
              <small>
                {event.userFullName ?? "Unknown user"} ·{" "}
                {formatTimestamp(event.createdAt)}
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface LensNextPanelViewProps {
  authorizedProjects: readonly LensNextProjectOption[];
  selectedProjectId: number | null;
  onProjectChange(projectId: number): void;
  projectLocked: boolean;
  bridgeDisplayName: string | null;
  bridgeModelFingerprint: string | null;
  bridgeBindingSource: string | null;
  inventorySummary: LensNextInventorySummary;
  synchronizationPlan: LensNextSyncPlan;
  uploadableLocalViewpoints: readonly LensNextLocalViewpoint[];
  localUploadState: "idle" | "capturing" | "uploading" | "success" | "error";
  localUploadMessage: string | null;
  onUploadLocalViewpoint(viewpoint: LensNextLocalViewpoint): void;
  createEnabled: boolean;
  createState: "idle" | "capturing" | "creating" | "success" | "error";
  createMessage: string | null;
  onCreateIssue(draft: LensNextCreateDraft, reason: string): void;
  layoutEnabled: boolean;
  layoutState: "idle" | "running" | "success" | "error";
  layoutMessage: string | null;
  onMaterializeMyView(): void;
  reconciliationState: "idle" | "running" | "success" | "error";
  reconciliationMessage: string | null;
  onRunReconciliation(): void;
  platformPullState: "idle" | "running" | "success" | "error";
  platformPullMessage: string | null;
  onPullPlatformViewpoints(): void;
  xmlExportEnabled: boolean;
  xmlExportState: "idle" | "loading" | "exporting" | "success" | "error";
  xmlExportMessage: string | null;
  onExportViewpointsXml(): void;
  filteredIssues: readonly LensNextIssue[];
  visibleIssues: readonly LensNextIssue[];
  activeIssueCount:number;
  issueSort:LensNextIssueSort;onIssueSortChange(next:LensNextIssueSort):void;issuePage:number;issuePageCount:number;issuePageSize:number;onIssuePageChange(next:number):void;onIssuePageSizeChange(next:number):void;
  issueGroups: readonly LensNextIssueGroupNode[];
  viewPreset: LensNextViewPresetId;
  customGroupBy: readonly LensNextViewDimension[];
  onViewPresetChange(next: LensNextViewPresetId): void;
  onCustomGroupByChange(next: readonly LensNextViewDimension[]): void;
  selectedServerId: number | null;
  selectedIssue: LensNextIssue | null;
  linkedItems: LensNextLinksResult | "loading" | null;
  linkedItemsError: string | null;
  onLinkBimlogItem(type: LensNextLinkedItemType, authoritativeId: number): void;
  onRemoveLinkedItem(linkId: number): void;
  referenceAttachments: LensNextAttachmentsResult | "loading" | null;
  referenceAttachmentsError: string | null;
  knowledgeContext: LensNextKnowledgeContext | "loading" | null;
  knowledgeError: string | null;
  onRetryKnowledge(): void;
  onClassifyKnowledge(revisionId:string|null,expected:string|null):void;
  resolutionRecord:LensNextResolutionRecord|"loading"|null;
  resolutionError:string|null;
  onRetryResolution():void;
  onSaveResolution(draft:LensNextResolutionDraft):Promise<void>;
  onTransitionResolution(action:"verify"|"reopen",expectedRevision:number,reason?:string|null):Promise<void>;
  resolutionEvidence:readonly LensNextResolutionEvidence[]|"loading";
  onAddResolutionEvidence(fileId:number,role:"before"|"after"|"supporting"):Promise<void>;
  lessonProposal:import("./lens-next-types").LensNextLessonProposal|"loading"|null;
  onProposeLesson(lesson:string,organizationalApplicability:string):Promise<void>;
  onUploadReferenceAttachment(file: File): void;
  onOpenReferenceAttachment(attachment: LensNextReferenceAttachment): void;
  onRemoveReferenceAttachment(attachmentId: number): void;
  filters: LensNextFilters;
  onFiltersChange(next: LensNextFilters): void;
  trades: readonly string[];
  floors: readonly string[];
  filterCompanies: readonly string[];
  filterReportTypes: readonly string[];
  createTrades: readonly string[];
  createFloors: readonly string[];
  createResponsibleCompanies: readonly string[];
  createReportTypes: readonly string[];
  apiState: LensNextConnectionState;
  bridgeState: LensNextConnectionState;
  refreshState: LensNextRefreshState;
  apiError: string | null;
  bridgeError: string | null;
  history: LensNextHistory | "loading" | null;
  historyError: string | null;
  lastRefreshedAt: string | null;
  bridgeOpenEnabled: boolean;
  workingViewState: "idle" | "opening" | "success" | "error";
  workingViewUnavailable: boolean;
  visualRepairState: "idle" | "repairing" | "success" | "error";
  visualRepairMessage: string | null;
  onRepairCurrentWorkingView(): void;
  onRefresh(): void;
  onSelectIssue(serverId: number): void;
  onCloseIssue(): void;
  onOpenWorkingView(): void;
  onLoadHistory(): void;
  publishState: "idle" | "publishing" | "published" | "error";
  publishMessage: string | null;
  onPublishAction(action: LensNextPublishAction, reason: string): void;
}

export function LensNextPanelView({
  authorizedProjects,
  selectedProjectId,
  onProjectChange,
  projectLocked,
  bridgeDisplayName,
  bridgeModelFingerprint,
  bridgeBindingSource,
  inventorySummary,
  synchronizationPlan,
  uploadableLocalViewpoints,
  localUploadState,
  localUploadMessage,
  onUploadLocalViewpoint,
  createEnabled,
  createState,
  createMessage,
  onCreateIssue,
  layoutEnabled,
  layoutState,
  layoutMessage,
  onMaterializeMyView,
  reconciliationState,
  reconciliationMessage,
  onRunReconciliation,
  platformPullState,
  platformPullMessage,
  onPullPlatformViewpoints,
  xmlExportEnabled,
  xmlExportState,
  xmlExportMessage,
  onExportViewpointsXml,
  filteredIssues,
  visibleIssues,
  activeIssueCount,
  issueSort,onIssueSortChange,issuePage,issuePageCount,issuePageSize,onIssuePageChange,onIssuePageSizeChange,
  issueGroups,
  viewPreset,
  customGroupBy,
  onViewPresetChange,
  onCustomGroupByChange,
  selectedServerId,
  selectedIssue,
  linkedItems,
  linkedItemsError,
  onLinkBimlogItem,
  onRemoveLinkedItem,
  referenceAttachments,
  referenceAttachmentsError,
  knowledgeContext,
  knowledgeError,
  onRetryKnowledge,
  onClassifyKnowledge,
  resolutionRecord,resolutionError,onRetryResolution,onSaveResolution,onTransitionResolution,resolutionEvidence,onAddResolutionEvidence,lessonProposal,onProposeLesson,
  onUploadReferenceAttachment,
  onOpenReferenceAttachment,
  onRemoveReferenceAttachment,
  filters,
  onFiltersChange,
  trades,
  floors,
  filterCompanies,
  filterReportTypes,
  createTrades,
  createFloors,
  createResponsibleCompanies,
  createReportTypes,
  apiState,
  bridgeState,
  refreshState,
  apiError,
  bridgeError,
  history,
  historyError,
  lastRefreshedAt,
  bridgeOpenEnabled,
  workingViewState,
  workingViewUnavailable,
  visualRepairState,
  visualRepairMessage,
  onRepairCurrentWorkingView,
  onRefresh,
  onSelectIssue,
  onCloseIssue,
  onOpenWorkingView,
  onLoadHistory,
  publishState,
  publishMessage,
  onPublishAction,
}: LensNextPanelViewProps) {
  const { language, tt } = useI18n();
  const [publishKind, setPublishKind] = React.useState<LensNextPublishAction["type"]>("status");
  const [publishStatus, setPublishStatus] = React.useState<LensNextStatus>("follow_up");
  const [publishText, setPublishText] = React.useState("");
  const [publishReason, setPublishReason] = React.useState("");
  const [publishReviewReady, setPublishReviewReady] = React.useState(false);
  const [createDraft, setCreateDraft] = React.useState<LensNextCreateDraft>({ trade: "", note: "", responsibleCompany: "", reportType: "COORDINATION", floor: "", priority: 3, openItems: "", status: "open" });
  const [createReason, setCreateReason] = React.useState("");
  const [createReviewReady, setCreateReviewReady] = React.useState(false);
  const [linkType, setLinkType] = React.useState<LensNextLinkedItemType>("rfi");
  const [linkTargetId, setLinkTargetId] = React.useState("");
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [issuePresentation, setIssuePresentation] = React.useState<"cards" | "table">("cards");
  const [detailView, setDetailView] = React.useState<"overview" | "knowledge" | "resolution" | "bimlog" | "properties" | "activity">("overview");
  const [syncReviewFilter, setSyncReviewFilter] = React.useState<LensNextSyncReviewFilter>("all");
  const [activeWorkspace, setActiveWorkspace] = React.useState<"filters" | "viewpoints" | "create" | "settings">("viewpoints");
  const createSectionRef = React.useRef<HTMLDetailsElement | null>(null);
  const settingsSectionRef = React.useRef<HTMLDetailsElement | null>(null);
  const filterPaneRef = React.useRef<HTMLElement | null>(null);
  const issueListRef = React.useRef<HTMLElement | null>(null);
  const linkSectionRef = React.useRef<HTMLDetailsElement | null>(null);
  const selectedIssueRef = React.useRef<HTMLElement | null>(null);
  const helpButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const helpCloseRef = React.useRef<HTMLButtonElement | null>(null);
  const lensRootRef = React.useRef<HTMLElement | null>(null);
  const [availableWidth, setAvailableWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const root = lensRootRef.current;
    if (!root) return;
    const measure = () => setAvailableWidth(root.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const [workspaceLayout,setWorkspaceLayout]=React.useState(()=>readLensNextWorkspaceLayout(typeof window==="undefined"?null:window.localStorage));
  React.useEffect(()=>writeLensNextWorkspaceLayout(typeof window==="undefined"?null:window.localStorage,workspaceLayout),[workspaceLayout]);
  React.useEffect(() => { setPublishText(""); setPublishReason(""); }, [selectedIssue?.identity.serverId]);
  React.useEffect(() => { setLinkType("rfi"); setLinkTargetId(""); }, [selectedIssue?.identity.serverId]);
  React.useEffect(() => setDetailView("overview"), [selectedIssue?.identity.serverId]);
  React.useEffect(() => setPublishReviewReady(false), [publishKind, publishStatus, publishText, publishReason, selectedIssue?.identity.serverId, selectedIssue?.mutationVersion]);
  React.useEffect(() => {
    if (!selectedIssue || typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;
    selectedIssueRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [selectedIssue?.identity.serverId]);
  React.useEffect(() => {
    if (!guideOpen) return;
    helpCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setGuideOpen(false);
      window.setTimeout(() => helpButtonRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [guideOpen]);
  const revealSection = React.useCallback((section: HTMLDetailsElement | null) => {
    if (!section) return;
    section.open = true;
    section.scrollIntoView({ block: "nearest", behavior: "smooth" });
    window.setTimeout(() => section.querySelector<HTMLElement>("select, input, textarea, button")?.focus(), 250);
  }, []);
  const activateWorkspace = (next: typeof activeWorkspace) => {
    setActiveWorkspace(next);
    if (next === "create") revealSection(createSectionRef.current);
    if (next === "settings") revealSection(settingsSectionRef.current);
    if (next === "filters") filterPaneRef.current?.scrollIntoView({ block: "nearest" });
    if (next === "viewpoints") issueListRef.current?.scrollIntoView({ block: "nearest" });
  };
  const previousIssue = selectedIssue
    ? lensNextSelectionTarget(filteredIssues, selectedIssue.identity.serverId, "previous", issuePageSize)
    : null;
  const nextIssue = selectedIssue
    ? lensNextSelectionTarget(filteredIssues, selectedIssue.identity.serverId, "next", issuePageSize)
    : null;
  const selectedFilteredIndex = selectedIssue
    ? filteredIssues.findIndex(issue => issue.identity.serverId === selectedIssue.identity.serverId)
    : -1;
  const issueSummary = React.useMemo(() => summarizeLensNextIssues(filteredIssues), [filteredIssues]);
  const navigateSelectedIssue = (direction: LensNextSelectionDirection) => {
    const target = direction === "previous" ? previousIssue : nextIssue;
    if (!target) return;
    if (target.page !== issuePage) onIssuePageChange(target.page);
    onSelectIssue(target.issue.identity.serverId);
  };
  const preparedAction: LensNextPublishAction = publishKind === "status" ? { type: "status", status: publishStatus } : publishKind === "comment" ? { type: "comment", comment: publishText.trim() } : { type: "assignment", responsibleCompany: publishText.trim() };
  return (
    <aside ref={lensRootRef} className="lens-next" data-dock-width={lensNextDockWidth(availableWidth)} data-workspace={activeWorkspace} aria-label="BIMLog Lens Next controlled issue workspace" aria-busy={refreshState === "refreshing" || reconciliationState === "running"}>
      <nav className="lens-next__side-rail" aria-label="Lens workspaces">
        {([
          ["filters", Filter, tt("Filters", "Filtros")],
          ["viewpoints", Eye, tt("Viewpoints", "Puntos de vista")],
          ["create", Plus, tt("Create", "Crear")],
          ["settings", Settings, tt("Settings", "Configuración")],
        ] as const).map(([workspace, Icon, label]) => (
          <button key={workspace} type="button" title={label} aria-label={label} aria-pressed={activeWorkspace === workspace} onClick={() => activateWorkspace(workspace)}>
            <Icon aria-hidden="true" size={20} />
          </button>
        ))}
      </nav>
      <nav className="lens-next__skip-links" aria-label="Skip within Lens Next">
        <a href="#lens-next-issue-list">{tt("Skip to issues", "Saltar a incidencias")}</a>
        {selectedIssue && <a href="#lens-next-selected-issue">{tt("Skip to selected issue", "Saltar a la incidencia seleccionada")}</a>}
      </nav>
      <header className="lens-next__header">
        <div>
          <p className="lens-next__eyebrow">BIMLog · Controlled publishing</p>
        </div>
        <div className="lens-next__header-actions">
          <button ref={helpButtonRef} type="button" className="lens-next__help" onClick={() => setGuideOpen(true)}><HelpCircle aria-hidden="true" size={16} /> Help &amp; Guide</button>
          <button type="button" className="lens-next__refresh" onClick={onRefresh} disabled={refreshState === "refreshing"}>{refreshState === "refreshing" ? "Refreshing…" : "Refresh"}</button>
        </div>
      </header>

      {guideOpen && (
        <div className="lens-next__guide-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}>
          <section className="lens-next__guide" role="dialog" aria-modal="true" aria-labelledby="lens-next-guide-title" onMouseDown={event => event.stopPropagation()}>
            <header><h2 id="lens-next-guide-title">Lens Next Help &amp; Guide</h2><button ref={helpCloseRef} type="button" aria-label="Close Help and Guide" onClick={() => { setGuideOpen(false); window.setTimeout(() => helpButtonRef.current?.focus(), 0); }}><X aria-hidden="true" size={18} /></button></header>
            <ol>
              <li><strong>Create Issue:</strong> open <em>Create BIMLog Issue</em>, enter the issue details, choose <em>Review Issue Creation</em>, then <em>Confirm and Create BIMLog Issue</em>.</li>
              <li><strong>Open Working View:</strong> select an issue in the issue list, then choose <em>Open Working View</em> in its details.</li>
              <li><strong>Export Viewpoints XML:</strong> choose <em>Export Viewpoints XML</em> in the active-model section and select a destination. In Navisworks, open Saved Viewpoints and choose <em>Import Viewpoints</em> to import that file.</li>
              <li><strong>Link an RFI:</strong> select an issue, open <em>Linked BIMLog Items</em>, choose <em>Link RFI</em>, select an existing RFI, and confirm with <em>Link RFI</em>.</li>
              <li><strong>Link a Submittal:</strong> select an issue, open <em>Linked BIMLog Items</em>, choose <em>Link Submittal</em>, select an existing Submittal, and confirm with <em>Link Submittal</em>.</li>
              <li><strong>Add a reference:</strong> select an issue and choose <em>Add Reference Attachment</em> under <em>Reference Attachments</em>. PDF, JPG, JPEG, and PNG files up to 5 MB are accepted.</li>
              <li><strong>Remove:</strong> use <em>Remove</em> beside a linked item or reference attachment. Removing a reference does not change the issue camera or other links.</li>
            </ol>
            <p>Only items from the current authorized BIMLog project can be linked.</p>
          </section>
        </div>
      )}

      <div
        className="lens-next__connections"
        aria-live="polite"
        aria-label="Connection status"
      >
        <ConnectionBadge label="BIMLog" state={apiState} />
        <ConnectionBadge label="Navisworks" state={bridgeState} />
        <div className="lens-next__workspace-controls" aria-label="Workspace layout controls">
          <button type="button" className="lens-next__primary" disabled={!createEnabled} onClick={() => revealSection(createSectionRef.current)}>{tt("Create issue", "Crear incidencia")}</button>
          <Columns3 aria-hidden="true" size={15}/>
          <button type="button" onClick={()=>setWorkspaceLayout(current=>({...current,filtersCollapsed:!current.filtersCollapsed}))}>{workspaceLayout.filtersCollapsed?<><PanelLeftOpen aria-hidden="true" size={14}/> Show filters</>:<><PanelLeftClose aria-hidden="true" size={14}/> Hide filters</>}</button>
          <button type="button" onClick={()=>setWorkspaceLayout(current=>({...current,listCollapsed:!current.listCollapsed}))}>{workspaceLayout.listCollapsed?"Show issue list":"Hide issue list"}</button>
        </div>
      </div>

      <section className="lens-next__record-summary" aria-label={tt("BIMLog issue record summary", "Resumen de incidencias BIMLog")}>
        <strong>{activeIssueCount} {tt("active BIMLog issues", "incidencias BIMLog activas")}</strong>
        <span>{issueSummary.total} {tt("match filters", "coinciden con filtros")}</span>
        <span>{issueSummary.withImageReference} {tt("with image reference", "con referencia de imagen")}</span>
        <details>
          <summary>{tt("Status and evidence", "Estado y evidencia")}</summary>
          <div className="lens-next__record-summary-detail">
            {LENS_NEXT_STATUSES.map(status => <span key={status}>{tt(STATUS_LABELS[status], STATUS_LABELS_ES[status])}: {issueSummary.byStatus[status]}</span>)}
            <span>{tt("Visual package available", "Paquete visual disponible")}: {issueSummary.withVisualPackage}</span>
          </div>
          <small>{tt("Counts describe filtered BIMLog issue records, not the Navisworks clash inventory or current page. An image reference does not guarantee the image can load.", "Los conteos describen incidencias BIMLog filtradas, no el inventario de interferencias de Navisworks ni la página actual. Una referencia de imagen no garantiza que pueda cargarse.")}</small>
        </details>
      </section>

      <div className={`lens-next__body${workspaceLayout.listCollapsed?" lens-next__body--list-collapsed":""}`} style={{"--lens-next-filter-width":`${workspaceLayout.filtersWidth}px`,"--lens-next-list-width":`${workspaceLayout.listWidth}px`} as React.CSSProperties}>
        <section className="lens-next__browser" aria-label="Issue browser and filters">
          <label className="lens-next__field">
        <span>Project</span>
        <select
          value={selectedProjectId ?? ""}
          disabled={projectLocked}
          onChange={(event) => {
            const projectId = Number(event.target.value);
            if (
              Number.isSafeInteger(projectId) &&
              authorizedProjects.some((project) => project.id === projectId)
            ) {
              onProjectChange(projectId);
            }
          }}
        >
          <option value="" disabled>
            Select an authenticated project
          </option>
          {authorizedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code ? `${project.code} · ` : ""}
              {project.name}
            </option>
          ))}
        </select>
        {projectLocked && <small>Bound to the active Navisworks project.</small>}
      </label>

      {(bridgeDisplayName || bridgeModelFingerprint) && (
        <details className="lens-next__active-model" aria-label="Active Navisworks model and synchronization tools">
          <summary>
            <span>
              <strong>{bridgeDisplayName ?? "Active Navisworks model"}</strong>
              <small>{inventorySummary.matched} matched · {synchronizationPlan.manualConflict + synchronizationPlan.blocked} need review</small>
            </span>
            <span>Model tools</span>
          </summary>
          <div className="lens-next__active-model-content">
          <small>Binding authority: {bridgeBindingSource === "managed-marker" ? "verified BIMLog managed marker" : bridgeBindingSource === "platform-binding" ? "authorized platform binding" : bridgeBindingSource === "explicit-user-selection" ? "explicit authorized selection" : "unbound"}</small>
          <p className="lens-next__sync-scope">{tt("Inventory preview: loaded active BIMLog issues for this project plus available local inventory. These are not clash counts.", "Vista previa del inventario: issues BIMLog activos cargados de este proyecto más el inventario local disponible. No son conteos de interferencias.")}</p>
          <div className="lens-next__inventory-summary" aria-label="Read-only reconciliation preview">
            <span><strong>{inventorySummary.matched}</strong> matched</span>
            <span><strong>{inventorySummary.platformOnly}</strong> platform only</span>
            <span><strong>{inventorySummary.navisworksOnly}</strong> Navisworks only</span>
            <span><strong>{inventorySummary.conflicted}</strong> conflicts</span>
            <span><strong>{inventorySummary.unresolved}</strong> unresolved</span>
          </div>
          <p className="lens-next__sync-scope">{tt(`Plan scope: ${filteredIssues.length} of ${activeIssueCount} active BIMLog issues in the current filtered view, plus local-only viewpoints. Review is required before any change.`, `Alcance del plan: ${filteredIssues.length} de ${activeIssueCount} issues BIMLog activos en la vista filtrada, más viewpoints solo locales. Revise antes de cualquier cambio.`)}</p>
          <div className="lens-next__inventory-summary" aria-label="Current-view synchronization plan">
            <span><strong>{synchronizationPlan.inSync}</strong> already synchronized</span>
            <span><strong>{synchronizationPlan.confirmLocalIdentity}</strong> recover confirmation</span>
            <span><strong>{synchronizationPlan.pullFromBimlog}</strong> pull from BIMLog</span>
            <span><strong>{synchronizationPlan.uploadToBimlog}</strong> upload to BIMLog</span>
            <span><strong>{synchronizationPlan.manualConflict}</strong> manual review</span>
            <span><strong>{synchronizationPlan.blocked}</strong> blocked</span>
          </div>
          <p id="lens-next-sync-readiness" className={`lens-next__sync-readiness${synchronizationPlan.executable ? " lens-next__sync-readiness--ready" : ""}`} role="status" aria-atomic="true">
            <strong>{synchronizationPlan.executable ? tt("Ready for confirmation", "Listo para confirmar") : tt("Review required", "Revisión requerida")}</strong>
            <span>{lensNextSyncPlanSummary(synchronizationPlan, language)}</span>
          </p>
          <div className="lens-next__operation-status" aria-label="Synchronization operation progress" aria-live="polite">
            <OperationStatus label="Platform pull" state={platformPullState} />
            <OperationStatus label="Reconciliation" state={reconciliationState} />
            <OperationStatus label="Local upload" state={localUploadState} />
          </div>
          <small>Current BIMLog view plus exact local-only managed items. A confirmed run pulls complete BIMLog packages first, then uploads exact local-only managed viewpoints. It never overwrites or saves the model.</small>
          <button type="button" disabled={synchronizationPlan.pullFromBimlog === 0 || platformPullState === "running"} onClick={onPullPlatformViewpoints}>
            {platformPullState === "running" ? "Creating Navisworks viewpoints…" : `Pull BIMLog viewpoints into Navisworks (${synchronizationPlan.pullFromBimlog})`}
          </button>
          {platformPullMessage && <small role="status">{platformPullMessage}</small>}
          <button type="button" data-lens-next-action="export-viewpoints-xml" disabled={!xmlExportEnabled} onClick={onExportViewpointsXml}>
            {xmlExportState === "loading" ? "Loading BIMLog viewpoints…" : xmlExportState === "exporting" ? "Exporting XML…" : "Export Viewpoints XML"}
          </button>
          {xmlExportMessage && <small role={xmlExportState === "error" ? "alert" : "status"}>{xmlExportMessage}</small>}
          <button type="button" aria-describedby="lens-next-sync-readiness" disabled={!synchronizationPlan.executable || reconciliationState === "running"} onClick={onRunReconciliation}>
            {reconciliationState === "running" ? "Reconciling…" : "Run confirmed reconciliation"}
          </button>
          {!synchronizationPlan.executable && synchronizationPlan.manualConflict + synchronizationPlan.blocked > 0 && <small role="alert">Resolve every manual-review and blocked item before reconciliation can change either system.</small>}
          {reconciliationMessage && <small role="status">{reconciliationMessage}</small>}
          <details className="lens-next__sync-plan">
            <summary>Review synchronization plan ({synchronizationPlan.items.length} {synchronizationPlan.items.length === 1 ? "item" : "items"})</summary>
            <div className="lens-next__sync-review-filters" role="group" aria-label={tt("Synchronization plan categories", "Categorías del plan de sincronización")}>
              {(["all", "attention", "changes", "in_sync"] as const).map(filter => (
                <button key={filter} type="button" aria-pressed={syncReviewFilter === filter} onClick={() => setSyncReviewFilter(filter)}>
                  {filter === "all" ? tt("All", "Todos") : filter === "attention" ? tt("Needs review", "Requiere revisión") : filter === "changes" ? tt("Proposed changes", "Cambios propuestos") : tt("In sync", "Sincronizados")} ({lensNextSyncReviewCount(synchronizationPlan, filter)})
                </button>
              ))}
            </div>
            {lensNextSyncReviewCount(synchronizationPlan, syncReviewFilter) === 0 && <p className="lens-next__sync-empty">{tt("No plan items in this category.", "No hay elementos del plan en esta categoría.")}</p>}
            <ol>
              {lensNextSyncReviewItems(synchronizationPlan, syncReviewFilter).map((item, index) => (
                <li key={`${item.platformServerId ?? "local"}:${item.localNavisworksGuid ?? "platform"}:${index}`}>
                  <strong>{item.displayId}</strong>
                  <span className={`lens-next__sync-disposition lens-next__sync-disposition--${item.disposition}`}>{lensNextSyncLabel(item.disposition, language)}</span>
                  <small>{item.platformServerId !== null ? tt(`BIMLog record #${item.platformServerId}`, `Registro BIMLog #${item.platformServerId}`) : tt("Local-only Navisworks viewpoint; no BIMLog record selected", "Viewpoint solo local de Navisworks; sin registro BIMLog seleccionado")}</small>
                  <small>{item.reason}</small>
                  {lensNextSyncRecoveryGuidance(item.disposition, item.platformServerId !== null, language) && (
                    <div className="lens-next__sync-recovery">
                      <span>{lensNextSyncRecoveryGuidance(item.disposition, item.platformServerId !== null, language)}</span>
                      {item.platformServerId !== null && <button type="button" onClick={() => onSelectIssue(item.platformServerId!)}>{tt("Review record", "Revisar registro")}</button>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </details>
          {uploadableLocalViewpoints.length > 0 && (
            <section className="lens-next__local-uploads" aria-label="Confirmed local viewpoint uploads">
              <strong>Navisworks-only BIMLog viewpoints</strong>
              {uploadableLocalViewpoints.map(viewpoint => (
                <div key={viewpoint.navisworksGuid}>
                  <span>{viewpoint.displayId ?? viewpoint.viewpointId}</span>
                  <button type="button" disabled={localUploadState === "capturing" || localUploadState === "uploading"} onClick={() => onUploadLocalViewpoint(viewpoint)}>
                    {localUploadState === "capturing" ? "Capturing…" : localUploadState === "uploading" ? "Uploading…" : "Review upload"}
                  </button>
                </div>
              ))}
              {localUploadMessage && <small role="status">{localUploadMessage}</small>}
            </section>
          )}
          {bridgeModelFingerprint && <small>Model {bridgeModelFingerprint.slice(0, 12)}…</small>}
          </div>
        </details>
      )}

      <details ref={createSectionRef} className="lens-next__create">
        <summary>Create BIMLog Issue</summary>
        <div className="lens-next__filters">
          <label className="lens-next__field"><span>Trade</span><select value={createDraft.trade} onChange={e => { setCreateDraft({ ...createDraft, trade: e.target.value }); setCreateReviewReady(false); }}><option value="" disabled>Select trade</option>{createTrades.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="lens-next__field"><span>Floor</span><select value={createDraft.floor} onChange={e => { setCreateDraft({ ...createDraft, floor: e.target.value }); setCreateReviewReady(false); }}><option value="" disabled>Select floor</option>{createFloors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="lens-next__field"><span>Responsible company</span><select value={createDraft.responsibleCompany} onChange={e => { setCreateDraft({ ...createDraft, responsibleCompany: e.target.value }); setCreateReviewReady(false); }}><option value="">Unassigned</option>{createResponsibleCompanies.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="lens-next__field"><span>Report type</span><select value={createDraft.reportType} onChange={e => { setCreateDraft({ ...createDraft, reportType: e.target.value }); setCreateReviewReady(false); }}><option value="" disabled>Select report type</option>{createReportTypes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="lens-next__field"><span>Priority</span><select value={createDraft.priority} onChange={e => { setCreateDraft({ ...createDraft, priority: Number(e.target.value) }); setCreateReviewReady(false); }}>{[1,2,3,4,5].map(p => <option key={p} value={p}>P{p}</option>)}</select></label>
          <label className="lens-next__field"><span>Status</span><select value={createDraft.status} onChange={e => { setCreateDraft({ ...createDraft, status: e.target.value as LensNextStatus }); setCreateReviewReady(false); }}>{LENS_NEXT_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
          <label className="lens-next__field lens-next__field--wide"><span>Instruction</span><textarea value={createDraft.note} onChange={e => { setCreateDraft({ ...createDraft, note: e.target.value }); setCreateReviewReady(false); }} /></label>
          <label className="lens-next__field lens-next__field--wide"><span>Open items / equipment tag (optional)</span><input value={createDraft.openItems} onChange={e => { setCreateDraft({ ...createDraft, openItems: e.target.value }); setCreateReviewReady(false); }} /></label>
          <label className="lens-next__field lens-next__field--wide"><span>Reason for audit history (optional)</span><textarea value={createReason} onChange={e => { setCreateReason(e.target.value); setCreateReviewReady(false); }} /></label>
        </div>
        {!createReviewReady ? (
          <button className="lens-next__create-button" type="button" disabled={!createEnabled || !createDraft.trade.trim() || !createDraft.floor.trim() || !createDraft.note.trim() || !createDraft.reportType.trim()} onClick={() => setCreateReviewReady(true)}>Review Issue Creation</button>
        ) : (
          <div className="lens-next__create-review"><p>Create one BIMLog Issue with its Visual Package and screenshot. No local Navisworks Saved Viewpoint is created and the model file is not modified.</p><button className="lens-next__create-button" type="button" disabled={createState !== "idle" && createState !== "success" && createState !== "error"} onClick={() => { onCreateIssue(createDraft, createReason.trim()); setCreateReviewReady(false); }}>Confirm and Create BIMLog Issue</button></div>
        )}
        <div className="lens-next__operation-status" aria-label="Issue creation progress" aria-live="polite">
          <OperationStatus label="Issue creation" state={createState} />
        </div>
        {createMessage && <p role={createState === "error" ? "alert" : "status"}>{createMessage}</p>}
      </details>

      <details ref={settingsSectionRef} className="lens-next__view-settings" aria-label="Personal issue view">
        <summary>My view settings</summary>
        <div className="lens-next__view-settings-content">
          <label className="lens-next__field lens-next__field--wide">
            <span>My view</span>
            <select
              value={viewPreset}
              onChange={(event) => onViewPresetChange(event.target.value as LensNextViewPresetId)}
            >
              <option value="status_only">Status only</option>
              <option value="floor_trade_company">Floor → Trade → Company</option>
              <option value="floor_company_trade">Floor → Company → Trade</option>
              <option value="company_floor_trade">Company → Floor → Trade</option>
              <option value="company_trade_floor">Company → Trade → Floor</option>
              <option value="trade_floor_company">Trade → Floor → Company</option>
              <option value="trade_company_floor">Trade → Company → Floor</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {viewPreset === "custom" && [0, 1, 2].map((slot) => (
            <label className="lens-next__field" key={slot}>
              <span>Group {slot + 1}</span>
              <select
                value={customGroupBy[slot] ?? ""}
                onChange={(event) => {
                  const next = [...customGroupBy];
                  const value = event.target.value as LensNextViewDimension;
                  if (value) next[slot] = value;
                  onCustomGroupByChange(next.filter(Boolean).slice(0, 4));
                }}
              >
                {LENS_NEXT_VIEW_DIMENSIONS.map((dimension) => (
                  <option key={dimension} value={dimension}>{dimension}</option>
                ))}
              </select>
            </label>
          ))}
          <small className="lens-next__view-note">Personal grouping changes presentation only. It never changes issue identity, status, or another user’s view.</small>
          <button type="button" disabled={!layoutEnabled || layoutState === "running"} onClick={onMaterializeMyView}>{layoutState === "running" ? "Organizing…" : "Organize Navisworks to match My View"}</button>
          {layoutMessage && <small role="status">{layoutMessage}</small>}
        </div>
      </details>

      <div className="lens-next__browser-grid">
      <section ref={filterPaneRef} className={`lens-next__filters lens-next__filter-pane${workspaceLayout.filtersCollapsed?" lens-next__filter-pane--collapsed":""}`} aria-label="Issue filters">
        <div className="lens-next__filter-heading"><strong>Filters</strong><button type="button" onClick={()=>onFiltersChange({...LENS_NEXT_DEFAULT_FILTERS})}>Reset</button></div>
        <div className="lens-next__pane-size"><label>Filter width <input aria-label="Filter pane width" type="range" min="180" max="360" value={workspaceLayout.filtersWidth} onChange={event=>setWorkspaceLayout(current=>({...current,filtersWidth:Number(event.target.value)}))}/></label></div>
        <label className="lens-next__field lens-next__field--wide">
          <span>Search</span>
          <input
            type="search"
            value={filters.search}
            placeholder="ID, issue, trade, company…"
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label className="lens-next__field">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as LensNextFilters["status"],
              })
            }
          >
            <option value="all">All</option>
            {LENS_NEXT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="lens-next__field">
          <span>Trade</span>
          <select
            value={filters.trade}
            onChange={(event) =>
              onFiltersChange({ ...filters, trade: event.target.value })
            }
          >
            <option value="all">All</option>
            {trades.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
        </label>
        <label className="lens-next__field">
          <span>Floor</span>
          <select
            value={filters.floor}
            onChange={(event) =>
              onFiltersChange({ ...filters, floor: event.target.value })
            }
          >
            <option value="all">All</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </label>
        <label className="lens-next__field">
          <span>Priority</span>
          <select
            value={String(filters.priority)}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                priority:
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
              })
            }
          >
            <option value="all">All</option>
            {[1, 2, 3, 4, 5].map((priority) => (
              <option key={priority} value={priority}>
                P{priority}
              </option>
            ))}
          </select>
        </label>
        <details className="lens-next__filter-more">
          <summary>More issue filters</summary>
          <div className="lens-next__filter-more-grid">
            <label className="lens-next__field">
              <span>Responsible company</span>
              <select value={filters.responsibleCompany} onChange={(event) => onFiltersChange({ ...filters, responsibleCompany: event.target.value })}>
                <option value="all">All</option>
                {filterCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
            <label className="lens-next__field">
              <span>Report type</span>
              <select value={filters.reportType} onChange={(event) => onFiltersChange({ ...filters, reportType: event.target.value })}>
                <option value="all">All</option>
                {filterReportTypes.map((reportType) => <option key={reportType} value={reportType}>{reportType}</option>)}
              </select>
            </label>
            <label className="lens-next__field"><span>Captured from</span><input type="date" value={filters.capturedFrom} onChange={(event) => onFiltersChange({ ...filters, capturedFrom: event.target.value, capturedTo: filters.capturedTo && filters.capturedTo < event.target.value ? "" : filters.capturedTo })} /></label>
            <label className="lens-next__field"><span>Captured through</span><input type="date" min={filters.capturedFrom || undefined} value={filters.capturedTo} onChange={(event) => onFiltersChange({ ...filters, capturedTo: event.target.value })} /></label>
            <label className="lens-next__field">
              <span>{tt("Stored image reference", "Referencia de imagen guardada")}</span>
              <select value={filters.screenshot} onChange={(event) => onFiltersChange({ ...filters, screenshot: event.target.value as LensNextFilters["screenshot"] })}>
                <option value="all">{tt("All", "Todas")}</option><option value="captured">{tt("Recorded", "Registrada")}</option><option value="missing">{tt("Not recorded", "Sin registrar")}</option>
              </select>
            </label>
            <small>These filters use BIMLog issue records. Clash severity and clash source are not available here.</small>
          </div>
        </details>
      </section>

      {(apiError || bridgeError) && (
        <div className="lens-next__alerts" role="status" aria-live="polite">
          {apiError && <p>{apiError}</p>}
          {bridgeError && <p>{bridgeError}</p>}
        </div>
      )}

      <div className="lens-next__list-heading">
        <strong>{filteredIssues.length} {tt("of", "de")} {activeIssueCount} {activeIssueCount === 1 ? tt("issue", "incidencia") : tt("issues", "incidencias")}</strong>
        <div className="lens-next__presentation-toggle" role="group" aria-label={tt("Issue presentation", "Presentación de incidencias")}>
          <button type="button" aria-pressed={issuePresentation === "cards"} onClick={() => setIssuePresentation("cards")}><List aria-hidden="true" size={14} /> {tt("Cards", "Tarjetas")}</button>
          <button type="button" aria-pressed={issuePresentation === "table"} onClick={() => setIssuePresentation("table")}><Table2 aria-hidden="true" size={14} /> {tt("Table", "Tabla")}</button>
        </div>
        <label className="lens-next__list-sort">{tt("Sort", "Ordenar")} <select aria-label={tt("Sort issues", "Ordenar incidencias")} value={issueSort} onChange={event=>onIssueSortChange(event.target.value as LensNextIssueSort)}><option value="priority">{tt("Priority", "Prioridad")}</option><option value="newest">{tt("Newest", "Más recientes")}</option><option value="code">{tt("Issue code", "Código de incidencia")}</option></select></label>
        <small>
          {lastRefreshedAt
            ? `${tt("Updated", "Actualizado")} ${formatTimestamp(lastRefreshedAt)}`
            : tt("Not refreshed", "Sin actualizar")}
        </small>
      </div>
      <section
        ref={issueListRef}
        id="lens-next-issue-list"
        tabIndex={-1}
        className="lens-next__issue-list"
        aria-label="BIMLog issues"
        aria-busy={refreshState === "refreshing"}
      >
        {filteredIssues.length === 0 ? (
          <div className="lens-next__empty" role="status">
            {apiState === "connecting"
              ? "Loading live BIMLog issues…"
              : "No issues match these filters."}
          </div>
        ) : issuePresentation === "cards" ? (
          <IssueGroups
            groups={issueGroups}
            selectedServerId={selectedServerId}
            onSelectIssue={onSelectIssue}
          />
        ) : (
          <IssueTable issues={visibleIssues} selectedServerId={selectedServerId} onSelectIssue={onSelectIssue} />
        )}
          </section>
          <nav className="lens-next__pagination" aria-label="Issue list pages"><button type="button" disabled={issuePage<=1} onClick={()=>onIssuePageChange(issuePage-1)}>Previous</button><span>{filteredIssues.length===0?"0":`${(issuePage-1)*issuePageSize+1}–${Math.min(issuePage*issuePageSize,filteredIssues.length)}`} of {filteredIssues.length} · Page {issuePage} of {issuePageCount}</span><button type="button" disabled={issuePage>=issuePageCount} onClick={()=>onIssuePageChange(issuePage+1)}>Next</button><label>Show <select aria-label="Issues per page" value={issuePageSize} onChange={event=>onIssuePageSizeChange(Number(event.target.value))}>{[20,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label></nav>
          <div className="lens-next__pane-size lens-next__pane-size--list"><label>Issue list width <input aria-label="Issue list width" type="range" min="320" max="640" value={workspaceLayout.listWidth} onChange={event=>setWorkspaceLayout(current=>({...current,listWidth:Number(event.target.value)}))}/></label></div>
        </div>
        </section>

      {selectedIssue ? (
        <section
          ref={selectedIssueRef}
          key={selectedIssue.identity.serverId}
          id="lens-next-selected-issue"
          tabIndex={-1}
          className="lens-next__details"
          aria-label="Selected issue details"
        >
          <header className="lens-next__detail-header">
            <Thumbnail issue={selectedIssue} />
            <div className="lens-next__detail-heading">
              <p className="lens-next__eyebrow">Selected BIMLog issue</p>
              <h3>{displayCode(selectedIssue)}</h3>
              <p>{lensNextIssueDescription(selectedIssue)}</p>
              <div className="lens-next__detail-badges">
                <span className={`lens-next__priority lens-next__priority--${selectedIssue.priority ?? "none"}`}>{lensNextPriorityLabel(selectedIssue.priority)}</span>
                <span className={`lens-next__status lens-next__status--${selectedIssue.status}`}>{STATUS_LABELS[selectedIssue.status]}</span>
              </div>
            </div>
            <div className="lens-next__detail-navigation" aria-label={tt("Selected issue navigation", "Navegación de incidencia seleccionada")}>
              <span aria-live="polite">{selectedFilteredIndex < 0 ? tt("Outside filters", "Fuera de filtros") : `${selectedFilteredIndex + 1} / ${filteredIssues.length}`}</span>
              <button type="button" disabled={!previousIssue} aria-label={tt("Previous issue", "Incidencia anterior")} onClick={() => navigateSelectedIssue("previous")}>
                {tt("Previous", "Anterior")}
              </button>
              <button type="button" disabled={!nextIssue} aria-label={tt("Next issue", "Incidencia siguiente")} onClick={() => navigateSelectedIssue("next")}>
                {tt("Next", "Siguiente")}
              </button>
              <button
                type="button"
                className="lens-next__close"
                aria-label={tt("Close issue details", "Cerrar detalles de la incidencia")}
                onClick={onCloseIssue}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          </header>
          {selectedFilteredIndex < 0 && <p className="lens-next__filter-context" role="status">{tt("This selected issue is outside the current filters.", "Esta incidencia seleccionada está fuera de los filtros actuales.")} <button type="button" onClick={() => onFiltersChange({ ...LENS_NEXT_DEFAULT_FILTERS })}>{tt("Reset filters", "Restablecer filtros")}</button></p>}
          <div className="lens-next__actions lens-next__actions--primary" aria-label="Selected issue actions">
            <button
              type="button"
              className="lens-next__primary"
              disabled={!bridgeOpenEnabled || workingViewState === "opening"}
              onClick={onOpenWorkingView}
            >
              {workingViewState === "opening" ? tt("Opening Working View…", "Abriendo vista de trabajo…") : tt("Open Working View", "Abrir vista de trabajo")}
            </button>
            <button type="button" onClick={() => { setDetailView("activity"); onLoadHistory(); }} disabled={history === "loading"}>
              {history === "loading" ? tt("Loading history…", "Cargando historial…") : tt("View history", "Ver historial")}
            </button>
            <button type="button" disabled={!selectedIssue.publishingAllowed} onClick={() => { setDetailView("bimlog"); window.setTimeout(() => revealSection(linkSectionRef.current), 0); }}>
              {tt("Link BIMLog item", "Vincular elemento BIMLog")}
            </button>
          </div>
          <nav className="lens-next__detail-tabs" aria-label="Issue detail views">
            {(["overview", "knowledge", "resolution", "bimlog", "properties", "activity"] as const).map(view => (
              <button key={view} type="button" aria-pressed={detailView === view} onClick={() => { setDetailView(view); if (view === "activity" && !history && !historyError) onLoadHistory(); }}>
                {view === "overview" ? tt("Overview", "Resumen") : view === "knowledge" ? tt("Coordination Knowledge", "Conocimiento de coordinación") : view === "resolution" ? tt("Resolution", "Resolución") : view === "bimlog" ? tt("BIMLog issue", "Incidencia BIMLog") : view === "properties" ? tt("Properties", "Propiedades") : tt("Activity", "Actividad")}
              </button>
            ))}
          </nav>
          {detailView === "overview" && <section className="lens-next__detail-panel" aria-label="Captured issue overview">
            <CapturedView issue={selectedIssue} />
            <dl className="lens-next__overview-facts">
              <div><dt>{tt("Trade", "Disciplina")}</dt><dd>{selectedIssue.trade || tt("Not recorded", "Sin registrar")}</dd></div>
              <div><dt>{tt("Floor", "Piso")}</dt><dd>{selectedIssue.floor || tt("Not recorded", "Sin registrar")}</dd></div>
              <div><dt>{tt("Report type", "Tipo de informe")}</dt><dd>{selectedIssue.reportType || tt("Not recorded", "Sin registrar")}</dd></div>
              <div><dt>{tt("Responsible company", "Empresa responsable")}</dt><dd>{selectedIssue.responsibleCompany || tt("Unassigned", "Sin asignar")}</dd></div>
            </dl>
            <p className="lens-next__data-boundary">{tt("Clash pair, surrounding geometry, grid and distance are unavailable for this BIMLog issue until an exact project/model-bound clash link is verified. This image is a capture, not interactive 3D.", "El par de interferencia, la geometría cercana, la retícula y la distancia no están disponibles para esta incidencia BIMLog hasta verificar un vínculo exacto con la interferencia del proyecto y modelo. Esta imagen es una captura, no un modelo 3D interactivo.")}</p>
          </section>}
          {detailView === "knowledge" && selectedIssue && <LensNextKnowledgePanel context={knowledgeContext} error={knowledgeError} onRetry={onRetryKnowledge} onClassify={onClassifyKnowledge} activeIssueKey={`${selectedIssue.identity.serverId}:${selectedIssue.identity.revisionNumber}`} />}
          {detailView === "resolution" && selectedIssue && <LensNextResolutionPanel record={resolutionRecord} knowledge={knowledgeContext} evidence={resolutionEvidence} attachments={referenceAttachments} lessonProposal={lessonProposal} error={resolutionError} onRetry={onRetryResolution} onSave={onSaveResolution} onTransition={onTransitionResolution} onAddEvidence={onAddResolutionEvidence} onProposeLesson={onProposeLesson} activeIssueKey={`${selectedIssue.identity.serverId}:${selectedIssue.identity.revisionNumber}`} />}
          {detailView === "properties" && <section className="lens-next__detail-panel" aria-label="Issue properties">
          <details className="lens-next__detail-section" open>
            <summary>Properties and model evidence</summary>
          <dl className="lens-next__detail-properties" aria-label="Issue identity and model evidence">
            <div>
              <dt>Server ID</dt>
              <dd>{selectedIssue.identity.serverId}</dd>
            </div>
            <div>
              <dt>Viewpoint ID</dt>
              <dd>{selectedIssue.identity.viewpointId}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{selectedIssue.identity.revisionNumber}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{selectedIssue.identity.lifecycleStatus}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{STATUS_LABELS[selectedIssue.status]}</dd>
            </div>
            <div>
              <dt>Responsible</dt>
              <dd>{selectedIssue.responsibleCompany ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>BIMLog physical ID</dt>
              <dd>{selectedIssue.bimlogPhysicalId ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Navisworks GUID</dt>
              <dd>{selectedIssue.navisworksGuid ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Visual package</dt>
              <dd>{selectedIssue.visualStateAvailable ? "Available" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Digest evidence</dt>
              <dd>{selectedIssue.visualStateDigest ? "Recorded" : "Not recorded"}</dd>
            </div>
            <div>
              <dt>Captured</dt>
              <dd>{formatTimestamp(selectedIssue.capturedAt)}</dd>
            </div>
            <div>
              <dt>Last synchronized</dt>
              <dd>{formatTimestamp(selectedIssue.syncedAt)}</dd>
            </div>
          </dl>
          </details>
          </section>}
          {detailView === "bimlog" && <section className="lens-next__detail-panel" aria-label="BIMLog issue records and controlled actions">
          <details ref={linkSectionRef} className="lens-next__publisher lens-next__detail-section" aria-label="Linked BIMLog items">
            <summary>Linked BIMLog items{linkedItems && linkedItems !== "loading" ? ` (${linkedItems.links.length})` : ""}</summary>
            <div className="lens-next__detail-section-content">
            <p className="lens-next__section-help">Connect this viewpoint to an existing item in the current BIMLog project.</p>
            {linkedItems === "loading" ? <p role="status">Loading links…</p> : linkedItems && linkedItems.links.length ? (
              <ul>
                {linkedItems.links.map(item => <li key={item.linkId}><strong>{item.type === "rfi" ? "RFI" : "Submittal"}</strong> {item.displayId} — {item.title} {selectedIssue.publishingAllowed && <button type="button" onClick={() => onRemoveLinkedItem(item.linkId)}>Remove</button>}</li>)}
              </ul>
            ) : <p>No linked BIMLog items.</p>}
            {selectedIssue.publishingAllowed && linkedItems && linkedItems !== "loading" && (
              <div className="lens-next__publish-confirm">
                <div className="lens-next__link-type" role="group" aria-label="BIMLog item type"><button type="button" aria-pressed={linkType === "rfi"} onClick={() => { setLinkType("rfi"); setLinkTargetId(""); }}>Link RFI</button><button type="button" aria-pressed={linkType === "submittal"} onClick={() => { setLinkType("submittal"); setLinkTargetId(""); }}>Link Submittal</button></div>
                <label className="lens-next__field lens-next__field--wide"><span>Authoritative BIMLog item</span><select value={linkTargetId} onChange={event => setLinkTargetId(event.target.value)}><option value="">Select an existing item</option>{linkedItems.eligible.filter(item => item.type === linkType && !linkedItems.links.some(link => link.type === item.type && link.authoritativeId === item.authoritativeId)).map(item => <option key={`${item.type}:${item.authoritativeId}`} value={item.authoritativeId}>{item.displayId} — {item.title}</option>)}</select></label>
                <button type="button" className="lens-next__primary" disabled={!linkTargetId} onClick={() => { onLinkBimlogItem(linkType, Number(linkTargetId)); setLinkTargetId(""); }}>{linkType === "rfi" ? "Link RFI" : "Link Submittal"}</button>
              </div>
            )}
            {linkedItemsError && <p className="lens-next__inline-error" role="status">{linkedItemsError}</p>}
            </div>
          </details>
          <details className="lens-next__detail-section lens-next__detail-section--records" aria-label="Reference attachments">
            <summary>Reference attachments{referenceAttachments && referenceAttachments !== "loading" ? ` (${referenceAttachments.attachments.length})` : ""}</summary>
            <div className="lens-next__detail-section-content">
            <p className="lens-next__section-help">Add a small supporting file without changing the viewpoint or its camera.</p>
            {referenceAttachments === "loading" ? <p role="status">Loading references…</p> : referenceAttachments && referenceAttachments.attachments.length ? (
              <ul>{referenceAttachments.attachments.map(attachment => <li key={attachment.linkId}>{attachment.fileName} ({Math.ceil(attachment.fileSize / 1024)} KB) <button type="button" onClick={() => onOpenReferenceAttachment(attachment)}>Open/Download</button> {selectedIssue.publishingAllowed && <button type="button" onClick={() => onRemoveReferenceAttachment(attachment.linkId)}>Remove</button>}</li>)}</ul>
            ) : <p>No reference attachments.</p>}
            {selectedIssue.publishingAllowed && <label className="lens-next__field lens-next__field--wide"><span>Add Reference Attachment (PDF, JPG, PNG; max 5 MB)</span><input aria-label="Add Reference Attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (file.size > 5 * 1024 * 1024) { window.alert("Reference files must be no larger than 5 MB."); return; } onUploadReferenceAttachment(file); }} /></label>}
            {referenceAttachmentsError && <p className="lens-next__inline-error" role="status">{referenceAttachmentsError}</p>}
            </div>
          </details>
          {workingViewUnavailable && (
            <section className="lens-next__visual-repair" aria-label="Repair missing platform visual package">
              <p className="lens-next__inline-notice">
                BIMLog is the source of truth, and this Issue has no complete Visual Package. Open Working View is blocked: Lens Next will not search or capture a local Saved Viewpoint automatically. Display the exact original view in Navisworks, then attach the current view to this exact BIMLog Issue once. Upload is handled separately by the governed synchronization workflow.
              </p>
              <button type="button" disabled={visualRepairState === "repairing"} onClick={onRepairCurrentWorkingView}>
                {visualRepairState === "repairing" ? "Repairing platform package…" : "Repair from current Navisworks view"}
              </button>
              {visualRepairMessage && <p role="status" className={visualRepairState === "error" ? "lens-next__inline-error" : "lens-next__publish-success"}>{visualRepairMessage}</p>}
            </section>
          )}
          <details className="lens-next__publisher lens-next__detail-section lens-next__detail-section--publishing" aria-label="Controlled issue publishing">
            <summary>Publish an issue update</summary>
            <div className="lens-next__detail-section-content">
            {!selectedIssue.publishingAllowed ? (
              <p className="lens-next__inline-error">Your current project role is read-only. No change will be sent.</p>
            ) : (
              <>
                <label className="lens-next__field">
                  <span>Update</span>
                  <select value={publishKind} onChange={event => setPublishKind(event.target.value as LensNextPublishAction["type"])}>
                    <option value="status">Status</option><option value="comment">Comment</option><option value="assignment">Responsible company</option>
                  </select>
                </label>
                {publishKind === "status" ? (
                  <label className="lens-next__field"><span>New status</span><select value={publishStatus} onChange={event => setPublishStatus(event.target.value as LensNextStatus)}>{LENS_NEXT_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
                ) : (
                  <label className="lens-next__field lens-next__field--wide"><span>{publishKind === "comment" ? "Comment" : "Responsible company"}</span><textarea maxLength={publishKind === "comment" ? 4000 : 256} value={publishText} onChange={event => setPublishText(event.target.value)} /></label>
                )}
                <label className="lens-next__field lens-next__field--wide"><span>Reason for audit history</span><textarea maxLength={1000} value={publishReason} onChange={event => setPublishReason(event.target.value)} /></label>
                {!publishReviewReady ? (
                  <button type="button" className="lens-next__primary" disabled={!publishReason.trim() || (publishKind !== "status" && !publishText.trim())} onClick={() => setPublishReviewReady(true)}>Review publication</button>
                ) : (
                  <div className="lens-next__publish-confirm" role="group" aria-label="Confirm controlled publication">
                    <p><strong>Confirm:</strong> {publishKind === "status" ? `set status to ${STATUS_LABELS[publishStatus]}` : publishKind === "comment" ? `record comment “${publishText.trim()}”` : `assign to ${publishText.trim()}`}. This creates an immutable BIMLog audit receipt.</p>
                    <button type="button" className="lens-next__primary" disabled={publishState === "publishing"} onClick={() => onPublishAction(preparedAction, publishReason.trim())}>{publishState === "publishing" ? "Publishing…" : "Confirm publish"}</button>
                    <button type="button" disabled={publishState === "publishing"} onClick={() => setPublishReviewReady(false)}>Cancel</button>
                  </div>
                )}
              </>
            )}
            {publishMessage && <p className={publishState === "error" ? "lens-next__inline-error" : "lens-next__publish-success"} role="status">{publishMessage}</p>}
            </div>
          </details>
          </section>}
          {detailView === "activity" && <section className="lens-next__detail-panel" aria-label="Issue activity and history">
          {(historyError || (history && history !== "loading")) && (
            <details className="lens-next__detail-section lens-next__detail-section--records" open>
              <summary>History and activity</summary>
              <div className="lens-next__detail-section-content">
                {historyError && <p className="lens-next__inline-error" role="status">{historyError}</p>}
                {history && history !== "loading" && <HistoryView history={history} />}
              </div>
            </details>
          )}
          {history === "loading" && <p role="status">{tt("Loading issue history…", "Cargando historial de la incidencia…")}</p>}
          {!history && !historyError && <p role="status">{tt("No history loaded for this issue.", "No se ha cargado el historial de esta incidencia.")}</p>}
          </section>}
        </section>
      ) : (
        <section
          className="lens-next__details lens-next__details--empty"
          aria-label="Selected issue details"
          aria-live="polite"
        >
          <div>
            <p className="lens-next__eyebrow">Issue details</p>
            <h3>Select an issue</h3>
            <p>
              Choose an issue from the list to review its exact BIMLog identity
              and open its temporary Working View.
            </p>
          </div>
        </section>
        )}
      </div>
    </aside>
  );
}
