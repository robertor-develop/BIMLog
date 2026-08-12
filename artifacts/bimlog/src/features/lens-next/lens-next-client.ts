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
  LensNextOpenWorkingViewResult,
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
  loadIssues(projectId: number, signal?: AbortSignal): Promise<LensNextIssue[]>;
  loadHistory(
    identity: LensNextImmutableIssueIdentity,
    signal?: AbortSignal,
  ): Promise<LensNextHistory>;
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
  return Object.freeze({
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
  openWorkingView(
    issue: LensNextIssue,
    context: LensNextBridgeProjectContext,
    signal?: AbortSignal,
  ): Promise<LensNextOpenWorkingViewResult>;
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
      const projectId = Number(payload.projectId);
      if (
        !sessionId ||
        !modelFingerprint ||
        !Number.isSafeInteger(projectId) ||
        projectId <= 0
      ) {
        throw new Error("bridge project context is incomplete");
      }
      return Object.freeze({
        sessionId,
        projectId,
        modelFingerprint,
        displayName:
          typeof payload.displayName === "string" && payload.displayName.trim()
            ? payload.displayName.trim()
            : null,
      });
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
  });
}
