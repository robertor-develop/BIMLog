import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  LoaderCircle,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import React, { type CSSProperties } from "react";

import type { LensNextRefreshIdentity } from "./lens-next-auto-refresh";
import type { LensNextWorkflowBannerState } from "./LensNextWorkflowStateBanner";

export type LensNextConnectionTelemetryState =
  | "connected"
  | "refreshing"
  | "saved"
  | "offline_retry"
  | "conflict_blocked"
  | "action_blocked";

export type LensNextTelemetryReason =
  | "NONE"
  | "NETWORK_OFFLINE"
  | "STALE_REFRESH_RESPONSE"
  | "DIVERGENT_DUPLICATE_RESPONSE"
  | "IMMUTABLE_IDENTITY_MISMATCH"
  | "VISUAL_STATE_DIVERGED"
  | "RETRY_LIMIT_REACHED"
  | "AUTHENTICATED_SESSION_REQUIRED"
  | "UNBOUND_REFRESH_RESPONSE";

export interface LensNextConnectionTelemetryViewProps {
  locale: "en" | "es";
  state: LensNextConnectionTelemetryState;
  identity: LensNextRefreshIdentity;
  modelId: string;
  modelVersionFingerprint: string;
  version: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  retryAttempt: number;
  retryDelayMs: number | null;
  reason: LensNextTelemetryReason;
  onRequestRefresh: () => void;
}

const MAX_RETRY_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 8_000;
const MAX_ISSUES = 500;

const workflowStateByTelemetry = {
  connected: "saved",
  refreshing: "refreshing",
  saved: "saved",
  offline_retry: "offline",
  conflict_blocked: "conflict",
  action_blocked: "action_blocked",
} as const satisfies Record<
  LensNextConnectionTelemetryState,
  Exclude<LensNextWorkflowBannerState, "saving">
>;

const copy = {
  en: {
    title: "Connection and refresh telemetry",
    state: {
      connected: ["Connected", "The authenticated read session is available."],
      refreshing: ["Refreshing", "A single read-only refresh is in progress."],
      saved: ["Saved", "The latest accepted issue state is current."],
      offline_retry: [
        "Offline",
        "The next read-only refresh is waiting for its retry window.",
      ],
      conflict_blocked: [
        "Conflict blocked",
        "Refresh stopped for manual conflict review.",
      ],
      action_blocked: [
        "Action blocked",
        "Refresh stopped because its binding was not safe.",
      ],
    },
    project: "Project / issue identity",
    model: "Model identity / version fingerprint",
    version: "Current server version / revision",
    attempt: "Last refresh attempt",
    success: "Last successful refresh",
    retry: "Retry attempt / cap / delay",
    ceiling: "Bounded issue ceiling",
    reason: "Stale or blocked reason",
    none: "None",
    unknown: "Not recorded",
    issues: "issues",
    refresh: "Request read-only refresh",
    invariant:
      "Telemetry never exposes a session token, sends a request, changes visual state, or enables a mutation.",
  },
  es: {
    title: "Telemetría de conexión y actualización",
    state: {
      connected: [
        "Conectado",
        "La sesión autenticada de solo lectura está disponible.",
      ],
      refreshing: [
        "Actualizando",
        "Hay una sola actualización de solo lectura en curso.",
      ],
      saved: [
        "Guardado",
        "El estado aceptado más reciente del asunto está actualizado.",
      ],
      offline_retry: [
        "Sin conexión",
        "La próxima actualización de solo lectura espera su intervalo de reintento.",
      ],
      conflict_blocked: [
        "Conflicto bloqueado",
        "La actualización se detuvo para revisión manual del conflicto.",
      ],
      action_blocked: [
        "Acción bloqueada",
        "La actualización se detuvo porque su vinculación no era segura.",
      ],
    },
    project: "Identidad del proyecto / asunto",
    model: "Identidad del modelo / huella de versión",
    version: "Versión actual del servidor / revisión",
    attempt: "Último intento de actualización",
    success: "Última actualización exitosa",
    retry: "Intento / límite / demora de reintento",
    ceiling: "Límite acotado de asuntos",
    reason: "Motivo de obsolescencia o bloqueo",
    none: "Ninguno",
    unknown: "Sin registro",
    issues: "asuntos",
    refresh: "Solicitar actualización de solo lectura",
    invariant:
      "La telemetría nunca expone un token de sesión, envía una solicitud, cambia el estado visual ni habilita una mutación.",
  },
} as const;

const containerStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.75rem",
  border: "1px solid currentColor",
  borderRadius: "0.875rem",
  containerType: "inline-size",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  minHeight: "2.25rem",
  padding: "0.375rem 0.625rem",
  border: "1px solid currentColor",
  borderRadius: "0.5rem",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

function bounded(value: string, maximum = 160) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function timestamp(value: string | null, fallback: string) {
  if (!value) return fallback;
  return bounded(value, 40);
}

function stateIcon(state: LensNextConnectionTelemetryState) {
  const props = { size: 18, "aria-hidden": true as const };
  if (state === "connected") return <PlugZap {...props} />;
  if (state === "refreshing") return <LoaderCircle {...props} />;
  if (state === "saved") return <CheckCircle2 {...props} />;
  if (state === "offline_retry") return <CloudOff {...props} />;
  if (state === "conflict_blocked") return <CircleAlert {...props} />;
  return <Ban {...props} />;
}

export function LensNextConnectionTelemetryView({
  locale,
  state,
  identity,
  modelId,
  modelVersionFingerprint,
  version,
  lastAttemptAt,
  lastSuccessAt,
  retryAttempt,
  retryDelayMs,
  reason,
  onRequestRefresh,
}: LensNextConnectionTelemetryViewProps) {
  const text = copy[locale];
  const [stateTitle, stateMessage] = text.state[state];
  const urgent = state === "conflict_blocked" || state === "action_blocked";
  const safeAttempt = Math.min(
    MAX_RETRY_ATTEMPTS,
    Math.max(0, Number.isSafeInteger(retryAttempt) ? retryAttempt : 0),
  );
  const safeDelay =
    retryDelayMs === null
      ? 0
      : Math.min(
          MAX_RETRY_DELAY_MS,
          Math.max(0, Number.isSafeInteger(retryDelayMs) ? retryDelayMs : 0),
        );
  const projectIdentity = bounded(
    `${identity.projectId}:${identity.issueFamilyId}:${identity.serverId}:${identity.viewpointId}:${identity.lifecycleStatus}`,
  );

  return (
    <section
      aria-labelledby="lens-next-connection-telemetry-heading"
      data-connection-state={state}
      data-workflow-state={workflowStateByTelemetry[state]}
      data-responsive-contract="mobile-280px-single-column"
      style={containerStyle}
    >
      <h2 id="lens-next-connection-telemetry-heading">{text.title}</h2>
      <p
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
        aria-busy={state === "refreshing"}
        aria-atomic="true"
      >
        {stateIcon(state)}
        <span>
          <strong>{stateTitle}</strong> — {stateMessage}
        </span>
      </p>
      <dl>
        <div>
          <dt>{text.project}</dt>
          <dd>{projectIdentity}</dd>
        </div>
        <div>
          <dt>{text.model}</dt>
          <dd>
            {bounded(modelId)} / {bounded(modelVersionFingerprint, 64)}
          </dd>
        </div>
        <div>
          <dt>{text.version}</dt>
          <dd>
            {version} / {identity.revisionNumber}
          </dd>
        </div>
        <div>
          <dt>{text.attempt}</dt>
          <dd>{timestamp(lastAttemptAt, text.unknown)}</dd>
        </div>
        <div>
          <dt>{text.success}</dt>
          <dd>{timestamp(lastSuccessAt, text.unknown)}</dd>
        </div>
        <div>
          <dt>{text.retry}</dt>
          <dd>
            {safeAttempt} / {MAX_RETRY_ATTEMPTS} / {safeDelay} ms
          </dd>
        </div>
        <div>
          <dt>{text.ceiling}</dt>
          <dd>
            {MAX_ISSUES} {text.issues}
          </dd>
        </div>
        <div>
          <dt>{text.reason}</dt>
          <dd>{reason === "NONE" ? text.none : reason}</dd>
        </div>
      </dl>
      <p>
        <strong>{text.invariant}</strong>
      </p>
      <button
        type="button"
        onClick={onRequestRefresh}
        disabled={state === "refreshing"}
        style={buttonStyle}
      >
        <RefreshCw aria-hidden="true" size={15} />
        {text.refresh}
      </button>
    </section>
  );
}

export const LENS_NEXT_CONNECTION_TELEMETRY_INVARIANTS = Object.freeze({
  minimumWidthPx: 280,
  maximumIssues: MAX_ISSUES,
  maximumRetries: MAX_RETRY_ATTEMPTS,
  maximumRetryDelayMs: MAX_RETRY_DELAY_MS,
  sessionTokenRendered: false as const,
  callbackDispatchesNetwork: false as const,
  mutationAllowed: false as const,
  actionDraftBehavior: false as const,
  storageBehavior: false as const,
  persistenceBehavior: false as const,
  visualMutationAllowed: false as const,
});
