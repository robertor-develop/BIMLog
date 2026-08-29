import React from "react";
import { ImageOff, X } from "lucide-react";
import { LENS_NEXT_STATUSES } from "./lens-next-types";
import {
  LENS_NEXT_VIEW_DIMENSIONS,
  type LensNextIssueGroupNode,
  type LensNextViewDimension,
  type LensNextViewPresetId,
} from "./lens-next-view-settings";
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

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  follow_up: "Follow up",
  waiting_design: "Waiting design",
  approved: "Approved",
  resolved: "Resolved",
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
  if (!issue.screenshotUrl) {
    return (
      <div
        className="lens-next__thumbnail lens-next__thumbnail--empty"
        role="img"
        aria-label="No thumbnail available"
      >
        <ImageOff aria-hidden="true" size={20} strokeWidth={1.75} />
        <small>No thumbnail available</small>
      </div>
    );
  }
  return (
    <img
      className="lens-next__thumbnail"
      src={issue.screenshotUrl}
      alt={`Viewpoint ${displayCode(issue)}`}
    />
  );
}

function IssueCard({
  issue,
  selected,
  onSelect,
}: {
  issue: LensNextIssue;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className={`lens-next__issue-card${selected ? " lens-next__issue-card--selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`View issue ${displayCode(issue)}`}
    >
      <Thumbnail issue={issue} />
      <span className="lens-next__issue-summary">
        <span className="lens-next__issue-title">
          <strong>{displayCode(issue)}</strong>
          <span
            className={`lens-next__status lens-next__status--${issue.status}`}
          >
            {STATUS_LABELS[issue.status]}
          </span>
        </span>
        <span className="lens-next__issue-note">
          {issue.note ?? issue.openItems ?? "No issue description recorded"}
        </span>
        <span className="lens-next__issue-meta">
          {issue.priority ? `P${issue.priority}` : "No priority"} ·{" "}
          {issue.trade ?? "No trade"} · {issue.floor ?? "No floor"}
        </span>
      </span>
    </button>
  );
}

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
  createState: "idle" | "capturing" | "creating" | "publishing" | "success" | "error";
  createMessage: string | null;
  onCreateViewpoint(draft: LensNextCreateDraft, reason: string): void;
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
  filteredIssues: readonly LensNextIssue[];
  issueGroups: readonly LensNextIssueGroupNode[];
  viewPreset: LensNextViewPresetId;
  customGroupBy: readonly LensNextViewDimension[];
  onViewPresetChange(next: LensNextViewPresetId): void;
  onCustomGroupByChange(next: readonly LensNextViewDimension[]): void;
  selectedServerId: number | null;
  selectedIssue: LensNextIssue | null;
  filters: LensNextFilters;
  onFiltersChange(next: LensNextFilters): void;
  trades: readonly string[];
  floors: readonly string[];
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
  onCreateViewpoint,
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
  filteredIssues,
  issueGroups,
  viewPreset,
  customGroupBy,
  onViewPresetChange,
  onCustomGroupByChange,
  selectedServerId,
  selectedIssue,
  filters,
  onFiltersChange,
  trades,
  floors,
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
  const [publishKind, setPublishKind] = React.useState<LensNextPublishAction["type"]>("status");
  const [publishStatus, setPublishStatus] = React.useState<LensNextStatus>("follow_up");
  const [publishText, setPublishText] = React.useState("");
  const [publishReason, setPublishReason] = React.useState("");
  const [publishReviewReady, setPublishReviewReady] = React.useState(false);
  const [createDraft, setCreateDraft] = React.useState<LensNextCreateDraft>({ trade: "", note: "", responsibleCompany: "", reportType: "COORDINATION", floor: "", priority: 3, openItems: "", status: "open" });
  const [createReason, setCreateReason] = React.useState("");
  const [createReviewReady, setCreateReviewReady] = React.useState(false);
  React.useEffect(() => { setPublishText(""); setPublishReason(""); }, [selectedIssue?.identity.serverId]);
  React.useEffect(() => setPublishReviewReady(false), [publishKind, publishStatus, publishText, publishReason, selectedIssue?.identity.serverId, selectedIssue?.mutationVersion]);
  const preparedAction: LensNextPublishAction = publishKind === "status" ? { type: "status", status: publishStatus } : publishKind === "comment" ? { type: "comment", comment: publishText.trim() } : { type: "assignment", responsibleCompany: publishText.trim() };
  return (
    <aside className="lens-next" aria-label="BIMLog Lens Next controlled issue workspace">
      <header className="lens-next__header">
        <div>
          <p className="lens-next__eyebrow">BIMLog · Controlled publishing</p>
        </div>
        <button
          type="button"
          className="lens-next__refresh"
          onClick={onRefresh}
          disabled={refreshState === "refreshing"}
        >
          {refreshState === "refreshing" ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div
        className="lens-next__connections"
        aria-live="polite"
        aria-label="Connection status"
      >
        <ConnectionBadge label="BIMLog" state={apiState} />
        <ConnectionBadge label="Navisworks" state={bridgeState} />
      </div>

      <div className="lens-next__body">
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
        <section className="lens-next__active-model" aria-label="Active Navisworks model">
          <strong>{bridgeDisplayName ?? "Active Navisworks model"}</strong>
          <small>Automatic binding: {bridgeBindingSource === "navisworks_bimlog_metadata" ? "verified BIMLog viewpoint metadata" : "unavailable"}</small>
          <div className="lens-next__inventory-summary" aria-label="Read-only reconciliation preview">
            <span><strong>{inventorySummary.matched}</strong> matched</span>
            <span><strong>{inventorySummary.platformOnly}</strong> platform only</span>
            <span><strong>{inventorySummary.navisworksOnly}</strong> Navisworks only</span>
            <span><strong>{inventorySummary.conflicted}</strong> conflicts</span>
            <span><strong>{inventorySummary.unresolved}</strong> unresolved</span>
          </div>
          <div className="lens-next__inventory-summary" aria-label="Current-view synchronization plan">
            <span><strong>{synchronizationPlan.inSync}</strong> already synchronized</span>
            <span><strong>{synchronizationPlan.confirmLocalIdentity}</strong> recover confirmation</span>
            <span><strong>{synchronizationPlan.pullFromBimlog}</strong> pull from BIMLog</span>
            <span><strong>{synchronizationPlan.uploadToBimlog}</strong> upload to BIMLog</span>
            <span><strong>{synchronizationPlan.manualConflict}</strong> manual review</span>
            <span><strong>{synchronizationPlan.blocked}</strong> blocked</span>
          </div>
          <small>Current BIMLog view plus exact local-only managed items. A confirmed run pulls complete BIMLog packages first, then uploads exact local-only managed viewpoints. It never overwrites or saves the model.</small>
          <button type="button" disabled={synchronizationPlan.pullFromBimlog === 0 || platformPullState === "running"} onClick={onPullPlatformViewpoints}>
            {platformPullState === "running" ? "Creating Navisworks viewpoints…" : `Pull BIMLog viewpoints into Navisworks (${synchronizationPlan.pullFromBimlog})`}
          </button>
          {platformPullMessage && <small role="status">{platformPullMessage}</small>}
          <button type="button" disabled={!synchronizationPlan.executable || reconciliationState === "running"} onClick={onRunReconciliation}>
            {reconciliationState === "running" ? "Reconciling…" : "Run confirmed reconciliation"}
          </button>
          {!synchronizationPlan.executable && synchronizationPlan.manualConflict + synchronizationPlan.blocked > 0 && <small role="alert">Resolve every manual-review and blocked item before reconciliation can change either system.</small>}
          {reconciliationMessage && <small role="status">{reconciliationMessage}</small>}
          <details className="lens-next__sync-plan">
            <summary>Review synchronization plan ({synchronizationPlan.items.length} items)</summary>
            <ol>
              {synchronizationPlan.items.map((item, index) => (
                <li key={`${item.platformServerId ?? "local"}:${item.localNavisworksGuid ?? "platform"}:${index}`}>
                  <strong>{item.displayId}</strong> · {item.disposition.replaceAll("_", " ")}
                  <small>{item.reason}</small>
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
        </section>
      )}

      <details className="lens-next__create" open>
        <summary>Create BIMLog viewpoint</summary>
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
          <button className="lens-next__create-button" type="button" disabled={!createEnabled || !createDraft.trade.trim() || !createDraft.floor.trim() || !createDraft.note.trim() || !createDraft.reportType.trim()} onClick={() => setCreateReviewReady(true)}>Create BIMLog viewpoint</button>
        ) : (
          <div className="lens-next__create-review"><p>Create one BIMLog issue and visual package first, then create one local Navisworks Saved Viewpoint. The model file will not be saved automatically.</p><button className="lens-next__create-button" type="button" disabled={createState !== "idle" && createState !== "success" && createState !== "error"} onClick={() => { onCreateViewpoint(createDraft, createReason.trim()); setCreateReviewReady(false); }}>Confirm and create BIMLog viewpoint</button></div>
        )}
        {createMessage && <p role="status">{createMessage}</p>}
      </details>

      <section className="lens-next__view-settings" aria-label="Personal issue view">
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
      </section>

      <section className="lens-next__filters" aria-label="Issue filters">
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
      </section>

      {(apiError || bridgeError) && (
        <div className="lens-next__alerts" role="status" aria-live="polite">
          {apiError && <p>{apiError}</p>}
          {bridgeError && <p>{bridgeError}</p>}
        </div>
      )}

      <div className="lens-next__list-heading">
        <strong>{filteredIssues.length} issues</strong>
        <small>
          {lastRefreshedAt
            ? `Updated ${formatTimestamp(lastRefreshedAt)}`
            : "Not refreshed"}
        </small>
      </div>
      <section
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
        ) : (
          <IssueGroups
            groups={issueGroups}
            selectedServerId={selectedServerId}
            onSelectIssue={onSelectIssue}
          />
        )}
          </section>
        </section>

      {selectedIssue ? (
        <section
          className="lens-next__details"
          aria-label="Selected issue details"
        >
          <header>
            <div>
              <p className="lens-next__eyebrow">Exact BIMLog identity</p>
              <h3>{displayCode(selectedIssue)}</h3>
            </div>
            <button
              type="button"
              className="lens-next__close"
              aria-label="Close issue details"
              onClick={onCloseIssue}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <dl>
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
          </dl>
          <p>
            {selectedIssue.note ??
              selectedIssue.openItems ??
              "No issue description recorded."}
          </p>
          <div className="lens-next__actions">
            <button
              type="button"
              className="lens-next__primary"
              disabled={!bridgeOpenEnabled}
              onClick={onOpenWorkingView}
            >
              Open working view
            </button>
            <button
              type="button"
              onClick={onLoadHistory}
              disabled={history === "loading"}
            >
              {history === "loading" ? "Loading history…" : "View history"}
            </button>
          </div>
          {workingViewUnavailable && (
            <section className="lens-next__visual-repair" aria-label="Repair missing platform visual package">
              <p className="lens-next__inline-notice">
                This platform record has no complete visual package or exact Navisworks identity. Open its original Saved Viewpoint manually, then attach the current view to this exact BIMLog record once.
              </p>
              <button type="button" disabled={visualRepairState === "repairing"} onClick={onRepairCurrentWorkingView}>
                {visualRepairState === "repairing" ? "Repairing platform package…" : "Repair from current Navisworks view"}
              </button>
              {visualRepairMessage && <p role="status" className={visualRepairState === "error" ? "lens-next__inline-error" : "lens-next__publish-success"}>{visualRepairMessage}</p>}
            </section>
          )}
          <section className="lens-next__publisher" aria-label="Controlled issue publishing">
            <h4>Publish an issue update</h4>
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
          </section>
          {historyError && (
            <p className="lens-next__inline-error" role="status">
              {historyError}
            </p>
          )}
          {history && history !== "loading" && (
            <HistoryView history={history} />
          )}
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
