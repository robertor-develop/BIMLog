import {
  adaptLensNextHistoryResponse,
  adaptLensNextPullResponse,
  assertLensNextImmutableIdentity,
  assertLensNextProjectId,
  createLensNextOpenWorkingViewRequest,
} from "./lens-next-model.ts";
import type {
  LensNextBridgeProjectContext,
  LensNextHistory,
  LensNextImmutableIssueIdentity,
  LensNextIssue,
  LensNextLocalInventory,
  LensNextModelBindingResolution,
  LensNextOpenWorkingViewResult,
  LensNextPublishAction,
  LensNextPublishResult,
} from "./lens-next-types.ts";

export const LENS_NEXT_BRIDGE_ORIGIN = "http://127.0.0.1:8766";

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function requiredToken(value: string, label: string): string {
  const token = value.trim();
  if (!token) throw new Error(`${label} is required`);
  return token;
}

function normalizeApiBase(value: string): string {
  const base = value.trim().replace(/\/+$/, "");
  if (!base) throw new Error("API base URL is required");
  return base;
}

async function jsonBody(response: Response, label: string): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : "";
    throw new Error(
      `${label} failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return body;
}

export interface LensNextApiClientOptions {
  token: string;
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}

export interface LensNextApiClient {
  resolveModelBinding(modelBindingKey: string, modelDisplayName: string | null, managedProjectId: number | null, signal?: AbortSignal): Promise<LensNextModelBindingResolution>;
  loadIssues(projectId: number, signal?: AbortSignal): Promise<LensNextIssue[]>;
  loadHistory(
    identity: LensNextImmutableIssueIdentity,
    signal?: AbortSignal,
  ): Promise<LensNextHistory>;
  publishAction(issue: LensNextIssue, action: LensNextPublishAction, reason: string, idempotencyKey: string, modelFingerprint?: string | null, signal?: AbortSignal): Promise<LensNextPublishResult>;
  saveVisualState(issue: LensNextIssue, visualStateJson: string, visualStateDigest: string, signal?: AbortSignal): Promise<void>;
  loadVisualState(issue: LensNextIssue, signal?: AbortSignal): Promise<{ visualStateJson: string; visualStateDigest: string }>;
}

export function createLensNextApiClient(
  options: LensNextApiClientOptions,
): LensNextApiClient {
  const token = requiredToken(options.token, "authenticated BIMLog token");
  const base = normalizeApiBase(options.apiBaseUrl ?? "/api/v1");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const get = async (path: string, signal?: AbortSignal): Promise<unknown> => {
    const response = await fetchImpl(`${base}${path}`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal,
    });
    return jsonBody(response, "BIMLog read");
  };
  const post = async (path: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const response = await fetchImpl(`${base}${path}`, {
      method: "POST", credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal,
    });
    return jsonBody(response, "BIMLog controlled publish");
  };
  return Object.freeze({
    async resolveModelBinding(modelBindingKey: string, modelDisplayName: string | null, managedProjectId: number | null, signal?: AbortSignal) {
      const raw = await post("/lens-next/model-bindings/resolve", { modelBindingKey, modelDisplayName, managedProjectId }, signal);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("BIMLog model binding response is invalid");
      const body = raw as Record<string, unknown>;
      const projectId = Number(body.projectId);
      const source = String(body.source ?? "") as LensNextModelBindingResolution["source"];
      if (!Number.isSafeInteger(projectId) || projectId <= 0 || String(body.modelBindingKey ?? "") !== modelBindingKey || !["existing_registry", "managed_metadata", "unique_platform_identity"].includes(source)) throw new Error("BIMLog model binding response is invalid");
      return Object.freeze({ projectId, modelBindingKey, source });
    },
    async loadIssues(projectId: number, signal?: AbortSignal) {
      const exactProjectId = assertLensNextProjectId(projectId);
      const body = await get(
        `/projects/${exactProjectId}/clash-reports/lens-pull`,
        signal,
      );
      return adaptLensNextPullResponse(body, exactProjectId);
    },
    async loadHistory(
      identity: LensNextImmutableIssueIdentity,
      signal?: AbortSignal,
    ) {
      const exactIdentity = assertLensNextImmutableIdentity(identity);
      const body = await get(
        `/projects/${exactIdentity.projectId}/clash-reports/lens-viewpoints/${exactIdentity.serverId}/history`,
        signal,
      );
      return adaptLensNextHistoryResponse(body, exactIdentity);
    },
    async publishAction(issue: LensNextIssue, action: LensNextPublishAction, reason: string, idempotencyKey: string, modelFingerprint?: string | null, signal?: AbortSignal) {
      const identity = assertLensNextImmutableIdentity(issue.identity);
      const requestId = defaultRequestId();
      const raw = await post(`/projects/${identity.projectId}/clash-reports/lens-next/issues/${identity.serverId}/publish`, {
        contractVersion: "lens-next-publish.v1",
        requestId,
        idempotencyKey,
        identity: { ...identity, mutationVersion: issue.mutationVersion },
        action,
        reason: reason.trim(),
        modelFingerprint: modelFingerprint?.trim() || null,
      }, signal);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Controlled publish receipt is invalid");
      const body = raw as Record<string, any>;
      if (body.success !== true || body.contractVersion !== "lens-next-publish.v1" || !body.receipt || !body.issue) throw new Error("Controlled publish receipt is invalid");
      return body as LensNextPublishResult;
    },
    async saveVisualState(issue: LensNextIssue, visualStateJson: string, visualStateDigest: string, signal?: AbortSignal) {
      const identity = assertLensNextImmutableIdentity(issue.identity);
      const raw = await post(`/projects/${identity.projectId}/clash-reports/lens-viewpoints/${identity.serverId}/visual-state`, {
        identity, visualStateJson, visualStateDigest,
      }, signal);
      if (!raw || typeof raw !== "object" || (raw as Record<string, unknown>).success !== true)
        throw new Error("BIMLog did not confirm visual-state persistence");
    },
    async loadVisualState(issue: LensNextIssue, signal?: AbortSignal) {
      const identity = assertLensNextImmutableIdentity(issue.identity);
      const raw = await get(`/projects/${identity.projectId}/clash-reports/lens-viewpoints/${identity.serverId}/visual-state`, signal);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("BIMLog visual-state response is invalid");
      const body = raw as Record<string, unknown>;
      const echoedIdentity = assertLensNextImmutableIdentity(body.identity);
      if (!sameIdentity(identity, echoedIdentity)) throw new Error("BIMLog visual-state identity mismatch");
      const visualStateJson = String(body.visualStateJson ?? "");
      const visualStateDigest = String(body.visualStateDigest ?? "").toLowerCase();
      if (!visualStateJson || !/^[0-9a-f]{64}$/.test(visualStateDigest)) throw new Error("BIMLog visual-state package is incomplete");
      return Object.freeze({ visualStateJson, visualStateDigest });
    },
  });
}


export interface LensNextBridgeBootstrapSession {
  protocolVersion: 1;
  source: "lens-next-native-host";
  token: string;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
}

export async function bootstrapLensNextBridgeSession(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  signal?: AbortSignal,
): Promise<LensNextBridgeBootstrapSession> {
  const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/session`, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const raw = await jsonBody(response, "Lens Next bridge session");
  const payload = bridgePayload(raw, "session");
  const protocolVersion = Number(payload.protocolVersion);
  const source = String(payload.source ?? "");
  const token = String(payload.token ?? "").trim();
  const sessionId = String(payload.sessionId ?? "").trim();
  const issuedAt = String(payload.issuedAt ?? "").trim();
  const expiresAt = String(payload.expiresAt ?? "").trim();
  if (
    protocolVersion !== 1 ||
    source !== "lens-next-native-host" ||
    !/^[A-Za-z0-9._~-]{32,512}$/.test(token) ||
    !sessionId ||
    !Number.isFinite(Date.parse(issuedAt)) ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw new Error("Lens Next bridge session response is invalid");
  }
  return Object.freeze({
    protocolVersion: 1,
    source: "lens-next-native-host" as const,
    token,
    sessionId,
    issuedAt,
    expiresAt,
  });
}

export interface LensNextBridgeClientOptions {
  sessionToken: string;
  fetchImpl?: FetchLike;
  requestIdFactory?: () => string;
}

export interface LensNextBridgeClient {
  probe(signal?: AbortSignal): Promise<boolean>;
  loadProjectContext(
    signal?: AbortSignal,
  ): Promise<LensNextBridgeProjectContext>;
  loadLocalInventory(signal?: AbortSignal): Promise<LensNextLocalInventory>;
  bindProject(projectId: number, signal?: AbortSignal): Promise<LensNextBridgeProjectContext>;
  openWorkingView(
    issue: LensNextIssue,
    context: LensNextBridgeProjectContext,
    signal?: AbortSignal,
  ): Promise<LensNextOpenWorkingViewResult>;
  applyPlatformWorkingView(
    issue: LensNextIssue,
    context: LensNextBridgeProjectContext,
    visualStateJson: string,
    signal?: AbortSignal,
  ): Promise<LensNextOpenWorkingViewResult>;
  captureCurrentVisualState(
    issue: LensNextIssue,
    context: LensNextBridgeProjectContext,
    signal?: AbortSignal,
  ): Promise<{ visualStateJson: string; visualStateDigest: string }>;
}

function defaultRequestId(): string {
  return `lens-next-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

function sameIdentity(
  left: LensNextImmutableIssueIdentity,
  right: LensNextImmutableIssueIdentity,
): boolean {
  return (
    left.projectId === right.projectId &&
    left.serverId === right.serverId &&
    left.viewpointId === right.viewpointId &&
    left.lifecycleStatus === right.lifecycleStatus &&
    left.revisionNumber === right.revisionNumber
  );
}

function bridgePayload(
  value: unknown,
  expectedCode: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid bridge response");
  }
  const body = value as Record<string, unknown>;
  if (body.success !== true || body.code !== expectedCode) {
    const message = typeof body.message === "string" ? body.message : "";
    throw new Error(message || `bridge did not confirm ${expectedCode}`);
  }
  if (
    body.payload === null ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    throw new Error("bridge response payload is missing");
  }
  return body.payload as Record<string, unknown>;
}

export function createLensNextBridgeClient(
  options: LensNextBridgeClientOptions,
): LensNextBridgeClient {
  const sessionToken = requiredToken(
    options.sessionToken,
    "Lens Next bridge session token",
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestIdFactory = options.requestIdFactory ?? defaultRequestId;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
    "X-BIMLog-Lens-Next-Protocol": "1",
  };
  return Object.freeze({
    async probe(signal?: AbortSignal) {
      try {
        const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/ping`, {
          method: "GET",
          headers,
          signal,
        });
        if (!response.ok) return false;
        const body = await response.json().catch(() => null);
        return bridgePayload(body, "pong").protocolVersion === 1;
      } catch {
        return false;
      }
    },
    async loadProjectContext(signal?: AbortSignal) {
      const response = await fetchImpl(
        `${LENS_NEXT_BRIDGE_ORIGIN}/v1/project-context`,
        { method: "GET", headers, signal },
      );
      const raw = await jsonBody(response, "Lens Next project-context");
      const payload = bridgePayload(raw, "project_context");
      const sessionId = String(payload.sessionId ?? "").trim();
      const modelFingerprint = String(payload.modelFingerprint ?? "").trim();
      const modelBindingKey = String(payload.modelBindingKey ?? "").trim();
      const projectId = payload.projectId == null ? null : Number(payload.projectId);
      const managedViewpointCount = Number(payload.managedViewpointCount);
      const bindingSource = String(payload.bindingSource ?? "");
      if (
        !sessionId ||
        !modelFingerprint ||
        (projectId !== null && (!Number.isSafeInteger(projectId) || projectId <= 0)) ||
        !modelBindingKey ||
        !Number.isSafeInteger(managedViewpointCount) ||
        managedViewpointCount < 0 ||
        !["unbound", "navisworks_bimlog_metadata", "bimlog_model_registry"].includes(bindingSource)
      ) {
        throw new Error("bridge project context is incomplete");
      }
      return Object.freeze({
        sessionId,
        projectId,
        modelFingerprint,
        modelBindingKey,
        displayName:
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName.trim()
            : null,
        bindingSource: bindingSource as LensNextBridgeProjectContext["bindingSource"],
        managedViewpointCount,
      });
    },
    async loadLocalInventory(signal?: AbortSignal) {
      const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/local-inventory`, {
        method: "GET", headers, signal,
      });
      const raw = await jsonBody(response, "Lens Next local inventory");
      const payload = bridgePayload(raw, "local_inventory");
      const projectId = payload.projectId == null ? null : Number(payload.projectId);
      const modelFingerprint = String(payload.modelFingerprint ?? "").trim();
      const modelBindingKey = String(payload.modelBindingKey ?? "").trim();
      if ((projectId !== null && (!Number.isSafeInteger(projectId) || projectId <= 0)) || !modelBindingKey || !/^[0-9a-f]{64}$/i.test(modelFingerprint) || !Array.isArray(payload.viewpoints))
        throw new Error("bridge local inventory is incomplete");
      const viewpoints = payload.viewpoints.map((rawView): LensNextLocalInventory["viewpoints"][number] => {
        if (!rawView || typeof rawView !== "object" || Array.isArray(rawView)) throw new Error("bridge local viewpoint is invalid");
        const view = rawView as Record<string, unknown>;
        const localProjectId = Number(view.ProjectId ?? view.projectId);
        const serverValue = view.ServerId ?? view.serverId;
        const serverId = serverValue == null || String(serverValue).trim() === "" ? null : Number(serverValue);
        const navisworksGuid = String(view.NavisworksGuid ?? view.navisworksGuid ?? "").trim();
        const viewpointId = String(view.ViewpointId ?? view.viewpointId ?? "").trim();
        if ((projectId !== null && localProjectId !== projectId) || !Number.isSafeInteger(localProjectId) || localProjectId <= 0 || (serverId !== null && (!Number.isSafeInteger(serverId) || serverId <= 0)) || !navisworksGuid || !viewpointId)
          throw new Error("bridge local viewpoint identity is incomplete");
        return Object.freeze({
          projectId: localProjectId,
          serverId,
          viewpointId,
          displayId: String(view.DisplayId ?? view.displayId ?? "").trim() || null,
          bimlogPhysicalId: String(view.BimlogPhysicalId ?? view.bimlogPhysicalId ?? "").trim() || null,
          navisworksGuid,
          displayName: String(view.DisplayName ?? view.displayName ?? viewpointId).trim(),
          folderPath: String(view.FolderPath ?? view.folderPath ?? "").trim(),
          exactManagedIdentity: Boolean(view.ExactManagedIdentity ?? view.exactManagedIdentity),
        });
      });
      return Object.freeze({ projectId, modelFingerprint: modelFingerprint.toLowerCase(), modelBindingKey, viewpoints: Object.freeze(viewpoints) });
    },
    async bindProject(projectId: number, signal?: AbortSignal) {
      const exactProjectId = assertLensNextProjectId(projectId);
      const requestId = requestIdFactory();
      const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/project-binding`, {
        method: "POST", headers, signal,
        body: JSON.stringify({ protocolVersion: 1, command: "bind-project", requestId, idempotencyKey: requestId, fields: { projectId: String(exactProjectId), bindingSource: "bimlog_model_registry" } }),
      });
      const raw = await jsonBody(response, "Lens Next project binding");
      const payload = bridgePayload(raw, "project_bound");
      const context = await this.loadProjectContext(signal);
      if (context.projectId !== exactProjectId || Number(payload.projectId) !== exactProjectId) throw new Error("Lens Next bridge project binding mismatch");
      return context;
    },
    async openWorkingView(
      issue: LensNextIssue,
      context: LensNextBridgeProjectContext,
      signal?: AbortSignal,
    ) {
      const request = createLensNextOpenWorkingViewRequest(
        issue.identity,
        context,
        {
          bimlogPhysicalId: issue.bimlogPhysicalId,
          navisworksGuid: issue.navisworksGuid,
        },
        requestIdFactory(),
      );
      const response = await fetchImpl(
        `${LENS_NEXT_BRIDGE_ORIGIN}/v1/open-working-view`,
        {
          method: "POST",
          headers: { ...headers, "X-Request-Id": request.requestId },
          body: JSON.stringify(request),
          signal,
        },
      );
      const raw = await jsonBody(response, "Lens Next open-working-view");
      const body = bridgePayload(raw, "working_view_opened");
      if (body.opened !== true || body.requestId !== request.requestId) {
        throw new Error(
          "bridge did not confirm the exact open-working-view request",
        );
      }
      const echoedIdentity = assertLensNextImmutableIdentity(body.identity);
      if (!sameIdentity(issue.identity, echoedIdentity))
        throw new Error("bridge identity echo does not match the request");
      return Object.freeze({
        opened: true,
        requestId: request.requestId,
        identity: echoedIdentity,
      });
    },
    async applyPlatformWorkingView(
      issue: LensNextIssue,
      context: LensNextBridgeProjectContext,
      visualStateJson: string,
      signal?: AbortSignal,
    ) {
      if (!visualStateJson.trim()) throw new Error("platform_visual_state_unavailable");
      const request = createLensNextOpenWorkingViewRequest(
        issue.identity,
        context,
        { bimlogPhysicalId: issue.bimlogPhysicalId, navisworksGuid: issue.navisworksGuid },
        requestIdFactory(),
      );
      const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/apply-working-view`, {
        method: "POST",
        headers: { ...headers, "X-Request-Id": request.requestId },
        body: JSON.stringify({
          ...request,
          command: "apply-working-view",
          fields: { ...request.fields, visualStateJson },
        }),
        signal,
      });
      const raw = await jsonBody(response, "Lens Next apply-working-view");
      const body = bridgePayload(raw, "working_view_applied");
      const result = body.result as Record<string, unknown> | undefined;
      if (body.requestId !== request.requestId || (result?.Applied !== true && result?.applied !== true))
        throw new Error("bridge did not confirm the reconstructed working view");
      const echoedIdentity = assertLensNextImmutableIdentity(body.identity);
      if (!sameIdentity(issue.identity, echoedIdentity))
        throw new Error("bridge identity echo does not match the request");
      return Object.freeze({ opened: true, requestId: request.requestId, identity: echoedIdentity });
    },
    async captureCurrentVisualState(issue: LensNextIssue, context: LensNextBridgeProjectContext, signal?: AbortSignal) {
      const request = createLensNextOpenWorkingViewRequest(issue.identity, context, {
        bimlogPhysicalId: issue.bimlogPhysicalId, navisworksGuid: issue.navisworksGuid,
      }, requestIdFactory());
      const response = await fetchImpl(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/capture-visual-state`, {
        method: "POST",
        headers: { ...headers, "X-Request-Id": request.requestId },
        body: JSON.stringify({ ...request, command: "capture-visual-state", fields: { ...request.fields, includeScreenshot: "false" } }),
        signal,
      });
      const raw = await jsonBody(response, "Lens Next capture-visual-state");
      const body = bridgePayload(raw, "visual_state_captured");
      const state = body.visualState;
      if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("bridge visual-state payload is invalid");
      const digest = String((state as Record<string, unknown>).DigestSha256 ?? (state as Record<string, unknown>).digestSha256 ?? "").trim();
      if (!/^[0-9a-f]{64}$/i.test(digest)) throw new Error("bridge visual-state digest is invalid");
      return Object.freeze({ visualStateJson: JSON.stringify(state), visualStateDigest: digest.toLowerCase() });
    },
  });
}
