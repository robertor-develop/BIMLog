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
  LensNextFilters,
  LensNextHistory,
  LensNextIssue,
  LensNextProjectOption,
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
  apiState: LensNextConnectionState;
  bridgeState: LensNextConnectionState;
  refreshState: LensNextRefreshState;
  apiError: string | null;
  bridgeError: string | null;
  history: LensNextHistory | "loading" | null;
  historyError: string | null;
  lastRefreshedAt: string | null;
  bridgeOpenEnabled: boolean;
  onRefresh(): void;
  onSelectIssue(serverId: number): void;
  onCloseIssue(): void;
  onOpenWorkingView(): void;
  onLoadHistory(): void;
}

export function LensNextPanelView({
  authorizedProjects,
  selectedProjectId,
  onProjectChange,
  projectLocked,
  bridgeDisplayName,
  bridgeModelFingerprint,
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
  apiState,
  bridgeState,
  refreshState,
  apiError,
  bridgeError,
  history,
  historyError,
  lastRefreshedAt,
  bridgeOpenEnabled,
  onRefresh,
  onSelectIssue,
  onCloseIssue,
  onOpenWorkingView,
  onLoadHistory,
}: LensNextPanelViewProps) {
  return (
    <aside className="lens-next" aria-label="BIMLog Lens Next read-only panel">
      <header className="lens-next__header">
        <div>
          <p className="lens-next__eyebrow">BIMLog · Read only</p>
          <h2>Lens Next</h2>
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
          {bridgeModelFingerprint && <small>Model {bridgeModelFingerprint.slice(0, 12)}…</small>}
        </section>
      )}

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
