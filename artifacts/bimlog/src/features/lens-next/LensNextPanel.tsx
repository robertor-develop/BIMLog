import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LensNextPanelView } from "./LensNextPanelView";
import {
  createLensNextApiClient,
  createLensNextBridgeClient,
  type LensNextApiClient,
  type LensNextBridgeClient,
} from "./lens-next-client";
import {
  assertAuthorizedLensNextProject,
  filterLensNextIssues,
  normalizeLensNextProjects,
  reconcileLensNextRefresh,
} from "./lens-next-model";
import {
  LENS_NEXT_DEFAULT_FILTERS,
  type LensNextBridgeProjectContext,
  type LensNextConnectionState,
  type LensNextFilters,
  type LensNextHistory,
  type LensNextIssue,
  type LensNextPublishAction,
  type LensNextProjectOption,
  type LensNextRefreshState,
} from "./lens-next-types";
import {
  buildLensNextIssueGroups,
  LENS_NEXT_VIEW_PRESETS,
  type LensNextViewDimension,
  type LensNextViewPresetId,
  type LensNextViewSettings,
} from "./lens-next-view-settings";
import "./lens-next-panel.css";

export interface LensNextPanelProps {
  projects: readonly LensNextProjectOption[];
  selectedProjectId: number | null;
  onProjectChange(projectId: number): void;
  projectLocked?: boolean;
  authToken: string;
  bridgeSessionToken: string;
  apiBaseUrl?: string;
  autoRefreshMs?: number;
  fetchImpl?: typeof fetch;
}

export function LensNextPanel({
  projects,
  selectedProjectId,
  onProjectChange,
  projectLocked = false,
  authToken,
  bridgeSessionToken,
  apiBaseUrl = "/api/v1",
  autoRefreshMs = 10_000,
  fetchImpl,
}: LensNextPanelProps) {
  const authorizedProjects = useMemo(
    () => normalizeLensNextProjects(projects),
    [projects],
  );
  const apiClient = useMemo<LensNextApiClient | null>(() => {
    if (!authToken.trim()) return null;
    return createLensNextApiClient({ token: authToken, apiBaseUrl, fetchImpl });
  }, [apiBaseUrl, authToken, fetchImpl]);
  const bridgeClient = useMemo<LensNextBridgeClient | null>(() => {
    if (!bridgeSessionToken.trim()) return null;
    return createLensNextBridgeClient({
      sessionToken: bridgeSessionToken,
      fetchImpl,
    });
  }, [bridgeSessionToken, fetchImpl]);

  const [issues, setIssues] = useState<readonly LensNextIssue[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [filters, setFilters] = useState<LensNextFilters>({
    ...LENS_NEXT_DEFAULT_FILTERS,
  });
  const [viewPreset, setViewPreset] = useState<LensNextViewPresetId>("status_only");
  const [customGroupBy, setCustomGroupBy] = useState<readonly LensNextViewDimension[]>([
    "status",
    "floor",
    "trade",
  ]);
  const [apiState, setApiState] = useState<LensNextConnectionState>("idle");
  const [bridgeState, setBridgeState] =
    useState<LensNextConnectionState>("idle");
  const [bridgeContext, setBridgeContext] =
    useState<LensNextBridgeProjectContext | null>(null);
  const [refreshState, setRefreshState] =
    useState<LensNextRefreshState>("idle");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [history, setHistory] = useState<LensNextHistory | "loading" | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const publishAttempt = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const authorizedProjectId = useMemo(() => {
    if (selectedProjectId === null) return null;
    try {
      return assertAuthorizedLensNextProject(
        selectedProjectId,
        authorizedProjects,
      );
    } catch {
      return null;
    }
  }, [authorizedProjects, selectedProjectId]);

  const selectedIssue = useMemo(
    () =>
      issues.find((issue) => issue.identity.serverId === selectedServerId) ??
      null,
    [issues, selectedServerId],
  );
  const filteredIssues = useMemo(
    () => filterLensNextIssues(issues, filters),
    [filters, issues],
  );

  useEffect(() => {
    if (authorizedProjectId === null) return;
    try {
      const raw = window.localStorage.getItem(`bimlog.lens_next.view.${authorizedProjectId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { preset?: LensNextViewPresetId; groupBy?: LensNextViewDimension[] };
      if (saved.preset && (saved.preset === "custom" || Object.prototype.hasOwnProperty.call(LENS_NEXT_VIEW_PRESETS, saved.preset))) {
        setViewPreset(saved.preset);
      }
      if (Array.isArray(saved.groupBy) && saved.groupBy.length > 0) setCustomGroupBy(saved.groupBy.slice(0, 4));
    } catch {
      // Personal presentation settings are non-authoritative; invalid local state is ignored.
    }
  }, [authorizedProjectId]);

  useEffect(() => {
    if (authorizedProjectId === null) return;
    try {
      window.localStorage.setItem(
        `bimlog.lens_next.view.${authorizedProjectId}`,
        JSON.stringify({ preset: viewPreset, groupBy: customGroupBy }),
      );
    } catch {
      // View settings remain usable in-memory when browser persistence is unavailable.
    }
  }, [authorizedProjectId, customGroupBy, viewPreset]);

  const viewSettings = useMemo<LensNextViewSettings | null>(() => {
    if (authorizedProjectId === null) return null;
    return {
      id: `panel-view:${authorizedProjectId}`,
      name: "My coordination view",
      scope: "personal",
      preset: viewPreset,
      groupBy: viewPreset === "custom" ? customGroupBy : LENS_NEXT_VIEW_PRESETS[viewPreset],
      hideResolved: false,
      statuses: [],
      priorityMaximum: null,
      ownerUserId: "current-user",
      projectId: authorizedProjectId,
      updatedAt: new Date().toISOString(),
    };
  }, [authorizedProjectId, customGroupBy, viewPreset]);

  const issueGroups = useMemo(
    () => (viewSettings ? buildLensNextIssueGroups(filteredIssues, viewSettings) : []),
    [filteredIssues, viewSettings],
  );
  const trades = useMemo(
    () =>
      [
        ...new Set(
          issues
            .map((issue) => issue.trade)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [issues],
  );
  const floors = useMemo(
    () =>
      [
        ...new Set(
          issues
            .map((issue) => issue.floor)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [issues],
  );

  const loadIssues = useCallback(
    async (mode: "initial" | "refresh", signal?: AbortSignal) => {
      const sequence = ++refreshSequence.current;
      if (!apiClient || authorizedProjectId === null) {
        setIssues([]);
        setApiState(authToken.trim() ? "error" : "disconnected");
        setRefreshState("idle");
        setApiError(
          authToken.trim()
            ? "Select an authenticated project."
            : "Authenticated BIMLog session required.",
        );
        return;
      }
      if (mode === "initial") setApiState("connecting");
      setRefreshState("refreshing");
      setApiError(null);
      try {
        const incoming = await apiClient.loadIssues(
          authorizedProjectId,
          signal,
        );
        if (sequence !== refreshSequence.current || signal?.aborted) return;
        setIssues((current) => reconcileLensNextRefresh(current, incoming));
        setSelectedServerId((current) =>
          current !== null &&
          incoming.some((issue) => issue.identity.serverId === current)
            ? current
            : null,
        );
        setApiState("connected");
        setRefreshState("fresh");
        setLastRefreshedAt(new Date().toISOString());
      } catch (error) {
        if (signal?.aborted || sequence !== refreshSequence.current) return;
        setApiState("error");
        setRefreshState("error");
        setApiError(
          error instanceof Error ? error.message : "BIMLog read failed",
        );
      }
    },
    [apiClient, authToken, authorizedProjectId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIssues([]);
    setSelectedServerId(null);
    setHistory(null);
    setHistoryError(null);
    void loadIssues("initial", controller.signal);
    return () => controller.abort();
  }, [loadIssues]);

  useEffect(() => {
    if (autoRefreshMs < 10_000 || authorizedProjectId === null || !apiClient)
      return;
    const timer = window.setInterval(
      () => void loadIssues("refresh"),
      autoRefreshMs,
    );
    return () => window.clearInterval(timer);
  }, [apiClient, authorizedProjectId, autoRefreshMs, loadIssues]);

  useEffect(() => {
    const controller = new AbortController();
    if (!bridgeClient) {
      setBridgeState("disconnected");
      setBridgeContext(null);
      setBridgeError("Lens Next bridge session unavailable.");
      return () => controller.abort();
    }
    setBridgeState("connecting");
    setBridgeError(null);
    void (async () => {
      try {
        const connected = await bridgeClient.probe(controller.signal);
        if (!connected)
          throw new Error(
            "Lens Next bridge is not reachable at 127.0.0.1:8766.",
          );
        const context = await bridgeClient.loadProjectContext(
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setBridgeContext(context);
        setBridgeState("connected");
      } catch (error) {
        if (controller.signal.aborted) return;
        setBridgeContext(null);
        setBridgeState("error");
        setBridgeError(
          error instanceof Error
            ? error.message
            : "Lens Next bridge connection failed.",
        );
      }
    })();
    return () => controller.abort();
  }, [bridgeClient]);

  const loadHistory = useCallback(async () => {
    if (!apiClient || !selectedIssue) return;
    setHistory("loading");
    setHistoryError(null);
    try {
      setHistory(await apiClient.loadHistory(selectedIssue.identity));
    } catch (error) {
      setHistory(null);
      setHistoryError(
        error instanceof Error ? error.message : "History read failed",
      );
    }
  }, [apiClient, selectedIssue]);

  const openWorkingView = useCallback(async () => {
    if (
      !bridgeClient ||
      !bridgeContext ||
      !selectedIssue ||
      authorizedProjectId === null
    )
      return;
    if (selectedIssue.identity.projectId !== authorizedProjectId) {
      setBridgeError(
        "Selected issue identity does not belong to the authenticated project.",
      );
      return;
    }
    if (bridgeContext.projectId !== authorizedProjectId) {
      setBridgeError(
        "The active Navisworks model is not bound to the selected BIMLog project.",
      );
      return;
    }
    setBridgeState("connecting");
    setBridgeError(null);
    try {
      await bridgeClient.openWorkingView(selectedIssue, bridgeContext);
      setBridgeState("connected");
    } catch (error) {
      setBridgeState("error");
      setBridgeError(
        error instanceof Error ? error.message : "Exact-identity open failed",
      );
    }
  }, [authorizedProjectId, bridgeClient, bridgeContext, selectedIssue]);

  const publishAction = useCallback(async (action: LensNextPublishAction, reason: string) => {
    if (!apiClient || !selectedIssue || !selectedIssue.publishingAllowed) return;
    const fingerprint = JSON.stringify({ serverId: selectedIssue.identity.serverId, mutationVersion: selectedIssue.mutationVersion, action, reason });
    if (!publishAttempt.current || publishAttempt.current.fingerprint !== fingerprint) {
      publishAttempt.current = { fingerprint, idempotencyKey: `lens-next-ui-${crypto.randomUUID()}` };
    }
    setPublishState("publishing");
    setPublishMessage(null);
    try {
      const result = await apiClient.publishAction(selectedIssue, action, reason, publishAttempt.current.idempotencyKey, bridgeContext?.modelFingerprint ?? null);
      setIssues(current => current.map(issue => issue.identity.serverId === result.issue.serverId ? {
        ...issue,
        mutationVersion: result.issue.mutationVersion,
        status: result.issue.status,
        responsibleCompany: result.issue.responsibleCompany,
      } : issue));
      publishAttempt.current = null;
      setPublishState("published");
      setPublishMessage(result.replayed ? "The prior verified publication receipt was returned." : "Published with an immutable BIMLog audit receipt.");
      setHistory(null);
    } catch (error) {
      setPublishState("error");
      setPublishMessage(error instanceof Error ? error.message : "Controlled publication failed");
    }
  }, [apiClient, bridgeContext?.modelFingerprint, selectedIssue]);

  return (
    <LensNextPanelView
      authorizedProjects={authorizedProjects}
      selectedProjectId={selectedProjectId}
      onProjectChange={onProjectChange}
      projectLocked={projectLocked}
      bridgeDisplayName={bridgeContext?.displayName ?? null}
      bridgeModelFingerprint={bridgeContext?.modelFingerprint ?? null}
      filteredIssues={filteredIssues}
      issueGroups={issueGroups}
      viewPreset={viewPreset}
      customGroupBy={customGroupBy}
      onViewPresetChange={setViewPreset}
      onCustomGroupByChange={(next) => { setCustomGroupBy(next); setViewPreset("custom"); }}
      selectedServerId={selectedServerId}
      selectedIssue={selectedIssue}
      filters={filters}
      onFiltersChange={setFilters}
      trades={trades}
      floors={floors}
      apiState={apiState}
      bridgeState={bridgeState}
      refreshState={refreshState}
      apiError={apiError}
      bridgeError={bridgeError}
      history={history}
      historyError={historyError}
      lastRefreshedAt={lastRefreshedAt}
      bridgeOpenEnabled={
        bridgeState === "connected" &&
        bridgeContext?.projectId === authorizedProjectId
      }
      onRefresh={() => void loadIssues("refresh")}
      onSelectIssue={(serverId) => {
        setSelectedServerId(serverId);
        setHistory(null);
        setHistoryError(null);
        publishAttempt.current = null;
        setPublishState("idle");
        setPublishMessage(null);
      }}
      onCloseIssue={() => {
        setSelectedServerId(null);
        publishAttempt.current = null;
        setPublishState("idle");
        setPublishMessage(null);
      }}
      onOpenWorkingView={() => void openWorkingView()}
      onLoadHistory={() => void loadHistory()}
      publishState={publishState}
      publishMessage={publishMessage}
      onPublishAction={(action, reason) => void publishAction(action, reason)}
    />
  );
}
