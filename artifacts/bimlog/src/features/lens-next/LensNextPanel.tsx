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
  reconcileLensNextInventories,
  planLensNextSynchronization,
} from "./lens-next-model";
import {
  LENS_NEXT_DEFAULT_FILTERS,
  type LensNextBridgeProjectContext,
  type LensNextConnectionState,
  type LensNextCreateDraft,
  type LensNextFilters,
  type LensNextHistory,
  type LensNextIssue,
  type LensNextLocalInventory,
  type LensNextLocalViewpoint,
  type LensNextLayoutItem,
  type LensNextCreateReceipt,
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
import { openBimlogWorkingView } from "./lens-next-working-view";

const LENS_NEXT_TRADE_OPTIONS = [
  "Fire Protection", "Plumbing", "HVAC", "Electrical", "Structural",
  "Architectural", "Mechanical", "General Contractor", "Owner", "Other",
] as const;
const LENS_NEXT_REPORT_TYPE_OPTIONS = ["SHOP", "SLEEVE", "COORDINATION", "FIELD", "OTHER"] as const;
const LENS_NEXT_FALLBACK_FLOORS = ["CELLAR", "1", "2", "3", "4", "5", "ROOF", "Other"] as const;

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
  const [referenceFloors, setReferenceFloors] = useState<readonly string[]>([]);
  const [responsibleCompanies, setResponsibleCompanies] = useState<readonly string[]>([]);
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
  const [localInventory, setLocalInventory] = useState<LensNextLocalInventory | null>(null);
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
  const [localUploadState, setLocalUploadState] = useState<"idle" | "capturing" | "uploading" | "success" | "error">("idle");
  const [localUploadMessage, setLocalUploadMessage] = useState<string | null>(null);
  const [createState, setCreateState] = useState<"idle" | "capturing" | "creating" | "publishing" | "success" | "error">("idle");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [layoutState, setLayoutState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);
  const [reconciliationState, setReconciliationState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);
  const [platformPullState, setPlatformPullState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [platformPullMessage, setPlatformPullMessage] = useState<string | null>(null);

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
  const inventorySummary = useMemo(
    () => reconcileLensNextInventories(issues, localInventory),
    [issues, localInventory],
  );
  const synchronizationPlan = useMemo(
    () => planLensNextSynchronization(filteredIssues, localInventory, issues),
    [filteredIssues, issues, localInventory],
  );
  const uploadableLocalViewpoints = useMemo(() => {
    if (!localInventory) return [];
    const guids = new Set(synchronizationPlan.items.filter(item => item.disposition === "upload_to_bimlog" && item.localNavisworksGuid).map(item => item.localNavisworksGuid!.toLowerCase()));
    return localInventory.viewpoints.filter(viewpoint => viewpoint.exactManagedIdentity && viewpoint.serverId === null && guids.has(viewpoint.navisworksGuid.toLowerCase()));
  }, [localInventory, synchronizationPlan]);

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
          [...LENS_NEXT_TRADE_OPTIONS, ...issues
            .map((issue) => issue.trade)
            .filter((value): value is string => Boolean(value))],
        ),
      ].sort(),
    [issues],
  );
  const floors = useMemo(
    () =>
      [
        ...new Set(
          [...(referenceFloors.length ? referenceFloors : LENS_NEXT_FALLBACK_FLOORS), ...issues
            .map((issue) => issue.floor)
            .filter((value): value is string => Boolean(value))],
        ),
      ].sort(),
    [issues, referenceFloors],
  );
  const createResponsibleCompanies = useMemo(
    () => [...new Set([...responsibleCompanies, ...issues.map(issue => issue.responsibleCompany).filter((value): value is string => Boolean(value)), "Other"])].sort(),
    [issues, responsibleCompanies],
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
        const [incoming, referenceData] = await Promise.all([
          apiClient.loadIssues(authorizedProjectId, signal),
          apiClient.loadReferenceData(authorizedProjectId, signal),
        ]);
        if (sequence !== refreshSequence.current || signal?.aborted) return;
        setIssues((current) => reconcileLensNextRefresh(current, incoming));
        setReferenceFloors(referenceData.floors);
        setResponsibleCompanies(referenceData.responsibleCompanies);
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
      setLocalInventory(null);
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
        const inventory = await bridgeClient.loadLocalInventory(controller.signal);
        if (controller.signal.aborted) return;
        if (inventory.projectId !== context.projectId || inventory.modelFingerprint !== context.modelFingerprint.toLowerCase())
          throw new Error("Navisworks binding and local inventory disagree; read-only startup was refused.");
        setBridgeContext(context);
        setLocalInventory(inventory);
        setBridgeState("connected");
      } catch (error) {
        if (controller.signal.aborted) return;
        setBridgeContext(null);
        setLocalInventory(null);
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
    setBridgeError(null);
    try {
      if (!apiClient) throw new Error("BIMLog visual-state client is unavailable");
      const result = await openBimlogWorkingView(
        { apiClient, bridgeClient },
        selectedIssue,
        bridgeContext,
      );
      if (result.migratedHistoricalViewpoint) {
        setBridgeError("Historical Original Lens viewpoint recovered by exact identity and stored in BIMLog.");
        await loadIssues("refresh");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Exact-identity open failed";
      setBridgeError(message);
    }
  }, [apiClient, authorizedProjectId, bridgeClient, bridgeContext, loadIssues, selectedIssue]);

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

  const uploadLocalViewpoint = useCallback(async (viewpoint: LensNextLocalViewpoint) => {
    if (!apiClient || !bridgeClient || !bridgeContext || authorizedProjectId === null) return;
    if (viewpoint.projectId !== authorizedProjectId || bridgeContext.projectId !== authorizedProjectId) { setLocalUploadState("error"); setLocalUploadMessage("Project/model identity mismatch; upload refused."); return; }
    const reason = window.prompt(`Reason for uploading ${viewpoint.displayId ?? viewpoint.viewpointId} from Navisworks into BIMLog:`)?.trim();
    if (!reason || !window.confirm(`Create one new BIMLog record and visual package for ${viewpoint.displayId ?? viewpoint.viewpointId}? Existing BIMLog records will not be overwritten.`)) return;
    setLocalUploadMessage(null); setLocalUploadState("capturing");
    try {
      const captured = await bridgeClient.captureLocalViewpoint(viewpoint, bridgeContext);
      setLocalUploadState("uploading");
      const receipt = await apiClient.uploadLocalViewpoint(viewpoint, bridgeContext.modelFingerprint, captured.visualState, reason);
      setLocalUploadState("success"); setLocalUploadMessage(`Created BIMLog server record ${receipt.serverId} with a verified visual package.`);
      setLocalInventory(await bridgeClient.loadLocalInventory());
      await loadIssues("refresh");
    } catch (error) { setLocalUploadState("error"); setLocalUploadMessage(error instanceof Error ? error.message : "Atomic local upload failed; no partial record was committed."); }
  }, [apiClient, authorizedProjectId, bridgeClient, bridgeContext, loadIssues]);

  const createViewpoint = useCallback(async (draft: LensNextCreateDraft, reason: string) => {
    if (!apiClient || !bridgeClient || !bridgeContext || authorizedProjectId === null || bridgeContext.projectId !== authorizedProjectId) return;
    const viewpointId = crypto.randomUUID();
    const auditReason = reason.trim() || "Created through Lens Next";
    setCreateMessage(null); setCreateState("capturing");
    try {
      const visualState = await bridgeClient.captureNewViewpoint(viewpointId, bridgeContext);
      setCreateState("creating");
      const receipt = await apiClient.createViewpoint(authorizedProjectId, viewpointId, bridgeContext.modelFingerprint, visualState, draft, auditReason);
      setCreateState("publishing");
      try {
        const navisworksGuid = await bridgeClient.publishCreatedViewpoint(receipt, bridgeContext, auditReason);
        try {
          await apiClient.confirmCreatedLocalViewpoint(authorizedProjectId, receipt, navisworksGuid, auditReason);
        } catch (confirmationError) {
          setCreateState("error");
          setCreateMessage(`Created ${receipt.displayCode} in BIMLog and Navisworks, but BIMLog could not record local identity ${navisworksGuid}: ${confirmationError instanceof Error ? confirmationError.message : "identity confirmation failed"}. Do not create a duplicate.`);
          await loadIssues("refresh");
          return;
        }
        setCreateState("success");
        setCreateMessage(`Created ${receipt.displayCode} in BIMLog and Navisworks. Save the NWF/NWD when ready.`);
      } catch (localError) {
        setCreateState("error");
        setCreateMessage(`BIMLog created ${receipt.displayCode} with its visual package, but Navisworks did not create the local Saved Viewpoint: ${localError instanceof Error ? localError.message : "local creation failed"}`);
      }
      await loadIssues("refresh");
    } catch (error) {
      setCreateState("error");
      setCreateMessage(error instanceof Error ? error.message : "Viewpoint creation failed");
    }
  }, [apiClient, authorizedProjectId, bridgeClient, bridgeContext, loadIssues]);

  const materializeMyView = useCallback(async () => {
    if (!bridgeClient || !bridgeContext || authorizedProjectId === null || bridgeContext.projectId !== authorizedProjectId || !viewSettings) return;
    const dimensions = viewSettings.groupBy;
    const value = (issue: LensNextIssue, dimension: LensNextViewDimension) => dimension === "status" ? issue.status : dimension === "floor" ? issue.floor : dimension === "trade" ? issue.trade : dimension === "responsibleCompany" ? issue.responsibleCompany : dimension === "priority" ? (issue.priority ? `P${issue.priority}` : null) : dimension === "reportType" ? issue.reportType : null;
    const publishedGuids = new Set((localInventory?.viewpoints ?? []).filter(viewpoint => viewpoint.lensNextPublished).map(viewpoint => viewpoint.navisworksGuid.toLowerCase()));
    const items: LensNextLayoutItem[] = filteredIssues.filter(issue => Boolean(issue.navisworksGuid) && publishedGuids.has(issue.navisworksGuid!.toLowerCase())).map(issue => ({ navisworksGuid: issue.navisworksGuid!, folderPath: dimensions.map(dimension => value(issue, dimension)?.trim() || `Unassigned ${dimension}`).join("/") }));
    if (!items.length) { setLayoutState("error"); setLayoutMessage("No exact local Lens Next-published viewpoints are available for this My View."); return; }
    const reason = window.prompt("Reason for materializing this My View folder layout in Navisworks:")?.trim();
    if (!reason || !window.confirm(`Organize ${items.length} exact Lens Next-published Saved Viewpoint(s) under the dedicated My View root? Original Lens and unmanaged folders will not be changed.`)) return;
    setLayoutState("running"); setLayoutMessage(null);
    try { const receipt = await bridgeClient.materializeMyView(items, bridgeContext, reason); setLayoutState("success"); setLayoutMessage(`My View organized: ${receipt.moved} moved, ${receipt.alreadyPlaced} already placed. Save the NWF/NWD when ready.`); setLocalInventory(await bridgeClient.loadLocalInventory()); }
    catch (error) { setLayoutState("error"); setLayoutMessage(error instanceof Error ? error.message : "My View materialization failed"); }
  }, [authorizedProjectId, bridgeClient, bridgeContext, filteredIssues, localInventory, viewSettings]);

  const runReconciliation = useCallback(async () => {
    if (!apiClient || !bridgeClient || !bridgeContext || !localInventory || authorizedProjectId === null || bridgeContext.projectId !== authorizedProjectId) return;
    if (synchronizationPlan.manualConflict > 0 || synchronizationPlan.blocked > 0 || !synchronizationPlan.executable) {
      setReconciliationState("error");
      setReconciliationMessage("Reconciliation refused before mutation: every manual-review and blocked item must be resolved first.");
      return;
    }
    const confirmations = synchronizationPlan.items.filter(item => item.disposition === "confirm_local_identity");
    const pulls = synchronizationPlan.items.filter(item => item.disposition === "pull_from_bimlog");
    const uploads = synchronizationPlan.items.filter(item => item.disposition === "upload_to_bimlog");
    const reason = window.prompt(`Reason for reconciling ${confirmations.length} recovered identity confirmation(s), ${pulls.length} BIMLog pull(s), and ${uploads.length} Navisworks upload(s):`)?.trim();
    if (!reason || !window.confirm(`Run one reconciliation now? BIMLog packages will be pulled first, then exact local-only managed viewpoints will be uploaded. Existing records will not be overwritten and the NWF/NWD will not be saved automatically.`)) return;
    setReconciliationState("running"); setReconciliationMessage(null);
    let confirmed = 0; let pulled = 0; let uploaded = 0;
    try {
      for (const item of confirmations) {
        const issue = issues.find(candidate => candidate.identity.serverId === item.platformServerId);
        const viewpoint = localInventory.viewpoints.find(candidate => candidate.navisworksGuid.toLowerCase() === item.localNavisworksGuid?.toLowerCase());
        if (!issue || issue.navisworksGuid || !issue.visualStateDigest || !viewpoint || viewpoint.serverId !== issue.identity.serverId || !viewpoint.exactManagedIdentity) throw new Error(`${item.displayId} is no longer an exact recoverable identity; the run stopped.`);
        const receipt: LensNextCreateReceipt = { serverId: issue.identity.serverId, viewpointId: issue.identity.viewpointId, visualStateDigest: issue.visualStateDigest, revisionNumber: issue.identity.revisionNumber, lifecycleStatus: issue.identity.lifecycleStatus, displayCode: issue.displayId ?? issue.identity.viewpointId };
        await apiClient.confirmCreatedLocalViewpoint(authorizedProjectId, receipt, viewpoint.navisworksGuid, reason);
        confirmed += 1;
      }
      for (const item of pulls) {
        const issue = issues.find(candidate => candidate.identity.serverId === item.platformServerId);
        if (!issue || issue.navisworksGuid || !issue.visualStateAvailable || !issue.visualStateDigest) throw new Error(`${item.displayId} is no longer an unbound BIMLog package; the run stopped.`);
        const stored = await apiClient.loadVisualState(issue);
        await bridgeClient.applyPlatformWorkingView(issue, bridgeContext, stored.visualStateJson);
        const receipt: LensNextCreateReceipt = { serverId: issue.identity.serverId, viewpointId: issue.identity.viewpointId, visualStateDigest: stored.visualStateDigest, revisionNumber: issue.identity.revisionNumber, lifecycleStatus: issue.identity.lifecycleStatus, displayCode: issue.displayId ?? issue.identity.viewpointId };
        const navisworksGuid = await bridgeClient.publishCreatedViewpoint(receipt, bridgeContext, reason);
        await apiClient.confirmCreatedLocalViewpoint(authorizedProjectId, receipt, navisworksGuid, reason);
        pulled += 1;
      }
      for (const item of uploads) {
        const viewpoint = localInventory.viewpoints.find(candidate => candidate.navisworksGuid.toLowerCase() === item.localNavisworksGuid?.toLowerCase());
        if (!viewpoint || !viewpoint.exactManagedIdentity || viewpoint.serverId !== null) throw new Error(`${item.displayId} is no longer an exact local-only managed viewpoint; the run stopped.`);
        const captured = await bridgeClient.captureLocalViewpoint(viewpoint, bridgeContext);
        await apiClient.uploadLocalViewpoint(viewpoint, bridgeContext.modelFingerprint, captured.visualState, reason);
        uploaded += 1;
      }
      setLocalInventory(await bridgeClient.loadLocalInventory());
      await loadIssues("refresh");
      setReconciliationState("success");
      setReconciliationMessage(`Reconciliation complete: ${confirmed} recovered identity confirmation(s), ${pulled} pulled from BIMLog, ${uploaded} uploaded to BIMLog. Save the NWF/NWD when ready.`);
    } catch (error) {
      setReconciliationState("error");
      setReconciliationMessage(`Reconciliation stopped after ${confirmed} recovered confirmation(s), ${pulled} pull(s), and ${uploaded} upload(s): ${error instanceof Error ? error.message : "controlled reconciliation failed"}. Refresh before retrying; do not create duplicates.`);
      try { setLocalInventory(await bridgeClient.loadLocalInventory()); await loadIssues("refresh"); } catch { /* Preserve the primary failure. */ }
    }
  }, [apiClient, authorizedProjectId, bridgeClient, bridgeContext, issues, loadIssues, localInventory, synchronizationPlan]);

  const pullPlatformViewpoints = useCallback(async () => {
    if (!apiClient || !bridgeClient || !bridgeContext || authorizedProjectId === null || bridgeContext.projectId !== authorizedProjectId) return;
    const pulls = synchronizationPlan.items.filter(item => item.disposition === "pull_from_bimlog");
    if (!pulls.length) {
      setPlatformPullState("success");
      setPlatformPullMessage("Every eligible BIMLog viewpoint is already present in Navisworks. Conflicts, blocked records, and records without complete visual packages were not changed.");
      return;
    }
    const reason = window.prompt(`Reason for creating ${pulls.length} BIMLog-authoritative Saved Viewpoint(s) in Navisworks:`)?.trim();
    if (!reason || !window.confirm(`Create ${pulls.length} exact BIMLog viewpoint(s) in Navisworks now? Existing Saved Viewpoints will not be overwritten, unmanaged folders will not be changed, and the model will not be saved automatically.`)) return;
    setPlatformPullState("running");
    setPlatformPullMessage(null);
    let pulled = 0;
    try {
      for (const item of pulls) {
        const issue = issues.find(candidate => candidate.identity.serverId === item.platformServerId);
        if (!issue || issue.navisworksGuid || !issue.visualStateAvailable || !issue.visualStateDigest) throw new Error(`${item.displayId} is no longer an eligible BIMLog-only visual package; refresh and retry.`);
        const stored = await apiClient.loadVisualState(issue);
        await bridgeClient.applyPlatformWorkingView(issue, bridgeContext, stored.visualStateJson);
        const receipt: LensNextCreateReceipt = { serverId: issue.identity.serverId, viewpointId: issue.identity.viewpointId, visualStateDigest: stored.visualStateDigest, revisionNumber: issue.identity.revisionNumber, lifecycleStatus: issue.identity.lifecycleStatus, displayCode: issue.displayId ?? issue.identity.viewpointId };
        const navisworksGuid = await bridgeClient.publishCreatedViewpoint(receipt, bridgeContext, reason);
        await apiClient.confirmCreatedLocalViewpoint(authorizedProjectId, receipt, navisworksGuid, reason);
        pulled += 1;
      }
      setLocalInventory(await bridgeClient.loadLocalInventory());
      await loadIssues("refresh");
      setPlatformPullState("success");
      setPlatformPullMessage(`Created ${pulled} BIMLog-authoritative Saved Viewpoint(s) in Navisworks. Save the NWF/NWD when ready.`);
    } catch (error) {
      setPlatformPullState("error");
      setPlatformPullMessage(`Platform pull stopped after ${pulled} viewpoint(s): ${error instanceof Error ? error.message : "controlled platform pull failed"}. Existing viewpoints were preserved; refresh before retrying.`);
      try { setLocalInventory(await bridgeClient.loadLocalInventory()); await loadIssues("refresh"); } catch { /* Preserve the primary failure. */ }
    }
  }, [apiClient, authorizedProjectId, bridgeClient, bridgeContext, issues, loadIssues, synchronizationPlan]);

  return (
    <LensNextPanelView
      authorizedProjects={authorizedProjects}
      selectedProjectId={selectedProjectId}
      onProjectChange={onProjectChange}
      projectLocked={projectLocked}
      bridgeDisplayName={bridgeContext?.displayName ?? null}
      bridgeModelFingerprint={bridgeContext?.modelFingerprint ?? null}
      bridgeBindingSource={bridgeContext?.bindingSource ?? null}
      inventorySummary={inventorySummary}
      synchronizationPlan={synchronizationPlan}
      uploadableLocalViewpoints={uploadableLocalViewpoints}
      localUploadState={localUploadState}
      localUploadMessage={localUploadMessage}
      onUploadLocalViewpoint={(viewpoint) => void uploadLocalViewpoint(viewpoint)}
      createEnabled={bridgeState === "connected" && apiState === "connected" && bridgeContext?.projectId === authorizedProjectId}
      createState={createState}
      createMessage={createMessage}
      onCreateViewpoint={(draft, reason) => void createViewpoint(draft, reason)}
      layoutEnabled={bridgeState === "connected" && bridgeContext?.projectId === authorizedProjectId}
      layoutState={layoutState}
      layoutMessage={layoutMessage}
      onMaterializeMyView={() => void materializeMyView()}
      reconciliationState={reconciliationState}
      reconciliationMessage={reconciliationMessage}
      onRunReconciliation={() => void runReconciliation()}
      platformPullState={platformPullState}
      platformPullMessage={platformPullMessage}
      onPullPlatformViewpoints={() => void pullPlatformViewpoints()}
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
      createTrades={trades}
      createFloors={floors}
      createResponsibleCompanies={createResponsibleCompanies}
      createReportTypes={LENS_NEXT_REPORT_TYPE_OPTIONS}
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
        bridgeContext?.projectId === authorizedProjectId &&
        selectedIssue !== null
      }
      workingViewUnavailable={
        selectedIssue !== null && !selectedIssue.visualStateAvailable
      }
      onRefresh={() => void loadIssues("refresh")}
      onSelectIssue={(serverId) => {
        setSelectedServerId(serverId);
        setBridgeError(null);
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
